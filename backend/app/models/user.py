from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.base import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(300), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (Index("ix_users_role", "role"),)
