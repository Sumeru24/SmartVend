from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin, utcnow


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    current_state: Mapped[str] = mapped_column(String(30), default="IDLE", nullable=False)
    total_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount_paid_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    change_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(30))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )
    dispense_idempotency_key: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )
    stock_reserved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dispensed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    machine: Mapped["Machine"] = relationship()
    items: Mapped[list["TransactionItem"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )
    refunds: Mapped[list["Refund"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )
    state_logs: Mapped[list["StateLog"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="StateLog.sequence",
    )

    __table_args__ = (
        Index("ix_transactions_state_created", "current_state", "created_at"),
        Index("ix_transactions_machine_created", "machine_id", "created_at"),
        Index("ix_transactions_reference", "reference"),
    )


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    transaction: Mapped[Transaction] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()

    __table_args__ = (Index("ix_transaction_items_transaction", "transaction_id"),)


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="captured", nullable=False)
    provider_ref: Mapped[str | None] = mapped_column(String(100), unique=True)
    idempotency_key: Mapped[str | None] = mapped_column(
        String(150), unique=True, nullable=True
    )
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    transaction: Mapped[Transaction] = relationship(back_populates="payments")

    __table_args__ = (Index("ix_payments_transaction", "transaction_id"),)


class Refund(TimestampMixin, Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    payment_id: Mapped[int | None] = mapped_column(
        ForeignKey("payments.id", ondelete="SET NULL")
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="processed", nullable=False)
    processed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    provider_ref: Mapped[str | None] = mapped_column(String(100))

    transaction: Mapped[Transaction] = relationship(back_populates="refunds")
    payment: Mapped[Payment | None] = relationship()

    __table_args__ = (Index("ix_refunds_transaction", "transaction_id"),)


class StateLog(Base):
    __tablename__ = "state_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE")
    )
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL")
    )
    previous_state: Mapped[str] = mapped_column(String(30), nullable=False)
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    next_state: Mapped[str | None] = mapped_column(String(30))
    accepted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500))
    sequence: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    context_snapshot: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    transaction: Mapped[Transaction | None] = relationship(back_populates="state_logs")

    __table_args__ = (
        Index("ix_state_logs_transaction_sequence", "transaction_id", "sequence"),
    )


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    change: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(80), nullable=False)
    previous_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    product: Mapped["Product"] = relationship()
    machine: Mapped["Machine"] = relationship()

    __table_args__ = (
        Index("ix_inventory_logs_machine_created", "machine_id", "created_at"),
    )
