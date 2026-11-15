from app.automaton import AutomatonError, Event, TransactionContext, fsm
from app.schemas.transaction import SimulationStepRequest, SimulationStepResponse


def simulate_step(request: SimulationStepRequest) -> SimulationStepResponse:
    try:
        context = TransactionContext.from_dict(request.context)
    except (TypeError, ValueError) as exc:
        return SimulationStepResponse(
            accepted=False,
            source=request.state,
            event=request.event,
            target=None,
            reason=f"The simulation context is invalid: {exc}",
            context={
                "items": [],
                "balance_paise": 0,
                "total_paise": 0,
                "change_paise": 0,
                "currency": "INR",
            },
            error_code="INVALID_CONTEXT",
        )
    payload = dict(request.payload)
    current_state = request.state

    try:
        incoming = Event(request.event)
    except ValueError:
        return SimulationStepResponse(
            accepted=False,
            source=current_state,
            event=request.event,
            target=None,
            reason=f"{request.event} is not part of Σ.",
            context=context.to_dict(),
            error_code="INVALID_EVENT",
        )

    # The simulator gives an intuitive UPI experience: PAYMENT_SUCCESS credits
    # the outstanding balance unless an explicit amount was supplied.
    if (
        incoming == Event.PAYMENT_SUCCESS
        and current_state == "PAYMENT_PENDING"
        and payload.get("credit_upi", True)
        and context.balance_paise < context.total_paise
    ):
        amount = int(payload.get("amount_paise") or context.amount_due_paise)
        context.balance_paise += amount
        context.payment_method = "upi"

    try:
        result = fsm.step(current_state, incoming, context, payload)
        return SimulationStepResponse(
            accepted=True,
            source=result.source.value,
            event=result.event.value,
            target=result.target.value if result.target else None,
            reason=result.reason,
            description=result.description,
            context=context.to_dict(),
            is_accepting_state=fsm.is_accepting(result.target) if result.target else False,
        )
    except AutomatonError as exc:
        return SimulationStepResponse(
            accepted=False,
            source=current_state,
            event=request.event,
            target=None,
            reason=exc.reason,
            context=context.to_dict(),
            error_code=(
                "GUARD_REJECTED"
                if exc.__class__.__name__ == "GuardRejectedError"
                else "INVALID_TRANSITION"
            ),
        )
