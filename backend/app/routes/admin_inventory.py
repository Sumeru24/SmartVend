from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_staff
from app.database.session import get_db
from app.models import User
from app.schemas.inventory import (
    InventoryBulkUpsert,
    InventoryLogOut,
    InventoryOut,
    MinThresholdUpdate,
    RestockRequest,
)
from app.services import inventory_service

router = APIRouter(prefix="/admin/inventory", tags=["Admin · Inventory"])


@router.get("", response_model=list[InventoryOut], summary="List live inventory")
def inventory(
    machine_id: int | None = None,
    low_stock: bool = False,
    search: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return inventory_service.list_inventory(db, machine_id, low_stock, search)


@router.get("/summary", summary="Inventory totals and alert counts")
def summary(
    machine_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return inventory_service.inventory_summary(db, machine_id)


@router.get("/logs", summary="Stock movement history")
def logs(
    machine_id: int | None = None,
    product_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return inventory_service.list_logs(db, machine_id, product_id, page, page_size)


@router.post(
    "/{inventory_id}/restock",
    response_model=InventoryOut,
    summary="Restock a SKU",
)
def restock(
    inventory_id: int,
    payload: RestockRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    return inventory_service.restock(db, inventory_id, payload, user.id)


@router.patch(
    "/{inventory_id}/threshold",
    response_model=InventoryOut,
    summary="Update the low-stock threshold",
)
def threshold(
    inventory_id: int,
    payload: MinThresholdUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return inventory_service.set_threshold(db, inventory_id, payload)


@router.post("/bulk", summary="Apply an inventory plan to a machine")
def bulk(
    payload: InventoryBulkUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    return inventory_service.bulk_upsert(db, payload)
