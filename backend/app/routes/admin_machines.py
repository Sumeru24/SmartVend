from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_staff
from app.database.session import get_db
from app.schemas.machine import (
    AlertOut,
    MachineCreate,
    MachineOut,
    MachineStatusUpdate,
    MachineUpdate,
)
from app.services import machine_service

router = APIRouter(prefix="/admin", tags=["Admin · Machines"])


@router.get("/machines", response_model=list[MachineOut], summary="List machines")
def machines(db: Session = Depends(get_db), _=Depends(require_staff)):
    return machine_service.list_machines(db)


@router.post(
    "/machines",
    response_model=MachineOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a vending machine",
)
def create_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return machine_service.create_machine(db, payload)


@router.get(
    "/machines/{machine_id}",
    response_model=MachineOut,
    summary="Machine detail",
)
def machine(
    machine_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return machine_service.get_machine(db, machine_id)


@router.patch(
    "/machines/{machine_id}",
    response_model=MachineOut,
    summary="Update machine details",
)
def update_machine(
    machine_id: int,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return machine_service.update_machine(db, machine_id, payload)


@router.patch(
    "/machines/{machine_id}/status",
    response_model=MachineOut,
    summary="Start, stop, or place a machine in maintenance",
)
def machine_status(
    machine_id: int,
    payload: MachineStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return machine_service.set_status(db, machine_id, payload)


@router.get("/alerts", response_model=list[AlertOut], summary="Machine alerts")
def alerts(
    resolved: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return machine_service.list_alerts(db, resolved, limit)


@router.post(
    "/alerts/{alert_id}/resolve",
    response_model=AlertOut,
    summary="Resolve a machine alert",
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return machine_service.resolve_alert(db, alert_id)
