from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1", nullable=False)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped[Category] = relationship(back_populates="products")
    inventory: Mapped[list["Inventory"]] = relationship(back_populates="product")

    __table_args__ = (
        Index("ix_products_category_active", "category_id", "is_active"),
    )


class Inventory(TimestampMixin, Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    slot_code: Mapped[str] = mapped_column(String(20), default="A1", nullable=False)

    product: Mapped[Product] = relationship(back_populates="inventory")
    machine: Mapped["Machine"] = relationship(back_populates="inventory_items")

    __table_args__ = (
        Index("uq_inventory_machine_product", "machine_id", "product_id", unique=True),
        Index("ix_inventory_machine_available", "machine_id", "product_id"),
    )


class Machine(TimestampMixin, Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="online", nullable=False)
    last_heartbeat: Mapped[str | None] = mapped_column(String(50))

    inventory_items: Mapped[list[Inventory]] = relationship(
        back_populates="machine", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["MachineAlert"]] = relationship(
        back_populates="machine", cascade="all, delete-orphan"
    )


class MachineAlert(TimestampMixin, Base):
    __tablename__ = "machine_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False
    )
    severity: Mapped[str] = mapped_column(String(20), default="warning", nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    machine: Mapped[Machine] = relationship(back_populates="alerts")

    __table_args__ = (Index("ix_machine_alerts_open", "machine_id", "is_resolved"),)
