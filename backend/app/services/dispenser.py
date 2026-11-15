from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.automaton.transaction_context import CartItem


@dataclass(frozen=True)
class DispenseResult:
    success: bool
    reference: str
    message: str
    simulated: bool = True


class DispenserAdapter:
    """Interface the route/service depends on; replace with real hardware I/O."""

    def dispense(self, machine_id: int, items: list[CartItem], fail: bool = False) -> DispenseResult:
        raise NotImplementedError


class SimulatedDispenser(DispenserAdapter):
    """A deterministic software adapter.

    It does not talk to physical hardware. The API and receipts label every
    dispense as simulated so the system never claims that a physical product
    was released.
    """

    def dispense(self, machine_id: int, items: list[CartItem], fail: bool = False) -> DispenseResult:
        reference = f"SIM-DISP-{uuid.uuid4().hex[:10].upper()}"
        if fail:
            return DispenseResult(
                success=False,
                reference=reference,
                message="Simulated motor jam: the dispenser did not complete the drop.",
            )
        if not items:
            return DispenseResult(
                success=False,
                reference=reference,
                message="No cart lines were supplied to the dispenser.",
            )
        return DispenseResult(
            success=True,
            reference=reference,
            message=f"Simulated dispensing completed for {sum(i.quantity for i in items)} item(s).",
        )


dispenser = SimulatedDispenser()
