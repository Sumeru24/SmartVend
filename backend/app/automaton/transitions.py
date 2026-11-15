"""δ — the deterministic SmartVend transition function.

Each (source state, input event) pair maps to at most one transition. A few
edges use EFSM guards to choose between two *mutually exclusive* targets (for
example, cancelling with no funds paid goes to CANCELLED, while cancelling with
captured funds goes to REFUNDING). The transition function is still
deterministic for a given extended context.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.automaton.events import Event
from app.automaton.exceptions import GuardRejectedError, InvalidTransitionError
from app.automaton.states import State
from app.automaton.transaction_context import (
    COIN_DENOMINATIONS,
    NOTE_DENOMINATIONS,
    TransactionContext,
)

Guard = Callable[[TransactionContext, dict[str, Any]], tuple[bool, str]]
Action = Callable[[TransactionContext, dict[str, Any]], None]


@dataclass(frozen=True)
class Transition:
    source: State
    event: Event
    target: State | None = None
    dynamic_target: Callable[[TransactionContext], State] | None = None
    guard: Guard | None = None
    action: Action | None = None
    description: str = ""
    possible_targets: tuple[State, ...] = ()

    def resolve_target(self, context: TransactionContext) -> State:
        if self.dynamic_target:
            return self.dynamic_target(context)
        assert self.target is not None
        return self.target

    def evaluate(
        self, context: TransactionContext, payload: dict[str, Any]
    ) -> tuple[bool, str]:
        if not self.guard:
            return True, "Guard passed (no precondition)."
        return self.guard(context, payload)


def _cancel_target(context: TransactionContext) -> State:
    return State.REFUNDING if context.balance_paise > 0 else State.CANCELLED


def _payment_failure_target(context: TransactionContext) -> State:
    return State.REFUNDING if context.balance_paise > 0 else State.ERROR


def _guard_valid_insert(ctx: TransactionContext, payload: dict[str, Any]) -> tuple[bool, str]:
    amount = int(payload.get("amount_paise", 0))
    if amount <= 0:
        return False, "The inserted amount must be greater than zero."
    return True, "The inserted denomination is positive."


def _guard_coin(ctx: TransactionContext, payload: dict[str, Any]) -> tuple[bool, str]:
    amount = int(payload.get("amount_paise", 0))
    if amount not in COIN_DENOMINATIONS:
        return False, f"₹{amount / 100:.2f} is not an accepted coin denomination."
    return True, "Accepted coin denomination."


def _guard_note(ctx: TransactionContext, payload: dict[str, Any]) -> tuple[bool, str]:
    amount = int(payload.get("amount_paise", 0))
    if amount not in NOTE_DENOMINATIONS:
        return False, f"₹{amount / 100:.2f} is not an accepted note denomination."
    return True, "Accepted note denomination."


def _guard_funds_sufficient(
    ctx: TransactionContext, payload: dict[str, Any]
) -> tuple[bool, str]:
    if ctx.total_paise <= 0:
        return False, "A cart total is required before accepting payment."
    if ctx.balance_paise < ctx.total_paise:
        due = ctx.total_paise - ctx.balance_paise
        return False, f"Insufficient funds: ₹{due / 100:.2f} is still due."
    return True, "The inserted balance covers the total."


def _guard_funds_insufficient(
    ctx: TransactionContext, payload: dict[str, Any]
) -> tuple[bool, str]:
    if ctx.balance_paise >= ctx.total_paise:
        return False, "The balance already covers the total; use SUFFICIENT_AMOUNT."
    return True, "The balance remains below the total; stay in PAYMENT_PENDING."


def _guard_empty_cart(ctx: TransactionContext, payload: dict[str, Any]) -> tuple[bool, str]:
    if not ctx.items:
        return False, "Select at least one product before confirming."
    if any(item.quantity <= 0 for item in ctx.items):
        return False, "Every cart line must have a quantity of at least one."
    if any(item.unit_price_paise < 0 for item in ctx.items):
        return False, "Product prices cannot be negative."
    return True, "The cart contains valid line items."


def _guard_payment_accepted(
    ctx: TransactionContext, payload: dict[str, Any]
) -> tuple[bool, str]:
    if ctx.balance_paise < ctx.total_paise:
        return False, "Dispensing requires fully accepted payment."
    return True, "Payment has been accepted in full."


def _guard_refundable(
    ctx: TransactionContext, payload: dict[str, Any]
) -> tuple[bool, str]:
    if ctx.balance_paise <= 0:
        return False, "There are no captured funds to refund."
    return True, "Captured funds are available to refund."


def _guard_not_refunded(
    ctx: TransactionContext, payload: dict[str, Any]
) -> tuple[bool, str]:
    if ctx.refunded_paise >= ctx.balance_paise > 0:
        return False, "This transaction has already been refunded."
    return True, "Refund amount is available."


# --- actions ---------------------------------------------------------------

def _insert_money(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    amount = int(payload["amount_paise"])
    ctx.balance_paise += amount
    ctx.inserted_denominations.append(
        {
            "kind": payload.get("kind", "cash"),
            "amount_paise": amount,
            "method": ctx.payment_method or "cash",
        }
    )


def _mark_sufficient(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.payment_succeeded = True
    ctx.error_message = None
    ctx.notes.append("Payment accepted; dispensing unlocked.")


def _mark_upi(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.payment_method = "upi"
    ctx.payment_succeeded = True


def _payment_failed(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.payment_succeeded = False
    ctx.error_message = str(payload.get("reason") or "The simulated payment failed.")


def _dispense_success(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.dispensed = True
    ctx.change_paise = max(ctx.balance_paise - ctx.total_paise, 0)
    ctx.notes.append("Dispensing adapter confirmed product release.")


def _dispense_failure(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.dispensed = False
    ctx.error_message = str(
        payload.get("reason") or "The dispensing adapter reported a failure."
    )


def _refund(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.refunded_paise = ctx.balance_paise
    ctx.notes.append("Captured funds refunded to the original payment method.")


def _cancel(ctx: TransactionContext, payload: dict[str, Any]) -> None:
    ctx.error_message = None
    if ctx.balance_paise:
        ctx.notes.append("Cancellation requested with captured funds; refund required.")
    else:
        ctx.notes.append("Transaction cancelled before any funds were captured.")


TRANSITIONS: list[Transition] = [
    # Selection
    Transition(
        State.IDLE,
        Event.SELECT_PRODUCT,
        State.PRODUCT_SELECTED,
        guard=_guard_empty_cart,
        description="A valid cart is attached to the EFSM context.",
    ),
    Transition(
        State.PRODUCT_SELECTED,
        Event.CONFIRM_PRODUCT,
        State.INVENTORY_CHECK,
        guard=_guard_empty_cart,
        description="The customer confirms the cart; inventory must now be checked.",
    ),
    Transition(
        State.PRODUCT_SELECTED,
        Event.CHECK_STOCK,
        State.INVENTORY_CHECK,
        guard=_guard_empty_cart,
        description="Explicit stock-check command; equivalent to confirming the cart.",
    ),
    Transition(
        State.PRODUCT_SELECTED,
        Event.CANCEL_TRANSACTION,
        State.CANCELLED,
        action=_cancel,
        description="The transaction is cancelled before stock is reserved.",
    ),
    Transition(
        State.INVENTORY_CHECK,
        Event.STOCK_AVAILABLE,
        State.PAYMENT_PENDING,
        description="Every line is in stock and has been atomically reserved.",
    ),
    Transition(
        State.INVENTORY_CHECK,
        Event.STOCK_UNAVAILABLE,
        State.OUT_OF_STOCK,
        description="At least one line lacks stock; no reservation remains.",
    ),
    Transition(
        State.INVENTORY_CHECK,
        Event.CANCEL_TRANSACTION,
        State.CANCELLED,
        action=_cancel,
        description="Cancellation while inventory is being evaluated.",
    ),
    Transition(
        State.OUT_OF_STOCK,
        Event.RESET_MACHINE,
        State.IDLE,
        description="Acknowledge the stock failure and reset the machine.",
    ),
    Transition(
        State.OUT_OF_STOCK,
        Event.CANCEL_TRANSACTION,
        State.CANCELLED,
        action=_cancel,
        description="Close the out-of-stock transaction.",
    ),
    # Payment
    Transition(
        State.PAYMENT_PENDING,
        Event.INSERT_COIN,
        State.PAYMENT_PENDING,
        guard=_guard_coin,
        action=_insert_money,
        description="A valid coin increases the EFSM balance; the state remains pending.",
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.INSERT_NOTE,
        State.PAYMENT_PENDING,
        guard=_guard_note,
        action=_insert_money,
        description="A valid note increases the EFSM balance; the state remains pending.",
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.INSUFFICIENT_AMOUNT,
        State.PAYMENT_PENDING,
        guard=_guard_funds_insufficient,
        description="Balance is still short; remain in PAYMENT_PENDING.",
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.SUFFICIENT_AMOUNT,
        State.PAYMENT_ACCEPTED,
        guard=_guard_funds_sufficient,
        action=_mark_sufficient,
        description="Balance covers the total, so payment is accepted.",
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.PAYMENT_SUCCESS,
        State.PAYMENT_ACCEPTED,
        guard=_guard_funds_sufficient,
        action=_mark_upi,
        description="A simulated UPI charge succeeds for the full amount.",
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.PAYMENT_FAILED,
        dynamic_target=_payment_failure_target,
        action=_payment_failed,
        description="UPI failure errors safely, or enters refunding if cash was inserted.",
        possible_targets=(State.ERROR, State.REFUNDING),
    ),
    Transition(
        State.PAYMENT_PENDING,
        Event.CANCEL_TRANSACTION,
        dynamic_target=_cancel_target,
        action=_cancel,
        description="Cancel with no funds → CANCELLED; with funds → REFUNDING.",
        possible_targets=(State.CANCELLED, State.REFUNDING),
    ),
    # Dispensing
    Transition(
        State.PAYMENT_ACCEPTED,
        Event.DISPENSE_PRODUCT,
        State.DISPENSING,
        guard=_guard_payment_accepted,
        description="Only fully accepted payment can trigger the dispenser.",
    ),
    Transition(
        State.PAYMENT_ACCEPTED,
        Event.CANCEL_TRANSACTION,
        State.REFUNDING,
        action=_cancel,
        description="Cancel after payment; captured funds must be refunded.",
    ),
    Transition(
        State.DISPENSING,
        Event.DISPENSE_SUCCESS,
        State.CHANGE_RETURN,
        action=_dispense_success,
        description="Hardware reports success; calculate change.",
    ),
    Transition(
        State.DISPENSING,
        Event.DISPENSE_FAILURE,
        State.REFUNDING,
        action=_dispense_failure,
        description="Hardware reports failure; refund instead of charging for nothing.",
    ),
    Transition(
        State.CHANGE_RETURN,
        Event.RETURN_CHANGE,
        State.COMPLETED,
        description="Change is returned and the run reaches an accepting state.",
    ),
    # Recovery / terminal
    Transition(
        State.COMPLETED,
        Event.RESET_MACHINE,
        State.IDLE,
        description="Finalize the receipt and reset for the next customer.",
    ),
    Transition(
        State.COMPLETED,
        Event.CANCEL_TRANSACTION,
        State.REFUNDING,
        guard=_guard_refundable,
        action=_cancel,
        description="An admin can refund a completed purchase.",
    ),
    Transition(
        State.REFUNDING,
        Event.PROCESS_REFUND,
        State.CANCELLED,
        guard=_guard_not_refunded,
        action=_refund,
        description="The refund is processed and the transaction closes.",
    ),
    Transition(
        State.CANCELLED,
        Event.RESET_MACHINE,
        State.IDLE,
        description="Reset after cancellation/refund.",
    ),
    Transition(
        State.ERROR,
        Event.CANCEL_TRANSACTION,
        dynamic_target=_cancel_target,
        action=_cancel,
        description="Close an errored transaction, refunding any inserted cash.",
        possible_targets=(State.CANCELLED, State.REFUNDING),
    ),
    Transition(
        State.ERROR,
        Event.RESET_MACHINE,
        State.IDLE,
        description="Acknowledge the error and reset the machine.",
    ),
    # Machine service mode
    Transition(
        State.IDLE,
        Event.ENTER_MAINTENANCE,
        State.MAINTENANCE,
        description="Enter machine service mode from a safe, idle state.",
    ),
    Transition(
        State.MAINTENANCE,
        Event.EXIT_MAINTENANCE,
        State.IDLE,
        description="Leave service mode when maintenance is complete.",
    ),
]


class TransitionTable:
    def __init__(self, transitions: list[Transition]):
        self.transitions = transitions
        self._table: dict[tuple[State, Event], Transition] = {}
        for transition in transitions:
            key = (transition.source, transition.event)
            if key in self._table:
                raise ValueError(
                    f"Non-deterministic transition detected for {key[0]} / {key[1]}"
                )
            self._table[key] = transition

    def get(self, state: State, event: Event) -> Transition:
        try:
            return self._table[(state, event)]
        except KeyError as exc:
            raise InvalidTransitionError(state.value, event.value) from exc

    def find(self, state: State, event: Event) -> Transition | None:
        return self._table.get((state, event))

    def evaluate(
        self, state: State, event: Event, context: TransactionContext, payload: dict[str, Any]
    ) -> Transition:
        transition = self.get(state, event)
        allowed, reason = transition.evaluate(context, payload)
        if not allowed:
            raise GuardRejectedError(state.value, event.value, reason)
        return transition


transition_table = TransitionTable(TRANSITIONS)
