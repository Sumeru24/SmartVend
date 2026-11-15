from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Header, Query, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.transaction import (
    CancelRequest,
    CreateTransactionRequest,
    DispenseRequest,
    PaymentRequest,
    ReceiptOut,
    TransactionActionResponse,
    TransactionCreatedResponse,
    TransactionDetail,
    TransactionSummary,
    TransitionResultOut,
)
from app.services.serializers import transaction_detail, transaction_summary
from app.services.transaction_service import (
    add_payment,
    cancel_transaction,
    create_transaction,
    dispense,
    get_transaction,
    public_history,
    reset_transaction,
)

router = APIRouter(prefix="/transactions", tags=["Customer Transactions"])


def _transitions(steps: list[dict]) -> list[TransitionResultOut]:
    return [TransitionResultOut(**step) for step in steps]


@router.get(
    "/history",
    response_model=list[TransactionSummary],
    summary="Fetch transaction history for receipt references",
)
def history(
    refs: str = Query(default="", max_length=1500),
    db: Session = Depends(get_db),
):
    references = [ref.strip() for ref in refs.split(",") if ref.strip()]
    rows = public_history(db, references)
    return [transaction_summary(transaction) for transaction in rows]


@router.post(
    "",
    response_model=TransactionCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a cart and execute selection → inventory checks through the FSM",
)
def create(
    payload: CreateTransactionRequest,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
):
    transaction, steps, replayed = create_transaction(
        db, payload, idempotency_key=idempotency_key
    )
    detail = transaction_detail(transaction)
    if replayed:
        response.status_code = status.HTTP_200_OK
    return TransactionCreatedResponse(
        **detail.model_dump(), transitions=_transitions(steps)
    )


@router.get(
    "/{reference}",
    response_model=TransactionDetail,
    summary="Current transaction status and complete state-transition log",
)
def detail(reference: str, db: Session = Depends(get_db)):
    transaction = get_transaction(db, reference)
    return transaction_detail(transaction)


@router.get(
    "/{reference}/receipt",
    response_model=ReceiptOut,
    summary="Generate a digital receipt",
)
def receipt(reference: str, db: Session = Depends(get_db)):
    transaction = get_transaction(db, reference)
    detail_data = transaction_detail(transaction)
    return ReceiptOut(
        reference=transaction.reference,
        issued_at=transaction.completed_at or datetime.now(timezone.utc),
        machine_name=transaction.machine.name,
        machine_location=transaction.machine.location,
        items=detail_data.items,
        subtotal_paise=sum(item.line_total_paise for item in detail_data.items),
        total_paise=transaction.total_paise,
        amount_paid_paise=transaction.amount_paid_paise,
        change_paise=transaction.change_paise,
        payment_method=transaction.payment_method,
        status=transaction.current_state,
        simulated_dispense=True,
    )


@router.post(
    "/{reference}/payments",
    response_model=TransactionActionResponse,
    summary="Insert simulated cash or complete a simulated UPI payment",
)
def pay(
    reference: str,
    payload: PaymentRequest,
    idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
):
    transaction, steps = add_payment(
        db, reference, payload, idempotency_key=idempotency_key
    )
    return TransactionActionResponse(
        transaction=transaction_detail(transaction), transitions=_transitions(steps)
    )


@router.post(
    "/{reference}/dispense",
    response_model=TransactionActionResponse,
    summary="Dispense through the simulated adapter and finalize the transaction",
)
def run_dispense(
    reference: str,
    payload: DispenseRequest = Body(default_factory=DispenseRequest),
    idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db),
):
    transaction, steps, replayed = dispense(
        db,
        reference,
        simulate_failure=payload.simulate_failure,
        failure_reason=payload.failure_reason,
        idempotency_key=payload.idempotency_key or idempotency_key,
    )
    return TransactionActionResponse(
        transaction=transaction_detail(transaction), transitions=_transitions(steps)
    )


@router.post(
    "/{reference}/cancel",
    response_model=TransactionActionResponse,
    summary="Cancel/refund a transaction through the FSM",
)
def cancel(
    reference: str,
    payload: CancelRequest,
    db: Session = Depends(get_db),
):
    transaction, steps = cancel_transaction(db, reference, payload.reason)
    return TransactionActionResponse(
        transaction=transaction_detail(transaction), transitions=_transitions(steps)
    )


@router.post(
    "/{reference}/reset",
    response_model=TransactionActionResponse,
    summary="RESET_MACHINE back to IDLE from a terminal state",
)
def reset(reference: str, db: Session = Depends(get_db)):
    transaction, steps = reset_transaction(db, reference)
    return TransactionActionResponse(
        transaction=transaction_detail(transaction), transitions=_transitions(steps)
    )
