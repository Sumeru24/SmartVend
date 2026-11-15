class AutomatonError(Exception):
    """Base class for deterministic transition failures."""

    def __init__(self, source: str, event: str, reason: str):
        self.source = source
        self.event = event
        self.reason = reason
        super().__init__(reason)


class InvalidTransitionError(AutomatonError):
    """No δ(state, event) edge exists."""

    def __init__(self, source: str, event: str):
        super().__init__(
            source,
            event,
            f"There is no transition from {source} on event {event}.",
        )


class GuardRejectedError(AutomatonError):
    """The edge exists but its precondition is false."""


class InvalidEventError(AutomatonError):
    """The event is not part of Σ."""
