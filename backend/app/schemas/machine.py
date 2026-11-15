from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MachineBase(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=200)


class MachineCreate(MachineBase):
    status: Literal["online", "offline", "maintenance", "error"] = "online"


class MachineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    location: str | None = Field(default=None, min_length=2, max_length=200)


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    location: str
    status: str
    created_at: datetime
    updated_at: datetime
    inventory_count: int = 0
    low_stock_count: int = 0
    open_alerts: int = 0
    transaction_count: int = 0
    revenue_paise: int = 0


class MachineStatusUpdate(BaseModel):
    status: Literal["online", "offline", "maintenance", "error"]
    reason: str | None = Field(default=None, max_length=300)


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: int
    severity: str
    type: str
    message: str
    is_resolved: bool
    created_at: datetime
    machine_name: str = ""
