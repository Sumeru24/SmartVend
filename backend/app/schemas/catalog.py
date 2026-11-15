from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CategoryBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    color: str = Field(default="#6366f1", max_length=20)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=20)


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    product_count: int = 0


class ProductBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    category_id: int
    price_paise: int = Field(gt=0, le=10_000_000)
    image_url: str | None = Field(default=None, max_length=500)
    sku: str = Field(min_length=2, max_length=50)
    is_active: bool = True

    @field_validator("price_paise")
    @classmethod
    def ensure_integer_paise(cls, value: int) -> int:
        if not isinstance(value, int):
            raise ValueError("Money must be an integer amount of paise.")
        return value


class ProductCreate(ProductBase):
    initial_stock: int = Field(default=0, ge=0, le=10000)
    low_stock_threshold: int = Field(default=5, ge=0, le=10000)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    category_id: int | None = None
    price_paise: int | None = Field(default=None, gt=0, le=10_000_000)
    image_url: str | None = Field(default=None, max_length=500)
    sku: str | None = Field(default=None, min_length=2, max_length=50)
    is_active: bool | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    sku: str
    description: str | None
    category_id: int
    price_paise: int
    image_url: str | None
    is_active: bool
    created_at: datetime
    category: CategoryOut | None = None
    total_stock: int = 0


class CatalogProduct(BaseModel):
    id: int
    name: str
    sku: str
    description: str | None
    price_paise: int
    image_url: str | None
    category_id: int
    category_name: str
    category_color: str
    stock: int
    slot_code: str


class CatalogResponse(BaseModel):
    machine_id: int
    machine_name: str
    machine_code: str
    machine_status: str
    products: list[CatalogProduct]
