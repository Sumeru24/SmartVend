from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.automaton.events import EVENT_META, Event
from app.automaton.exceptions import (
    AutomatonError,
    GuardRejectedError,
    InvalidEventError,
    InvalidTransitionError,
)
from app.automaton.states import ACCEPTING_STATES, INITIAL_STATE, STATE_META, State
from app.automaton.transaction_context import TransactionContext
from app.automaton.transitions import TRANSITIONS, Transition, transition_table


@dataclass
class StepResult:
    accepted: bool
    source: State
    event: Event
    target: State | None
    reason: str
    context: TransactionContext
    description: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "accepted": self.accepted,
            "source": self.source.value,
            "event": self.event.value,
            "target": self.target.value if self.target else None,
            "reason": self.reason,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
            "context": self.context.to_dict(),
            "is_accepting_state": self.target in ACCEPTING_STATES if self.target else False,
        }


class FiniteStateMachine:
    """Pure EFSM controller.

    The engine owns state validation, guards and context arithmetic. Database
    side effects are orchestrated by services so the automaton can also be run
    in a stateless simulation without writing to persistent storage.
    """

    name = "SmartVend Purchase Automaton"

    def __init__(self) -> None:
        self.transitions: list[Transition] = TRANSITIONS

    @property
    def initial_state(self) -> State:
        return INITIAL_STATE

    @property
    def accepting_states(self) -> frozenset[State]:
        return ACCEPTING_STATES

    def is_accepting(self, state: State | str) -> bool:
        return State(state) in ACCEPTING_STATES

    def enrich_context(
        self, context: TransactionContext, payload: dict[str, Any] | None = None
    ) -> None:
        payload = payload or {}
        if not context.items and payload.get("items"):
            from app.automaton.transaction_context import CartItem

            context.items = [
                CartItem(
                    product_id=int(item["product_id"]),
                    name=str(item.get("name") or f"Product {item['product_id']}"),
                    unit_price_paise=int(item["unit_price_paise"]),
                    quantity=int(item.get("quantity", 1)),
                )
                for item in payload["items"]
            ]
        context.recompute_total()

    def step(
        self,
        state: State | str,
        event: Event | str,
        context: TransactionContext,
        payload: dict[str, Any] | None = None,
    ) -> StepResult:
        payload = payload or {}
        try:
            current = State(state)
        except ValueError as exc:
            raise InvalidTransitionError(str(state), str(event)) from exc

        try:
            incoming_event = Event(event)
        except ValueError as exc:
            raise InvalidEventError(current.value, str(event)) from exc

        transition = transition_table.get(current, incoming_event)
        self.enrich_context(context, payload)
        allowed, reason = transition.evaluate(context, payload)
        if not allowed:
            raise GuardRejectedError(current.value, incoming_event.value, reason)

        target = transition.resolve_target(context)
        if transition.action:
            transition.action(context, payload)

        return StepResult(
            accepted=True,
            source=current,
            event=incoming_event,
            target=target,
            reason=reason,
            context=context,
            description=transition.description,
        )

    def evaluate(
        self,
        state: State | str,
        event: Event | str,
        context: TransactionContext,
        payload: dict[str, Any] | None = None,
    ) -> tuple[bool, str]:
        """Validate an edge without mutating context (used by UI hints)."""
        try:
            current, incoming_event = State(state), Event(event)
            transition = transition_table.get(current, incoming_event)
            return transition.evaluate(context, payload or {})
        except AutomatonError as exc:
            return False, exc.reason
        except ValueError:
            return False, f"{event} is not part of the event alphabet."

    def transitions_from(self, state: State) -> list[Transition]:
        return [transition for transition in self.transitions if transition.source == state]

    def model(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "math": "M = (Q, Σ, δ, q0, F)",
            "formal_note": (
                "The formal DFA is finite in states and alphabet. The implementation is an "
                "Extended FSM: transaction_context.py adds finite-but-parameterised values "
                "(balance, cart, stock reservations) that guards inspect. For every concrete "
                "context, δ selects exactly one next state."
            ),
            "states": [
                {
                    "id": state.value,
                    **STATE_META[state],
                    "is_initial": state == INITIAL_STATE,
                    "is_accepting": state in ACCEPTING_STATES,
                    "is_terminal": state in {State.COMPLETED, State.CANCELLED},
                }
                for state in State
            ],
            "events": [
                {"id": event.value, **EVENT_META[event]} for event in Event
            ],
            "initial_state": INITIAL_STATE.value,
            "accepting_states": [state.value for state in ACCEPTING_STATES],
            "transitions": [
                {
                    "id": f"{transition.source.value}__{transition.event.value}",
                    "source": transition.source.value,
                    "event": transition.event.value,
                    "target": transition.target.value if transition.target else None,
                    "possible_targets": [
                        state.value for state in transition.possible_targets
                    ],
                    "dynamic": transition.target is None,
                    "description": transition.description,
                    "has_guard": transition.guard is not None,
                }
                for transition in self.transitions
            ],
            "transition_count": len(self.transitions),
            "state_count": len(State),
            "event_count": len(Event),
        }


fsm = FiniteStateMachine()
