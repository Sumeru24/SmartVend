from fastapi import APIRouter

from app.automaton import fsm
from app.schemas.transaction import SimulationStepRequest, SimulationStepResponse
from app.services.simulation_service import simulate_step

router = APIRouter(prefix="/fsm", tags=["Finite Automaton"])


@router.get(
    "/model",
    summary="The complete formal automaton model (Q, Σ, δ, q0, F)",
)
def get_model():
    return fsm.model()


@router.post(
    "/simulate/step",
    response_model=SimulationStepResponse,
    summary="Execute one pure FSM step without persisting a transaction",
)
def run_simulation_step(payload: SimulationStepRequest):
    return simulate_step(payload)
