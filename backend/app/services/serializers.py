from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.automaton.states import ACCEPTING_STATES
from app.models import (
    Category,
    Inventory,
    Machine,
    MachineAlert,
    Payment,
    Product,
    Refund,
    StateLog,
    Transaction,
    TransactionItem,
)
from app.schemas.catalog import CatalogProduct, CategoryOut, ProductOut
from app.schemas.inventory import InventoryLogOut, InventoryOut
from app.schemas.machine import AlertOut, MachineOut
from app.schemas.transaction import (
    PaymentOut,
    RefundOut,
    StateLogOut,
    TransactionDetail,
    TransactionItemOut,
    TransactionSummary,
)


def category_out(category: Category, product_count: int = 0) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        color=category.color,
        created_at=category.created_at,
        product_count=product_count,
    )


def product_out(product: Product, total_stock: int = 0) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        slug=product.slug,
        sku=product.sku,
        description=product.description,
        category_id=product.category_id,
        price_paise=product.price_paise,
        image_url=product.image_url,
        is_active=product.is_active,
        created_at=product.created_at,
        category=category_out(product.category) if product.category else None,
        total_stock=total_stock,
    )


def catalog_product(product: Product, inventory: Inventory) -> CatalogProduct:
    return CatalogProduct(
        id=product.id,
        name=product.name,
        sku=product.sku,
        description=product.description,
        price_paise=product.price_paise,
        image_url=product.image_url,
        category_id=product.category_id,
        category_name=product.category.name,
        category_color=product.category.color,
        stock=max(inventory.quantity - inventory.reserved_quantity, 0),
        slot_code=inventory.slot_code,
    )


def inventory_out(inventory: Inventory) -> InventoryOut:
    available = max(inventory.quantity - inventory.reserved_quantity, 0)
    return InventoryOut(
        id=inventory.id,
        machine_id=inventory.machine_id,
        product_id=inventory.product_id,
        quantity=inventory.quantity,
        reserved_quantity=inventory.reserved_quantity,
        low_stock_threshold=inventory.low_stock_threshold,
        slot_code=inventory.slot_code,
        updated_at=inventory.updated_at,
        available_quantity=available,
        product_name=inventory.product.name if inventory.product else "",
        product_price_paise=inventory.product.price_paise if inventory.product else 0,
        machine_name=inventory.machine.name if inventory.machine else "",
        is_low_stock=available <= inventory.low_stock_threshold,
    )


def inventory_log_out(log: Any) -> InventoryLogOut:
    return InventoryLogOut(
        id=log.id,
        machine_id=log.machine_id,
        product_id=log.product_id,
        change=log.change,
        reason=log.reason,
        previous_quantity=log.previous_quantity,
        new_quantity=log.new_quantity,
        created_at=log.created_at,
        product_name=log.product.name if log.product else "",
        machine_name=log.machine.name if log.machine else "",
    )


def machine_out(db: Session, machine: Machine) -> MachineOut:
    inventory_rows = db.execute(
        select(
            func.count(Inventory.id),
            func.coalesce(func.sum(Inventory.quantity - Inventory.reserved_quantity), 0),
        ).where(Inventory.machine_id == machine.id)
    ).one()
    low_stock = db.scalar(
        select(func.count(Inventory.id)).where(
            Inventory.machine_id == machine.id,
            Inventory.quantity - Inventory.reserved_quantity
            <= Inventory.low_stock_threshold,
        )
    ) or 0
    open_alerts = db.scalar(
        select(func.count(MachineAlert.id)).where(
            MachineAlert.machine_id == machine.id,
            MachineAlert.is_resolved.is_(False),
            MachineAlert.type != "maintenance",
        )
    ) or 0
    transaction_stats = db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount_paid_paise), 0),
        ).where(
            Transaction.machine_id == machine.id,
            Transaction.current_state == "COMPLETED",
        )
    ).one()
    return MachineOut(
        id=machine.id,
        code=machine.code,
        name=machine.name,
        location=machine.location,
        status=machine.status,
        created_at=machine.created_at,
        updated_at=machine.updated_at,
        inventory_count=int(inventory_rows[0]),
        low_stock_count=int(low_stock),
        open_alerts=int(open_alerts),
        transaction_count=int(transaction_stats[0]),
        revenue_paise=int(transaction_stats[1]),
    )


def alert_out(db: Session, alert: MachineAlert) -> AlertOut:
    return AlertOut(
        id=alert.id,
        machine_id=alert.machine_id,
        severity=alert.severity,
        type=alert.type,
        message=alert.message,
        is_resolved=alert.is_resolved,
        created_at=alert.created_at,
        machine_name=alert.machine.name if alert.machine else "",
    )


def _items(tx: Transaction) -> list[TransactionItemOut]:
    result = []
    for item in tx.items:
        result.append(
            TransactionItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product_name,
                unit_price_paise=item.unit_price_paise,
                quantity=item.quantity,
                line_total_paise=item.line_total_paise,
                image_url=item.product.image_url if item.product else None,
            )
        )
    return result


def _summary_dict(tx: Transaction) -> dict[str, Any]:
    return {
        "id": tx.id,
        "reference": tx.reference,
        "machine_id": tx.machine_id,
        "current_state": tx.current_state,
        "total_paise": tx.total_paise,
        "amount_paid_paise": tx.amount_paid_paise,
        "change_paise": tx.change_paise,
        "payment_method": tx.payment_method,
        "error_message": tx.error_message,
        "started_at": tx.started_at,
        "completed_at": tx.completed_at,
        "stock_reserved": tx.stock_reserved,
        "dispensed": tx.dispensed,
        "version": tx.version,
        "machine_name": tx.machine.name if tx.machine else "",
        "item_count": sum(item.quantity for item in tx.items),
        "item_names": [item.product_name for item in tx.items],
        "is_accepting": tx.current_state in {state.value for state in ACCEPTING_STATES},
    }


def transaction_summary(tx: Transaction) -> TransactionSummary:
    return TransactionSummary(**_summary_dict(tx))


def transaction_detail(tx: Transaction, include_logs: bool = True) -> TransactionDetail:
    data = _summary_dict(tx)
    data["items"] = _items(tx)
    data["payments"] = [PaymentOut.model_validate(payment) for payment in tx.payments]
    data["refunds"] = [RefundOut.model_validate(refund) for refund in tx.refunds]
    data["state_logs"] = (
        [StateLogOut.model_validate(log) for log in tx.state_logs]
        if include_logs
        else []
    )
    return TransactionDetail(**data)
