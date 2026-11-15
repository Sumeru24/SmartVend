from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Machine, MachineAlert, StateLog
from app.schemas.machine import MachineCreate, MachineStatusUpdate, MachineUpdate
from app.services.exceptions import VendingError
from app.services.serializers import alert_out, machine_out


def list_machines(db: Session):
    machines = db.scalars(select(Machine).order_by(Machine.name)).all()
    return [machine_out(db, machine) for machine in machines]


def get_machine(db: Session, machine_id: int):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise VendingError("Vending machine not found.", 404)
    return machine_out(db, machine)


def create_machine(db: Session, payload: MachineCreate):
    if db.scalar(select(Machine).where(func.lower(Machine.code) == payload.code.lower())):
        raise VendingError("A machine with this code already exists.", 409)
    machine = Machine(
        code=payload.code.upper(),
        name=payload.name,
        location=payload.location,
        status=payload.status,
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine_out(db, machine)


def update_machine(db: Session, machine_id: int, payload: MachineUpdate):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise VendingError("Vending machine not found.", 404)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(machine, field, value)
    db.commit()
    return machine_out(db, machine)


def _machine_transition_log(
    db: Session, machine: Machine, event: str, previous: str, target: str
) -> None:
    sequence = (db.scalar(
        select(func.coalesce(func.max(StateLog.sequence), 0)).where(
            StateLog.machine_id == machine.id,
            StateLog.transaction_id.is_(None),
        )
    ) or 0) + 1
    db.add(
        StateLog(
            transaction_id=None,
            machine_id=machine.id,
            previous_state=previous,
            event=event,
            next_state=target,
            accepted=True,
            reason="Machine-level service mode transition.",
            sequence=sequence,
        )
    )


def set_status(db: Session, machine_id: int, payload: MachineStatusUpdate):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise VendingError("Vending machine not found.", 404)
    previous = machine.status
    if previous == payload.status:
        return machine_out(db, machine)

    machine.status = payload.status
    machine.last_heartbeat = datetime.now(timezone.utc).isoformat()

    if payload.status == "maintenance":
        _machine_transition_log(
            db, machine, "ENTER_MAINTENANCE", "IDLE", "MAINTENANCE"
        )
        db.add(
            MachineAlert(
                machine_id=machine.id,
                severity="info",
                type="maintenance",
                message=payload.reason or "Machine entered maintenance mode.",
            )
        )
    elif previous == "maintenance" and payload.status == "online":
        _machine_transition_log(
            db, machine, "EXIT_MAINTENANCE", "MAINTENANCE", "IDLE"
        )
        for alert in db.scalars(
            select(MachineAlert).where(
                MachineAlert.machine_id == machine.id,
                MachineAlert.type == "maintenance",
                MachineAlert.is_resolved.is_(False),
            )
        ).all():
            alert.is_resolved = True
    elif payload.status == "error":
        db.add(
            MachineAlert(
                machine_id=machine.id,
                severity="critical",
                type="machine_error",
                message=payload.reason or "Machine reported an error.",
            )
        )
    machine.updated_at = datetime.now(timezone.utc)
    db.commit()
    return machine_out(db, machine)


def list_alerts(db: Session, resolved: bool | None = None, limit: int = 100):
    query = (
        select(MachineAlert)
        .options(joinedload(MachineAlert.machine))
        .order_by(MachineAlert.created_at.desc())
        .limit(limit)
    )
    if resolved is not None:
        query = query.where(MachineAlert.is_resolved.is_(resolved))
    return [alert_out(db, alert) for alert in db.scalars(query).unique().all()]


def resolve_alert(db: Session, alert_id: int):
    alert = db.get(MachineAlert, alert_id)
    if not alert:
        raise VendingError("Alert not found.", 404)
    alert.is_resolved = True
    db.commit()
    db.refresh(alert)
    return alert_out(db, alert)
