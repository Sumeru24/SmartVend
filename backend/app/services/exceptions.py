class VendingError(Exception):
    """A business-rule violation with a safe HTTP representation."""

    def __init__(self, detail: str, status_code: int = 400, code: str = "BUSINESS_RULE"):
        self.detail = detail
        self.status_code = status_code
        self.code = code
        super().__init__(detail)
