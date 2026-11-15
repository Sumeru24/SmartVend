from enum import Enum


class State(str, Enum):
    """Q — the finite set of states in the SmartVend automaton."""

    IDLE = "IDLE"
    PRODUCT_SELECTED = "PRODUCT_SELECTED"
    INVENTORY_CHECK = "INVENTORY_CHECK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_ACCEPTED = "PAYMENT_ACCEPTED"
    DISPENSING = "DISPENSING"
    CHANGE_RETURN = "CHANGE_RETURN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDING = "REFUNDING"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"


INITIAL_STATE = State.IDLE
ACCEPTING_STATES: frozenset[State] = frozenset({State.COMPLETED, State.CANCELLED})

STATE_META: dict[State, dict[str, str]] = {
    State.IDLE: {
        "label": "Idle",
        "description": "The machine is awake and waiting for a customer to begin.",
        "tone": "slate",
    },
    State.PRODUCT_SELECTED: {
        "label": "Product selected",
        "description": "A cart has been chosen; the customer can still change it.",
        "tone": "indigo",
    },
    State.INVENTORY_CHECK: {
        "label": "Inventory check",
        "description": "Stock for every requested line is inspected and reserved atomically.",
        "tone": "amber",
    },
    State.OUT_OF_STOCK: {
        "label": "Out of stock",
        "description": "At least one requested product cannot be fulfilled.",
        "tone": "orange",
    },
    State.PAYMENT_PENDING: {
        "label": "Payment pending",
        "description": "Stock is reserved. The machine waits for enough funds.",
        "tone": "cyan",
    },
    State.PAYMENT_ACCEPTED: {
        "label": "Payment accepted",
        "description": "The balance covers the total. Dispensing is now allowed.",
        "tone": "emerald",
    },
    State.DISPENSING: {
        "label": "Dispensing",
        "description": "The simulated hardware adapter is releasing the products.",
        "tone": "violet",
    },
    State.CHANGE_RETURN: {
        "label": "Return change",
        "description": "Products are out; the machine is calculating and returning change.",
        "tone": "sky",
    },
    State.COMPLETED: {
        "label": "Completed",
        "description": "The purchase finished successfully. Change has been returned.",
        "tone": "emerald",
    },
    State.CANCELLED: {
        "label": "Cancelled",
        "description": "The transaction ended without an unrefunded charge.",
        "tone": "rose",
    },
    State.REFUNDING: {
        "label": "Refunding",
        "description": "Captured funds are being returned through the original method.",
        "tone": "fuchsia",
    },
    State.ERROR: {
        "label": "Error",
        "description": "A payment or hardware error stopped the transaction safely.",
        "tone": "red",
    },
    State.MAINTENANCE: {
        "label": "Maintenance",
        "description": "Service mode is active. Customer transactions are blocked.",
        "tone": "stone",
    },
}
