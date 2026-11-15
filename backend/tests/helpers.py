"""Small API helpers shared by the Pytest suite."""

from __future__ import annotations

from fastapi.testclient import TestClient

API = "/api/v1"


def create_transaction(
    client: TestClient,
    items: list[dict],
    *,
    machine_id: int = 1,
    idempotency_key: str | None = None,
):
    body = {"machine_id": machine_id, "items": items}
    if idempotency_key:
        body["idempotency_key"] = idempotency_key
    return client.post(f"{API}/transactions", json=body)


def pay(
    client: TestClient,
    reference: str,
    method: str,
    *,
    amount_paise: int | None = None,
    simulate_failure: bool = False,
    idempotency_key: str | None = None,
):
    body: dict = {"method": method, "simulate_failure": simulate_failure}
    if amount_paise is not None:
        body["amount_paise"] = amount_paise
    if idempotency_key:
        body["idempotency_key"] = idempotency_key
    return client.post(f"{API}/transactions/{reference}/payments", json=body)


def dispense(
    client: TestClient,
    reference: str,
    *,
    simulate_failure: bool = False,
    failure_reason: str | None = None,
    idempotency_key: str | None = None,
):
    body: dict = {"simulate_failure": simulate_failure}
    if failure_reason:
        body["failure_reason"] = failure_reason
    if idempotency_key:
        body["idempotency_key"] = idempotency_key
    return client.post(f"{API}/transactions/{reference}/dispense", json=body)


def cancel(client: TestClient, reference: str, reason: str = "Customer cancelled"):
    return client.post(
        f"{API}/transactions/{reference}/cancel", json={"reason": reason}
    )


def inventory_map(client: TestClient, headers: dict, machine_id: int = 1) -> dict:
    response = client.get(
        f"{API}/admin/inventory", params={"machine_id": machine_id}, headers=headers
    )
    assert response.status_code == 200, response.text
    return {row["product_id"]: row for row in response.json()}


def product_id(catalog: dict, sku: str = "SV-CHP-001") -> int:
    return catalog[sku]["id"]


def start_cash_purchase(client: TestClient, catalog: dict, quantity: int = 1):
    sku = "SV-CHP-001"
    response = create_transaction(
        client, [{"product_id": product_id(catalog, sku), "quantity": quantity}]
    )
    assert response.status_code == 201, response.text
    return response.json()


def complete_cash_purchase(
    client: TestClient,
    catalog: dict,
    quantity: int = 1,
    note_paise: int = 5000,
):
    transaction = start_cash_purchase(client, catalog, quantity)
    paid = pay(client, transaction["reference"], "note", amount_paise=note_paise)
    assert paid.status_code == 200, paid.text
    finished = dispense(client, transaction["reference"])
    assert finished.status_code == 200, finished.text
    return finished.json()["transaction"]


def complete_upi_purchase(client: TestClient, catalog: dict, quantity: int = 1):
    transaction = start_cash_purchase(client, catalog, quantity)
    paid = pay(client, transaction["reference"], "upi")
    assert paid.status_code == 200, paid.text
    finished = dispense(client, transaction["reference"])
    assert finished.status_code == 200, finished.text
    return finished.json()["transaction"]
