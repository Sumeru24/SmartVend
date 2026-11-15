from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.catalog import CatalogResponse
from app.services.transaction_service import get_catalog, list_public_machines

router = APIRouter(prefix="/catalog", tags=["Public Catalog"])


@router.get("", response_model=CatalogResponse, summary="Available products for a machine")
def catalog(machine_id: int | None = None, db: Session = Depends(get_db)):
    return get_catalog(db, machine_id)


@router.get("/machines", summary="Public vending machines and their status")
def public_machines(db: Session = Depends(get_db)):
    machines = list_public_machines(db)
    return [
        {
            "id": machine.id,
            "code": machine.code,
            "name": machine.name,
            "location": machine.location,
            "status": machine.status,
        }
        for machine in machines
    ]
