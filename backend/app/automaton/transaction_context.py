from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class CartItem:
    product_id: int
    name: str
    unit_price_paise: int
    quantity: int

    @property
    def line_total_paise(self) -> int:
        return self.unit_price_paise * self.quantity


@dataclass
class TransactionContext:
    """Extended finite-state context.

    A classical DFA has no memory. These fields are the *extended* part of the
    EFSM and let guards reason about money, cart quantities and inventory while
    Q, Σ and δ remain finite.
    """

    transaction_id: int | None = None
    machine_id: int | None = None
    items: list[CartItem] = field(default_factory=list)
    balance_paise: int = 0
    total_paise: int = 0
    change_paise: int = 0
    currency: str = "INR"
    payment_method: str | None = None
    stock_reserved: bool = False
    inventory_available: bool = False
    payment_succeeded: bool = False
    dispensed: bool = False
    refunded_paise: int = 0
    error_message: str | None = None
    inserted_denominations: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def recompute_total(self) -> None:
        self.total_paise = sum(item.line_total_paise for item in self.items)

    @property
    def amount_due_paise(self) -> int:
        return max(self.total_paise - self.balance_paise, 0)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["amount_due_paise"] = self.amount_due_paise
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "TransactionContext":
        if not data:
            return cls()
        raw = dict(data)
        items = []
        for item in raw.pop("items", []):
            try:
                items.append(
                    CartItem(
                        product_id=int(item["product_id"]),
                        name=str(item.get("name") or f"Product {item['product_id']}"),
                        unit_price_paise=int(item["unit_price_paise"]),
                        quantity=int(item.get("quantity", 1)),
                    )
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(
                    "Each cart item needs integer product_id, unit_price_paise and quantity."
                ) from exc
        raw.pop("amount_due_paise", None)
        allowed = {
            "transaction_id",
            "machine_id",
            "balance_paise",
            "total_paise",
            "change_paise",
            "currency",
            "payment_method",
            "stock_reserved",
            "inventory_available",
            "payment_succeeded",
            "dispensed",
            "refunded_paise",
            "error_message",
            "inserted_denominations",
            "notes",
        }
        return cls(items=items, **{k: v for k, v in raw.items() if k in allowed})


# RBI-style denominations used by the simulator. All values are paise.
COIN_DENOMINATIONS = frozenset({100, 200, 500, 1000, 2000})
NOTE_DENOMINATIONS = frozenset({1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000})
