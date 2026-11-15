from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import require_admin, require_staff
from app.database.session import get_db
from app.models import Machine, Refund, Transaction, TransactionItem, User
from app.schemas.transaction import RefundRequest, TransactionDetail
from app.services.serializers import transaction_detail, transaction_summary
from app.services.transaction_service import TRANSACTION_LOAD_OPTIONS, admin_refund

router = APIRouter(prefix="/admin/transactions", tags=["Admin · Transactions"])


@router.get("", summary="Search and filter all transactions")
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    machine_id: int | None = None,
    search: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    filters = []
    if status_filter:
        filters.append(Transaction.current_state == status_filter)
    if machine_id:
        filters.append(Transaction.machine_id == machine_id)
    if from_date:
        filters.append(
            Transaction.started_at
            >= datetime.combine(from_date, time.min, tzinfo=timezone.utc)
        )
    if to_date:
        filters.append(
            Transaction.started_at
            < datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    if search:
        needle = f"%{search.strip()}%"
        filters.append(
            or_(
                Transaction.reference.ilike(needle),
                Transaction.machine.has(Machine.name.ilike(needle)),
                Transaction.items.any(TransactionItem.product_name.ilike(needle)),
            )
        )

    count_query = select(func.count(Transaction.id))
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.machine),
            selectinload(Transaction.items).joinedload(TransactionItem.product),
        )
        .order_by(Transaction.started_at.desc())
    )
    if filters:
        count_query = count_query.where(*filters)
        query = query.where(*filters)
    total = db.scalar(count_query) or 0
    rows = db.scalars(
        query.offset((page - 1) * page_size).limit(page_size)
    ).unique().all()
    pages = max((total + page_size - 1) // page_size, 1)
    return {
        "items": [transaction_summary(tx) for tx in rows],
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/refunds", summary="All processed refunds")
def refunds(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    rows = db.scalars(
        select(Refund)
        .options(
            joinedload(Refund.transaction).joinedload(Transaction.machine),
            joinedload(Refund.transaction).joinedload(Transaction.items),
        )
        .order_by(Refund.created_at.desc())
        .limit(limit)
    ).unique().all()
    return [
        {
            "id": refund.id,
            "transaction_reference": refund.transaction.reference,
            "machine_name": refund.transaction.machine.name if refund.transaction.machine else "",
            "amount_paise": refund.amount_paise,
            "reason": refund.reason,
            "status": refund.status,
            "provider_ref": refund.provider_ref,
            "created_at": refund.created_at,
        }
        for refund in rows
    ]


@router.get(
    "/{reference}",
    response_model=TransactionDetail,
    summary="Full transaction detail, payments, refunds, and FSM logs",
)
def transaction_detail_admin(
    reference: str,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.reference == reference)
        .options(*TRANSACTION_LOAD_OPTIONS)
    )
    from app.services.exceptions import VendingError

    if not transaction:
        raise VendingError("Transaction not found.", 404)
    return transaction_detail(transaction)


@router.post(
    "/{reference}/refund",
    response_model=TransactionDetail,
    summary="Refund a completed purchase through the FSM refund path",
)
def refund_transaction(
    reference: str,
    payload: RefundRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    transaction, _steps = admin_refund(db, reference, payload.reason, user.id)
    return transaction_detail(transaction)
