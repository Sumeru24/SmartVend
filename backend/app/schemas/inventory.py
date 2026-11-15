from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    low_stock_threshold: int
    slot_code: str
    updated_at: datetime
    available_quantity: int = 0
    product_name: str = ""
    product_price_paise: int = 0
    machine_name: str = ""
    is_low_stock: bool = False


class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0, le=100000)
    reason: str = Field(default="Manual adjustment", max_length=200)


class RestockRequest(BaseModel):
    quantity: int = Field(gt=0, le=100000)
    reason: str = Field(default="Restock", max_length=200)


class MinThresholdUpdate(BaseModel):
    low_stock_threshold: int = Field(ge=0, le=10000)


class InventoryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: int
    product_id: int
    change: int
    reason: str
    previous_quantity: int
    new_quantity: int
    created_at: datetime
    product_name: str = ""
    machine_name: str = ""


class InventoryBulkItem(BaseModel):
    product_id: int
    quantity: int = Field(ge=0, le=100000)
    low_stock_threshold: int = Field(default=5, ge=0, le=10000)
    slot_code: str = Field(default="A1", max_length=20)


class InventoryBulkUpsert(BaseModel):
    machine_id: int
    items: list[InventoryBulkItem]
