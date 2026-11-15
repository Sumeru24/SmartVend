from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.automaton import (
    AutomatonError,
    CartItem,
    Event,
    State,
    TransactionContext,
    fsm,
)
from app.models import (
    Inventory,
    InventoryLog,
    Machine,
    MachineAlert,
    Payment,
    Product,
    Refund,
    StateLog,
    Transaction,
    TransactionItem,
)
from app.schemas.transaction import CreateTransactionRequest, PaymentRequest
from app.services.dispenser import dispenser
from app.services.exceptions import VendingError
from app.services.serializers import transaction_detail

TRANSACTION_LOAD_OPTIONS = (
    joinedload(Transaction.machine),
    selectinload(Transaction.items).joinedload(TransactionItem.product),
    selectinload(Transaction.payments),
    selectinload(Transaction.refunds),
    selectinload(Transaction.state_logs),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _reference() -> str:
    return f"SV-{_now():%y%m%d}-{secrets.token_hex(3).upper()}"


def _provider_ref(prefix: str) -> str:
    return f"{prefix}-{_now():%y%m%d%H%M%S}-{secrets.token_hex(4).upper()}"


def _load_transaction(db: Session, reference: str, *, lock: bool = False) -> Transaction:
    query = select(Transaction).where(Transaction.reference == reference)
    if lock:
        query = query.with_for_update()
    transaction = db.scalar(query)
    if not transaction:
        raise VendingError("Transaction not found.", 404, "TRANSACTION_NOT_FOUND")
    return transaction


def _reload_detail(db: Session, transaction: Transaction):
    db.flush()
    loaded = db.scalar(
        select(Transaction)
        .where(Transaction.id == transaction.id)
        .options(*TRANSACTION_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    if not loaded:
        raise VendingError("Transaction not found.", 404)
    return loaded


def _context_for(transaction: Transaction) -> TransactionContext:
    context = TransactionContext(
        transaction_id=transaction.id,
        machine_id=transaction.machine_id,
        items=[
            CartItem(
                product_id=item.product_id,
                name=item.product_name,
                unit_price_paise=item.unit_price_paise,
                quantity=item.quantity,
            )
            for item in transaction.items
        ],
        total_paise=transaction.total_paise,
        balance_paise=transaction.amount_paid_paise,
        change_paise=transaction.change_paise,
        payment_method=transaction.payment_method,
        stock_reserved=transaction.stock_reserved,
        payment_succeeded=transaction.current_state
        in {"PAYMENT_ACCEPTED", "DISPENSING", "CHANGE_RETURN", "COMPLETED"},
        dispensed=transaction.dispensed,
    )
    context.recompute_total()
    return context


def _next_sequence(db: Session, transaction_id: int) -> int:
    current = db.scalar(
        select(func.coalesce(func.max(StateLog.sequence), 0)).where(
            StateLog.transaction_id == transaction_id
        )
    )
    return int(current or 0) + 1


def _apply_transition(
    db: Session,
    transaction: Transaction,
    context: TransactionContext,
    event: Event,
    payload: dict | None = None,
) -> dict:
    try:
        result = fsm.step(transaction.current_state, event, context, payload or {})
    except AutomatonError as exc:
        raise VendingError(
            exc.reason,
            409,
            f"FSM_{exc.__class__.__name__.replace('Error', '').upper()}",
        ) from exc

    sequence = _next_sequence(db, transaction.id)
    db.add(
        StateLog(
            transaction_id=transaction.id,
            machine_id=transaction.machine_id,
            previous_state=result.source.value,
            event=result.event.value,
            next_state=result.target.value if result.target else None,
            accepted=True,
            reason=result.reason,
            sequence=sequence,
            context_snapshot={
                "balance_paise": context.balance_paise,
                "total_paise": context.total_paise,
                "change_paise": context.change_paise,
                "stock_reserved": context.stock_reserved,
                "payment_method": context.payment_method,
            },
            created_at=result.timestamp,
        )
    )
    transaction.current_state = result.target.value
    transaction.version += 1
    db.flush()
    return {
        "accepted": True,
        "source": result.source.value,
        "event": result.event.value,
        "target": result.target.value if result.target else None,
        "reason": result.reason,
        "description": result.description,
        "sequence": sequence,
        "timestamp": result.timestamp,
    }


def _reserve_stock(
    db: Session, machine_id: int, items: list[CartItem]
) -> tuple[bool, str]:
    reserved_products: list[tuple[int, int]] = []
    for item in items:
        rowcount = db.execute(
            update(Inventory)
            .where(
                Inventory.machine_id == machine_id,
                Inventory.product_id == item.product_id,
                Inventory.quantity - Inventory.reserved_quantity >= item.quantity,
            )
            .values(
                reserved_quantity=Inventory.reserved_quantity + item.quantity,
                updated_at=_now(),
            )
        ).rowcount
        if not rowcount:
            for product_id, quantity in reserved_products:
                db.execute(
                    update(Inventory)
                    .where(
                        Inventory.machine_id == machine_id,
                        Inventory.product_id == product_id,
                    )
                    .values(
                        reserved_quantity=func.max(
                            Inventory.reserved_quantity - quantity, 0
                        )
                    )
                )
            return False, f"{item.name} does not have enough available stock."
        reserved_products.append((item.product_id, item.quantity))
    return True, "All requested products are available and reserved."


def _release_stock(db: Session, transaction: Transaction, reason: str) -> None:
    if not transaction.stock_reserved:
        return
    for item in transaction.items:
        db.execute(
            update(Inventory)
            .where(
                Inventory.machine_id == transaction.machine_id,
                Inventory.product_id == item.product_id,
            )
            .values(
                reserved_quantity=func.max(
                    Inventory.reserved_quantity - item.quantity, 0
                ),
                updated_at=_now(),
            )
        )
    transaction.stock_reserved = False
    db.flush()


def _deduct_stock(db: Session, transaction: Transaction) -> tuple[bool, str]:
    # Validate every row under a lock before mutating anything. This makes the
    # multi-line deduction atomic even if one line is inconsistent.
    rows: list[tuple[TransactionItem, Inventory]] = []
    for item in transaction.items:
        inventory = db.scalar(
            select(Inventory)
            .where(
                Inventory.machine_id == transaction.machine_id,
                Inventory.product_id == item.product_id,
            )
            .with_for_update()
        )
        if (
            not inventory
            or inventory.quantity < item.quantity
            or inventory.reserved_quantity < item.quantity
        ):
            return False, f"Reserved inventory for {item.product_name} is inconsistent."
        rows.append((item, inventory))

    for item, inventory in rows:
        previous = inventory.quantity
        inventory.quantity -= item.quantity
        inventory.reserved_quantity -= item.quantity
        inventory.updated_at = _now()
        db.add(
            InventoryLog(
                machine_id=transaction.machine_id,
                product_id=item.product_id,
                change=-item.quantity,
                reason="Purchase dispensed",
                previous_quantity=previous,
                new_quantity=inventory.quantity,
                transaction_id=transaction.id,
            )
        )
        if inventory.quantity <= inventory.low_stock_threshold:
            existing_alert = db.scalar(
                select(MachineAlert).where(
                    MachineAlert.machine_id == transaction.machine_id,
                    MachineAlert.type.in_(["low_stock", "out_of_stock"]),
                    MachineAlert.message.like(f"{item.product_name}%"),
                    MachineAlert.is_resolved.is_(False),
                )
            )
            if not existing_alert:
                is_empty = inventory.quantity == 0
                db.add(
                    MachineAlert(
                        machine_id=transaction.machine_id,
                        severity="critical" if is_empty else "warning",
                        type="out_of_stock" if is_empty else "low_stock",
                        message=(
                            f"{item.product_name} is out of stock."
                            if is_empty
                            else f"{item.product_name} is low ({inventory.quantity} left)."
                        ),
                    )
                )
    transaction.stock_reserved = False
    db.flush()
    return True, "Inventory committed."


def _create_refund(
    db: Session,
    transaction: Transaction,
    amount_paise: int,
    reason: str,
    user_id: int | None = None,
) -> Refund | None:
    if amount_paise <= 0:
        return None
    captured = [p for p in transaction.payments if p.status == "captured"]
    refund = Refund(
        transaction_id=transaction.id,
        payment_id=captured[0].id if captured else None,
        amount_paise=amount_paise,
        reason=reason,
        status="processed",
        processed_by_id=user_id,
        provider_ref=_provider_ref("SIM-RFND"),
    )
    for payment in captured:
        payment.status = "refunded"
    db.add(refund)
    db.flush()
    return refund


def _finish_with_refund(
    db: Session,
    transaction: Transaction,
    context: TransactionContext,
    steps: list[dict],
    reason: str,
    user_id: int | None = None,
    refund_amount: int | None = None,
) -> None:
    _release_stock(db, transaction, reason)
    amount = context.balance_paise if refund_amount is None else refund_amount
    _create_refund(db, transaction, amount, reason, user_id=user_id)
    steps.append(
        _apply_transition(
            db,
            transaction,
            context,
            Event.PROCESS_REFUND,
            {"reason": reason},
        )
    )
    transaction.completed_at = _now()


def _common_tx_fields(transaction: Transaction, context: TransactionContext) -> None:
    transaction.amount_paid_paise = context.balance_paise
    transaction.change_paise = context.change_paise
    transaction.error_message = context.error_message


def get_catalog(db: Session, machine_id: int | None = None):
    machine = None
    if machine_id:
        machine = db.get(Machine, machine_id)
        if not machine:
            raise VendingError("Vending machine not found.", 404)
    else:
        machine = db.scalar(
            select(Machine).where(Machine.status == "online").order_by(Machine.id)
        )
    if not machine:
        raise VendingError("No vending machine is available.", 503)
    rows = db.execute(
        select(Product, Inventory)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(
            Inventory.machine_id == machine.id,
            Product.is_active.is_(True),
        )
        .order_by(Product.category_id, Product.name)
    ).all()
    from app.services.serializers import catalog_product

    products = [catalog_product(product, inventory) for product, inventory in rows]
    return {
        "machine_id": machine.id,
        "machine_name": machine.name,
        "machine_code": machine.code,
        "machine_status": machine.status,
        "products": products,
    }


def list_public_machines(db: Session):
    return db.scalars(select(Machine).order_by(Machine.name)).all()


def create_transaction(
    db: Session,
    request: CreateTransactionRequest,
    idempotency_key: str | None = None,
    user_id: int | None = None,
) -> tuple[Transaction, list[dict], bool]:
    key = request.idempotency_key or idempotency_key
    if key:
        existing = db.scalar(
            select(Transaction).where(Transaction.idempotency_key == key)
        )
        if existing:
            transaction = _reload_detail(db, existing)
            return transaction, [], True

    machine = db.get(Machine, request.machine_id) if request.machine_id else db.scalar(
        select(Machine).where(Machine.status == "online").order_by(Machine.id)
    )
    if not machine:
        raise VendingError("Select an available vending machine.", 404)
    if machine.status != "online":
        raise VendingError(
            f"{machine.name} is {machine.status} and cannot accept purchases.",
            423,
            "MACHINE_UNAVAILABLE",
        )

    products = {
        product.id: product
        for product in db.scalars(
            select(Product).where(
                Product.id.in_([line.product_id for line in request.items]),
                Product.is_active.is_(True),
            )
        ).all()
    }
    if len(products) != len(request.items):
        raise VendingError("One or more selected products are unavailable.", 400)

    items: list[CartItem] = []
    for line in request.items:
        product = products[line.product_id]
        items.append(
            CartItem(
                product_id=product.id,
                name=product.name,
                unit_price_paise=product.price_paise,
                quantity=line.quantity,
            )
        )
    total = sum(item.line_total_paise for item in items)

    transaction = Transaction(
        reference=_reference(),
        machine_id=machine.id,
        user_id=user_id,
        current_state=State.IDLE.value,
        total_paise=total,
        amount_paid_paise=0,
        change_paise=0,
        idempotency_key=key,
    )
    db.add(transaction)
    db.flush()
    cart_items = []
    for item in items:
        transaction_item = TransactionItem(
            transaction_id=transaction.id,
            product_id=item.product_id,
            product_name=item.name,
            unit_price_paise=item.unit_price_paise,
            quantity=item.quantity,
            line_total_paise=item.line_total_paise,
        )
        db.add(transaction_item)
        cart_items.append(item)
    db.flush()

    context = TransactionContext(
        transaction_id=transaction.id,
        machine_id=machine.id,
        items=cart_items,
        total_paise=total,
    )
    steps: list[dict] = []
    steps.append(
        _apply_transition(
            db,
            transaction,
            context,
            Event.SELECT_PRODUCT,
            {
                "items": [
                    {
                        "product_id": item.product_id,
                        "name": item.name,
                        "unit_price_paise": item.unit_price_paise,
                        "quantity": item.quantity,
                    }
                    for item in items
                ]
            },
        )
    )
    steps.append(
        _apply_transition(db, transaction, context, Event.CONFIRM_PRODUCT)
    )

    available, reason = _reserve_stock(db, machine.id, items)
    if available:
        context.stock_reserved = True
        transaction.stock_reserved = True
        steps.append(
            _apply_transition(db, transaction, context, Event.STOCK_AVAILABLE)
        )
    else:
        transaction.error_message = reason
        steps.append(
            _apply_transition(
                db, transaction, context, Event.STOCK_UNAVAILABLE, {"reason": reason}
            )
        )

    transaction.total_paise = total
    transaction.amount_paid_paise = context.balance_paise
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise VendingError(
            "The transaction could not be created. Please retry.",
            500,
            "TRANSACTION_ROLLBACK",
        )
    transaction = _reload_detail(db, transaction)
    return transaction, steps, False


def add_payment(
    db: Session,
    reference: str,
    request: PaymentRequest,
    idempotency_key: str | None = None,
) -> tuple[Transaction, list[dict]]:
    key = request.idempotency_key or idempotency_key
    if key:
        existing_payment = db.scalar(
            select(Payment).where(Payment.idempotency_key == key)
        )
        if existing_payment:
            transaction = _load_transaction(db, reference)
            if existing_payment.transaction_id != transaction.id:
                raise VendingError(
                    "This idempotency key was already used by another payment.",
                    409,
                    "IDEMPOTENCY_CONFLICT",
                )
            return _reload_detail(db, transaction), []

    transaction = _load_transaction(db, reference, lock=True)
    if transaction.current_state != State.PAYMENT_PENDING.value:
        raise VendingError(
            f"Payment is not allowed while the transaction is {transaction.current_state}.",
            409,
            "PAYMENT_NOT_ALLOWED",
        )
    context = _context_for(transaction)
    steps: list[dict] = []

    if request.method == "upi":
        if request.amount_paise is None:
            amount = context.amount_due_paise
        else:
            amount = request.amount_paise
        if amount <= 0:
            raise VendingError("The simulated UPI amount must be positive.", 400)

        payment = Payment(
            transaction_id=transaction.id,
            method="upi",
            amount_paise=amount,
            status="captured",
            provider_ref=_provider_ref("SIM-UPI"),
            idempotency_key=key,
            is_simulated=True,
        )
        db.add(payment)
        db.flush()

        if request.simulate_failure:
            payment.status = "failed"
            transaction.payment_method = "upi"
            steps.append(
                _apply_transition(
                    db,
                    transaction,
                    context,
                    Event.PAYMENT_FAILED,
                    {
                        "reason": "The simulated UPI payment was declined by the payment gateway."
                    },
                )
            )
            _common_tx_fields(transaction, context)
            if transaction.current_state == State.REFUNDING.value:
                _finish_with_refund(
                    db,
                    transaction,
                    context,
                    steps,
                    "UPI failed after cash insertion; returning all captured funds.",
                )
            else:
                _release_stock(db, transaction, "Payment failed.")
                transaction.completed_at = _now()
            db.commit()
            return _reload_detail(db, transaction), steps

        if context.balance_paise + amount < context.total_paise:
            raise VendingError(
                "The UPI amount does not cover the outstanding balance.",
                400,
                "INSUFFICIENT_AMOUNT",
            )
        context.balance_paise += amount
        context.payment_method = "upi"
        steps.append(
            _apply_transition(
                db,
                transaction,
                context,
                Event.PAYMENT_SUCCESS,
                {"amount_paise": amount, "vpa": request.upi_vpa or "demo@smartvend"},
            )
        )
        transaction.payment_method = "upi"
    else:
        if not request.amount_paise:
            raise VendingError("Insert a valid denomination amount.", 400)
        event = Event.INSERT_COIN if request.method == "coin" else Event.INSERT_NOTE
        context.payment_method = "cash" if not context.balance_paise else context.payment_method
        steps.append(
            _apply_transition(
                db,
                transaction,
                context,
                event,
                {"amount_paise": request.amount_paise, "kind": request.method},
            )
        )
        db.add(
            Payment(
                transaction_id=transaction.id,
                method=request.method,
                amount_paise=request.amount_paise,
                status="captured",
                provider_ref=_provider_ref("SIM-CASH"),
                idempotency_key=key,
                is_simulated=True,
            )
        )
        transaction.payment_method = "cash" if not transaction.payment_method or transaction.payment_method == "cash" else transaction.payment_method
        if context.balance_paise >= context.total_paise:
            steps.append(
                _apply_transition(
                    db, transaction, context, Event.SUFFICIENT_AMOUNT
                )
            )
        else:
            steps.append(
                _apply_transition(
                    db, transaction, context, Event.INSUFFICIENT_AMOUNT
                )
            )

    _common_tx_fields(transaction, context)
    transaction.payment_method = context.payment_method
    db.flush()
    # Derive a useful aggregate method label if the customer mixed methods.
    methods = {payment.method for payment in transaction.payments if payment.status == "captured"}
    if len(methods) > 1:
        transaction.payment_method = "mixed"
    elif methods:
        only = next(iter(methods))
        transaction.payment_method = "cash" if only in {"coin", "note"} else only
    db.commit()
    return _reload_detail(db, transaction), steps


def dispense(
    db: Session,
    reference: str,
    simulate_failure: bool = False,
    failure_reason: str | None = None,
    idempotency_key: str | None = None,
) -> tuple[Transaction, list[dict], bool]:
    transaction = _load_transaction(db, reference, lock=True)
    if transaction.dispensed:
        return _reload_detail(db, transaction), [], True
    if (
        idempotency_key
        and transaction.dispense_idempotency_key
        and transaction.dispense_idempotency_key == idempotency_key
    ):
        return _reload_detail(db, transaction), [], True
    if transaction.current_state != State.PAYMENT_ACCEPTED.value:
        raise VendingError(
            f"Dispensing is not allowed while the transaction is {transaction.current_state}.",
            409,
            "DISPENSE_NOT_ALLOWED",
        )

    if idempotency_key:
        existing = db.scalar(
            select(Transaction).where(
                Transaction.dispense_idempotency_key == idempotency_key,
                Transaction.id != transaction.id,
            )
        )
        if existing:
            raise VendingError(
                "This dispensing idempotency key is already in use.",
                409,
                "IDEMPOTENCY_CONFLICT",
            )

    context = _context_for(transaction)
    steps: list[dict] = []
    transaction.dispense_idempotency_key = idempotency_key
    steps.append(
        _apply_transition(db, transaction, context, Event.DISPENSE_PRODUCT)
    )

    hardware = dispenser.dispense(
        machine_id=transaction.machine_id,
        items=context.items,
        fail=simulate_failure,
    )

    if hardware.success:
        committed, reason = _deduct_stock(db, transaction)
        if not committed:
            hardware_failed = True
            failure_message = reason
            simulate_failure = True
        else:
            hardware_failed = False
            failure_message = hardware.message
    else:
        hardware_failed = True
        failure_message = hardware.message

    if not hardware_failed:
        transaction.dispensed = True
        steps.append(
            _apply_transition(
                db,
                transaction,
                context,
                Event.DISPENSE_SUCCESS,
                {"hardware_reference": hardware.reference},
            )
        )
        steps.append(
            _apply_transition(
                db, transaction, context, Event.RETURN_CHANGE, {"hardware_reference": hardware.reference}
            )
        )
        transaction.completed_at = _now()
    else:
        transaction.error_message = failure_reason or failure_message
        steps.append(
            _apply_transition(
                db,
                transaction,
                context,
                Event.DISPENSE_FAILURE,
                {"reason": transaction.error_message},
            )
        )
        _finish_with_refund(
            db,
            transaction,
            context,
            steps,
            f"Dispense failure: {transaction.error_message}",
        )

    _common_tx_fields(transaction, context)
    db.commit()
    return _reload_detail(db, transaction), steps, False


def cancel_transaction(
    db: Session,
    reference: str,
    reason: str,
    user_id: int | None = None,
) -> tuple[Transaction, list[dict]]:
    transaction = _load_transaction(db, reference, lock=True)
    if transaction.current_state in {
        State.CANCELLED.value,
        State.COMPLETED.value,
        State.REFUNDING.value,
        State.DISPENSING.value,
    }:
        raise VendingError(
            f"Cannot cancel a transaction in {transaction.current_state}.",
            409,
            "CANCEL_NOT_ALLOWED",
        )
    context = _context_for(transaction)
    steps = [
        _apply_transition(
            db,
            transaction,
            context,
            Event.CANCEL_TRANSACTION,
            {"reason": reason},
        )
    ]
    _release_stock(db, transaction, reason)
    if transaction.current_state == State.REFUNDING.value:
        _finish_with_refund(db, transaction, context, steps, reason, user_id=user_id)
    else:
        transaction.completed_at = _now()
    _common_tx_fields(transaction, context)
    db.commit()
    return _reload_detail(db, transaction), steps


def reset_transaction(db: Session, reference: str) -> tuple[Transaction, list[dict]]:
    transaction = _load_transaction(db, reference, lock=True)
    context = _context_for(transaction)
    steps = [_apply_transition(db, transaction, context, Event.RESET_MACHINE)]
    db.commit()
    return _reload_detail(db, transaction), steps


def admin_refund(
    db: Session,
    reference: str,
    reason: str,
    user_id: int,
) -> tuple[Transaction, list[dict]]:
    transaction = _load_transaction(db, reference, lock=True)
    existing_refunds = db.scalar(
        select(func.count(Refund.id)).where(Refund.transaction_id == transaction.id)
    ) or 0
    if transaction.current_state == State.CANCELLED.value and existing_refunds:
        return _reload_detail(db, transaction), []

    if transaction.current_state != State.COMPLETED.value:
        raise VendingError(
            "Only completed purchases can be refunded through this endpoint.",
            409,
            "REFUND_NOT_ALLOWED",
        )
    if transaction.amount_paid_paise <= 0:
        raise VendingError("There are no captured funds to refund.", 409)

    context = _context_for(transaction)
    steps = [
        _apply_transition(
            db,
            transaction,
            context,
            Event.CANCEL_TRANSACTION,
            {"reason": reason},
        )
    ]
    refund_amount = min(transaction.total_paise, transaction.amount_paid_paise)
    _create_refund(db, transaction, refund_amount, reason, user_id=user_id)
    steps.append(
        _apply_transition(
            db,
            transaction,
            context,
            Event.PROCESS_REFUND,
            {"reason": f"₹{refund_amount / 100:,.2f} refunded in simulation."},
        )
    )
    _common_tx_fields(transaction, context)
    transaction.completed_at = _now()
    db.commit()
    return _reload_detail(db, transaction), steps


def get_transaction(db: Session, reference: str) -> Transaction:
    transaction = db.scalar(
        select(Transaction)
        .where(Transaction.reference == reference)
        .options(*TRANSACTION_LOAD_OPTIONS)
    )
    if not transaction:
        raise VendingError("Transaction not found.", 404)
    return transaction


def public_transaction_payload(transaction: Transaction) -> dict:
    return transaction_detail(transaction).model_dump(mode="json")


def public_history(db: Session, references: list[str]) -> list:
    if not references:
        return []
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.reference.in_(references[:30]))
        .options(*TRANSACTION_LOAD_OPTIONS)
        .order_by(Transaction.started_at.desc())
    ).all()
    return list(transactions)
