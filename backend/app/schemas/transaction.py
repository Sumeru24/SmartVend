from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.catalog import CatalogProduct


class TransactionItemIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=50)


class CreateTransactionRequest(BaseModel):
    machine_id: int | None = None
    items: list[TransactionItemIn] = Field(min_length=1, max_length=30)
    idempotency_key: str | None = Field(default=None, max_length=100)

    @field_validator("items")
    @classmethod
    def unique_products(cls, value: list[TransactionItemIn]) -> list[TransactionItemIn]:
        ids = [item.product_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Combine duplicate product lines into a single quantity.")
        return value


class PaymentRequest(BaseModel):
    method: Literal["coin", "note", "upi"]
    amount_paise: int | None = Field(default=None, ge=0, le=1_000_000)
    idempotency_key: str | None = Field(default=None, max_length=120)
    simulate_failure: bool = False
    upi_vpa: str | None = Field(default=None, max_length=100)

    @field_validator("amount_paise")
    @classmethod
    def money_is_integer(cls, value: int | None) -> int | None:
        if value is not None and not isinstance(value, int):
            raise ValueError("Payments must be expressed as integer paise.")
        return value


class DispenseRequest(BaseModel):
    simulate_failure: bool = False
    failure_reason: str | None = Field(default=None, max_length=300)
    idempotency_key: str | None = Field(default=None, max_length=120)


class CancelRequest(BaseModel):
    reason: str = Field(default="Customer cancelled", min_length=2, max_length=300)


class RefundRequest(BaseModel):
    reason: str = Field(default="Admin refund", min_length=2, max_length=300)


class RefundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_paise: int
    reason: str
    status: str
    provider_ref: str | None
    created_at: datetime


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    method: str
    amount_paise: int
    status: str
    provider_ref: str | None
    is_simulated: bool
    created_at: datetime


class TransactionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    unit_price_paise: int
    quantity: int
    line_total_paise: int
    image_url: str | None = None


class StateLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    previous_state: str
    event: str
    next_state: str | None
    accepted: bool
    reason: str | None
    sequence: int
    context_snapshot: dict | None
    created_at: datetime


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    machine_id: int
    current_state: str
    total_paise: int
    amount_paid_paise: int
    change_paise: int
    payment_method: str | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    stock_reserved: bool
    dispensed: bool
    version: int


class TransactionSummary(TransactionOut):
    machine_name: str = ""
    item_count: int = 0
    item_names: list[str] = []
    is_accepting: bool = False


class TransactionDetail(TransactionSummary):
    items: list[TransactionItemOut] = []
    payments: list[PaymentOut] = []
    refunds: list[RefundOut] = []
    state_logs: list[StateLogOut] = []


class TransactionCreatedResponse(TransactionDetail):
    transitions: list["TransitionResultOut"] = []


class TransitionResultOut(BaseModel):
    accepted: bool
    source: str
    event: str
    target: str | None
    reason: str
    description: str
    sequence: int | None = None
    timestamp: datetime | None = None


class TransactionActionResponse(BaseModel):
    transaction: TransactionDetail
    transitions: list[TransitionResultOut] = []


class ReceiptOut(BaseModel):
    reference: str
    issued_at: datetime
    machine_name: str
    machine_location: str
    customer_name: str | None = None
    items: list[TransactionItemOut]
    subtotal_paise: int
    total_paise: int
    amount_paid_paise: int
    change_paise: int
    payment_method: str | None
    status: str
    simulated_dispense: bool = True


class SimulationStepRequest(BaseModel):
    state: str = "IDLE"
    event: str
    context: dict[str, Any] = Field(default_factory=dict)
    payload: dict[str, Any] = Field(default_factory=dict)


class SimulationStepResponse(BaseModel):
    accepted: bool
    source: str
    event: str
    target: str | None = None
    reason: str
    description: str = ""
    context: dict[str, Any]
    is_accepting_state: bool = False
    error_code: str | None = None


class PublicCatalogProduct(CatalogProduct):
    pass
