from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import Inventory, InventoryLog, Machine, MachineAlert, Product
from app.schemas.inventory import InventoryBulkUpsert, MinThresholdUpdate, RestockRequest
from app.services.exceptions import VendingError
from app.services.serializers import inventory_log_out, inventory_out


def _query_inventory(db: Session, machine_id: int | None = None, low_stock: bool = False):
    query = (
        select(Inventory)
        .options(joinedload(Inventory.product), joinedload(Inventory.machine))
        .join(Product, Product.id == Inventory.product_id)
        .order_by(Inventory.machine_id, Inventory.slot_code)
    )
    if machine_id:
        query = query.where(Inventory.machine_id == machine_id)
    if low_stock:
        query = query.where(
            Inventory.quantity - Inventory.reserved_quantity
            <= Inventory.low_stock_threshold
        )
    return db.scalars(query).unique().all()


def list_inventory(
    db: Session,
    machine_id: int | None = None,
    low_stock: bool = False,
    search: str | None = None,
):
    rows = _query_inventory(db, machine_id, low_stock)
    if search:
        needle = search.lower().strip()
        rows = [
            row
            for row in rows
            if needle in row.product.name.lower()
            or needle in row.slot_code.lower()
            or needle in (row.machine.name if row.machine else "").lower()
        ]
    return [inventory_out(row) for row in rows]


def inventory_summary(db: Session, machine_id: int | None = None):
    query = select(Inventory)
    if machine_id:
        query = query.where(Inventory.machine_id == machine_id)
    rows = db.scalars(query).all()
    available = sum(row.quantity - row.reserved_quantity for row in rows)
    low = sum(
        1
        for row in rows
        if row.quantity - row.reserved_quantity <= row.low_stock_threshold
    )
    out = sum(1 for row in rows if row.quantity - row.reserved_quantity <= 0)
    reserved = sum(row.reserved_quantity for row in rows)
    return {
        "total_units": sum(row.quantity for row in rows),
        "available_units": available,
        "reserved_units": reserved,
        "low_stock_count": low,
        "out_of_stock_count": out,
        "sku_count": len(rows),
    }


def restock(
    db: Session,
    inventory_id: int,
    payload: RestockRequest,
    user_id: int | None = None,
):
    inventory = db.scalar(
        select(Inventory).where(Inventory.id == inventory_id).with_for_update()
    )
    if not inventory:
        raise VendingError("Inventory record not found.", 404)
    previous = inventory.quantity
    inventory.quantity += payload.quantity
    db.add(
        InventoryLog(
            machine_id=inventory.machine_id,
            product_id=inventory.product_id,
            change=payload.quantity,
            reason=payload.reason,
            previous_quantity=previous,
            new_quantity=inventory.quantity,
            created_by_id=user_id,
        )
    )
    # Restocking makes an open low-stock alert for this SKU obsolete.
    product_name = inventory.product.name if inventory.product else ""
    alerts = db.scalars(
        select(MachineAlert).where(
            MachineAlert.machine_id == inventory.machine_id,
            MachineAlert.is_resolved.is_(False),
            MachineAlert.type.in_(["low_stock", "out_of_stock"]),
            MachineAlert.message.like(f"{product_name}%"),
        )
    ).all()
    for alert in alerts:
        alert.is_resolved = True
    db.commit()
    db.refresh(inventory)
    return inventory_out(inventory)


def set_threshold(db: Session, inventory_id: int, payload: MinThresholdUpdate):
    inventory = db.get(Inventory, inventory_id)
    if not inventory:
        raise VendingError("Inventory record not found.", 404)
    inventory.low_stock_threshold = payload.low_stock_threshold
    db.commit()
    return inventory_out(inventory)


def bulk_upsert(db: Session, payload: InventoryBulkUpsert):
    machine = db.get(Machine, payload.machine_id)
    if not machine:
        raise VendingError("Machine not found.", 404)
    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise VendingError(f"Product {item.product_id} not found.", 404)
        inventory = db.scalar(
            select(Inventory)
            .where(
                Inventory.machine_id == payload.machine_id,
                Inventory.product_id == item.product_id,
            )
            .with_for_update()
        )
        if inventory:
            previous = inventory.quantity
            inventory.quantity = item.quantity
            inventory.low_stock_threshold = item.low_stock_threshold
            inventory.slot_code = item.slot_code
            db.add(
                InventoryLog(
                    machine_id=payload.machine_id,
                    product_id=item.product_id,
                    change=item.quantity - previous,
                    reason="Inventory plan update",
                    previous_quantity=previous,
                    new_quantity=item.quantity,
                )
            )
        else:
            db.add(
                Inventory(
                    machine_id=payload.machine_id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    low_stock_threshold=item.low_stock_threshold,
                    slot_code=item.slot_code,
                )
            )
            db.add(
                InventoryLog(
                    machine_id=payload.machine_id,
                    product_id=item.product_id,
                    change=item.quantity,
                    reason="Initial inventory plan",
                    previous_quantity=0,
                    new_quantity=item.quantity,
                )
            )
    db.commit()
    return {
        "machine_id": payload.machine_id,
        "items_updated": len(payload.items),
        "message": "Inventory plan saved.",
    }


def list_logs(
    db: Session,
    machine_id: int | None = None,
    product_id: int | None = None,
    page: int = 1,
    page_size: int = 25,
):
    count_query = select(func.count(InventoryLog.id))
    query = (
        select(InventoryLog)
        .options(joinedload(InventoryLog.product), joinedload(InventoryLog.machine))
        .order_by(InventoryLog.created_at.desc())
    )
    filters = []
    if machine_id:
        filters.append(InventoryLog.machine_id == machine_id)
    if product_id:
        filters.append(InventoryLog.product_id == product_id)
    if filters:
        count_query = count_query.where(*filters)
        query = query.where(*filters)
    total = db.scalar(count_query) or 0
    rows = db.scalars(
        query.offset((page - 1) * page_size).limit(page_size)
    ).unique().all()
    return {
        "items": [inventory_log_out(row) for row in rows],
        "total": int(total),
        "page": page,
        "page_size": page_size,
    }


def low_stock_alert_feed(db: Session, limit: int = 20):
    inventory_rows = db.scalars(
        select(Inventory)
        .options(joinedload(Inventory.product), joinedload(Inventory.machine))
        .where(
            Inventory.quantity - Inventory.reserved_quantity
            <= Inventory.low_stock_threshold
        )
        .order_by((Inventory.quantity - Inventory.reserved_quantity).asc())
        .limit(limit)
    ).unique().all()
    return [
        {
            "inventory_id": row.id,
            "machine_id": row.machine_id,
            "machine_name": row.machine.name if row.machine else "",
            "product_id": row.product_id,
            "product_name": row.product.name if row.product else "",
            "available": max(row.quantity - row.reserved_quantity, 0),
            "threshold": row.low_stock_threshold,
            "slot_code": row.slot_code,
        }
        for row in inventory_rows
    ]
