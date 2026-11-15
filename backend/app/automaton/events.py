from enum import Enum


class Event(str, Enum):
    """Σ — the finite input alphabet of the SmartVend automaton."""

    SELECT_PRODUCT = "SELECT_PRODUCT"
    CONFIRM_PRODUCT = "CONFIRM_PRODUCT"
    CHECK_STOCK = "CHECK_STOCK"
    STOCK_AVAILABLE = "STOCK_AVAILABLE"
    STOCK_UNAVAILABLE = "STOCK_UNAVAILABLE"
    INSERT_COIN = "INSERT_COIN"
    INSERT_NOTE = "INSERT_NOTE"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    INSUFFICIENT_AMOUNT = "INSUFFICIENT_AMOUNT"
    SUFFICIENT_AMOUNT = "SUFFICIENT_AMOUNT"
    DISPENSE_PRODUCT = "DISPENSE_PRODUCT"
    DISPENSE_SUCCESS = "DISPENSE_SUCCESS"
    DISPENSE_FAILURE = "DISPENSE_FAILURE"
    RETURN_CHANGE = "RETURN_CHANGE"
    CANCEL_TRANSACTION = "CANCEL_TRANSACTION"
    PROCESS_REFUND = "PROCESS_REFUND"
    RESET_MACHINE = "RESET_MACHINE"
    ENTER_MAINTENANCE = "ENTER_MAINTENANCE"
    EXIT_MAINTENANCE = "EXIT_MAINTENANCE"


EVENT_META: dict[Event, dict[str, str]] = {
    Event.SELECT_PRODUCT: {"description": "Customer adds a product/cart line.", "group": "selection"},
    Event.CONFIRM_PRODUCT: {"description": "Customer confirms the selected cart.", "group": "selection"},
    Event.CHECK_STOCK: {"description": "Stock check is requested for the cart.", "group": "selection"},
    Event.STOCK_AVAILABLE: {"description": "All requested stock could be reserved.", "group": "selection"},
    Event.STOCK_UNAVAILABLE: {"description": "At least one line lacks available stock.", "group": "selection"},
    Event.INSERT_COIN: {"description": "A coin denomination was inserted.", "group": "payment"},
    Event.INSERT_NOTE: {"description": "A note denomination was inserted.", "group": "payment"},
    Event.PAYMENT_SUCCESS: {"description": "An electronic/UPI payment succeeded.", "group": "payment"},
    Event.PAYMENT_FAILED: {"description": "The electronic payment failed.", "group": "payment"},
    Event.INSUFFICIENT_AMOUNT: {"description": "Inserted funds are still below the total.", "group": "payment"},
    Event.SUFFICIENT_AMOUNT: {"description": "Inserted funds cover the total.", "group": "payment"},
    Event.DISPENSE_PRODUCT: {"description": "Command the dispensing adapter to release items.", "group": "dispensing"},
    Event.DISPENSE_SUCCESS: {"description": "The hardware adapter reported success.", "group": "dispensing"},
    Event.DISPENSE_FAILURE: {"description": "The hardware adapter reported a failure.", "group": "dispensing"},
    Event.RETURN_CHANGE: {"description": "Return change and finalize the receipt.", "group": "dispensing"},
    Event.CANCEL_TRANSACTION: {"description": "Customer/admin cancels the transaction.", "group": "recovery"},
    Event.PROCESS_REFUND: {"description": "Return captured funds to the payer.", "group": "recovery"},
    Event.RESET_MACHINE: {"description": "Return a terminal transaction to IDLE.", "group": "recovery"},
    Event.ENTER_MAINTENANCE: {"description": "Enter service mode from IDLE.", "group": "service"},
    Event.EXIT_MAINTENANCE: {"description": "Leave service mode and return to IDLE.", "group": "service"},
}
