"""End-to-end purchase, payment, dispensing, cancellation and refund flows."""

from __future__ import annotations

from tests.helpers import (
    cancel,
    complete_cash_purchase,
    complete_upi_purchase,
    create_transaction,
    dispense,
    inventory_map,
    pay,
    product_id,
    start_cash_purchase,
)

API = "/api/v1"


def test_cash_purchase_reserves_then_dispenses_with_change(
    client, catalog, admin_headers
):
    chips_id = product_id(catalog)
    original = inventory_map(client, admin_headers)[chips_id]
    assert original["quantity"] == 18

    created = start_cash_purchase(client, catalog)
    reference = created["reference"]
    assert created["current_state"] == "PAYMENT_PENDING"
    assert created["total_paise"] == 3000
    assert created["amount_paid_paise"] == 0
    assert created["stock_reserved"] is True
    assert [step["event"] for step in created["transitions"]] == [
        "SELECT_PRODUCT",
        "CONFIRM_PRODUCT",
        "STOCK_AVAILABLE",
    ]
    reserved = inventory_map(client, admin_headers)[chips_id]
    assert reserved["reserved_quantity"] == 1
    assert reserved["available_quantity"] == 17
    assert reserved["quantity"] == 18, "stock is reserved, not deducted yet"

    paid = pay(client, reference, "note", amount_paise=5000)
    assert paid.status_code == 200, paid.text
    payment = paid.json()
    assert payment["transaction"]["current_state"] == "PAYMENT_ACCEPTED"
    assert payment["transaction"]["amount_paid_paise"] == 5000
    assert [step["event"] for step in payment["transitions"]] == [
        "INSERT_NOTE",
        "SUFFICIENT_AMOUNT",
    ]
    assert payment["transaction"]["stock_reserved"] is True

    finished = dispense(client, reference, idempotency_key="dispense-happy-1")
    assert finished.status_code == 200, finished.text
    transaction = finished.json()["transaction"]
    assert transaction["current_state"] == "COMPLETED"
    assert transaction["dispensed"] is True
    assert transaction["stock_reserved"] is False
    assert transaction["total_paise"] == 3000
    assert transaction["change_paise"] == 2000
    assert [step["event"] for step in finished.json()["transitions"]] == [
        "DISPENSE_PRODUCT",
        "DISPENSE_SUCCESS",
        "RETURN_CHANGE",
    ]

    used = inventory_map(client, admin_headers)[chips_id]
    assert used["quantity"] == 17
    assert used["reserved_quantity"] == 0
    assert len(transaction["payments"]) == 1
    assert transaction["payments"][0]["method"] == "note"
    assert transaction["payments"][0]["status"] == "captured"
    assert transaction["payments"][0]["is_simulated"] is True

    receipt = client.get(f"{API}/transactions/{reference}/receipt")
    assert receipt.status_code == 200
    receipt_data = receipt.json()
    assert receipt_data["reference"] == reference
    assert receipt_data["total_paise"] == 3000
    assert receipt_data["change_paise"] == 2000
    assert receipt_data["simulated_dispense"] is True
    assert receipt_data["status"] == "COMPLETED"

    history = client.get(
        f"{API}/transactions/history", params={"refs": reference}
    )
    assert history.status_code == 200
    assert history.json()[0]["reference"] == reference
    assert history.json()[0]["item_count"] == 1


def test_partial_cash_logs_insufficient_then_sufficient_events(
    client, catalog
):
    transaction = start_cash_purchase(client, catalog)
    reference = transaction["reference"]

    first = pay(client, reference, "coin", amount_paise=1000)
    assert first.status_code == 200
    assert first.json()["transaction"]["current_state"] == "PAYMENT_PENDING"
    assert first.json()["transaction"]["amount_paid_paise"] == 1000
    assert [step["event"] for step in first.json()["transitions"]] == [
        "INSERT_COIN",
        "INSUFFICIENT_AMOUNT",
    ]

    second = pay(client, reference, "coin", amount_paise=2000)
    assert second.status_code == 200
    assert second.json()["transaction"]["current_state"] == "PAYMENT_ACCEPTED"
    assert second.json()["transaction"]["amount_paid_paise"] == 3000
    assert [step["event"] for step in second.json()["transitions"]] == [
        "INSERT_COIN",
        "SUFFICIENT_AMOUNT",
    ]

    early = dispense(client, reference)
    assert early.status_code == 200
    assert early.json()["transaction"]["current_state"] == "COMPLETED"
    assert early.json()["transaction"]["change_paise"] == 0

    another_payment = pay(client, reference, "coin", amount_paise=100)
    assert another_payment.status_code == 409
    assert another_payment.json()["code"] == "PAYMENT_NOT_ALLOWED"


def test_invalid_denomination_is_rejected_without_charging(
    client, catalog, db
):
    from app.models import Payment

    transaction = start_cash_purchase(client, catalog)
    reference = transaction["reference"]

    rejected = pay(client, reference, "coin", amount_paise=5000)
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "FSM_GUARDREJECTED"
    assert "not an accepted coin" in rejected.json()["detail"]

    detail = client.get(f"{API}/transactions/{reference}").json()
    assert detail["current_state"] == "PAYMENT_PENDING"
    assert detail["amount_paid_paise"] == 0
    assert detail["payments"] == []
    assert db.query(Payment).count() == 0

    invalid_payload = pay(client, reference, "note", amount_paise=-500)
    assert invalid_payload.status_code == 422


def test_out_of_stock_rolls_back_every_reservation_atomically(
    client, catalog, admin_headers
):
    chips = product_id(catalog, "SV-CHP-001")
    cola = product_id(catalog, "SV-COLA-002")
    before = inventory_map(client, admin_headers)
    assert before[chips]["quantity"] == 18
    assert before[cola]["quantity"] == 22

    response = create_transaction(
        client,
        [
            {"product_id": chips, "quantity": 1},
            {"product_id": cola, "quantity": 50},
        ],
    )
    assert response.status_code == 201, response.text
    transaction = response.json()
    assert transaction["current_state"] == "OUT_OF_STOCK"
    assert transaction["stock_reserved"] is False
    assert [
        step["event"] for step in transaction["transitions"]
    ] == ["SELECT_PRODUCT", "CONFIRM_PRODUCT", "STOCK_UNAVAILABLE"]
    assert "does not have enough available stock" in transaction["error_message"]

    after = inventory_map(client, admin_headers)
    assert after[chips]["reserved_quantity"] == 0
    assert after[cola]["reserved_quantity"] == 0
    assert after[chips]["quantity"] == before[chips]["quantity"]
    assert after[cola]["quantity"] == before[cola]["quantity"]

    closed = cancel(client, transaction["reference"], "Try another machine")
    assert closed.status_code == 200
    assert closed.json()["transaction"]["current_state"] == "CANCELLED"


def test_cancel_before_payment_releases_stock_without_refund(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    transaction = start_cash_purchase(client, catalog)
    assert inventory_map(client, admin_headers)[chips]["reserved_quantity"] == 1

    cancelled = cancel(client, transaction["reference"], "Changed my mind")
    assert cancelled.status_code == 200
    result = cancelled.json()["transaction"]
    assert result["current_state"] == "CANCELLED"
    assert result["stock_reserved"] is False
    assert result["refunds"] == []
    assert result["amount_paid_paise"] == 0
    assert result["completed_at"] is not None

    stock = inventory_map(client, admin_headers)[chips]
    assert stock["reserved_quantity"] == 0
    assert stock["quantity"] == 18


def test_cancel_after_cash_payment_refunds_all_inserted_funds(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    transaction = start_cash_purchase(client, catalog)
    reference = transaction["reference"]
    paid = pay(client, reference, "note", amount_paise=10000)
    assert paid.json()["transaction"]["current_state"] == "PAYMENT_ACCEPTED"

    cancelled = cancel(client, reference, "Customer cancelled at the machine")
    assert cancelled.status_code == 200
    result = cancelled.json()["transaction"]
    assert result["current_state"] == "CANCELLED"
    assert [step["event"] for step in cancelled.json()["transitions"]] == [
        "CANCEL_TRANSACTION",
        "PROCESS_REFUND",
    ]
    assert len(result["refunds"]) == 1
    assert result["refunds"][0]["amount_paise"] == 10000
    assert result["refunds"][0]["status"] == "processed"
    assert all(payment["status"] == "refunded" for payment in result["payments"])
    assert result["stock_reserved"] is False
    assert result["dispensed"] is False
    assert result["change_paise"] == 0

    stock = inventory_map(client, admin_headers)[chips]
    assert stock["reserved_quantity"] == 0
    assert stock["quantity"] == 18

    refunds = client.get(f"{API}/admin/transactions/refunds", headers=admin_headers)
    assert refunds.status_code == 200
    assert refunds.json()[0]["transaction_reference"] == reference


def test_upi_purchase_and_duplicate_action_protection(client, catalog):
    transaction = complete_upi_purchase(client, catalog)
    reference = transaction["reference"]
    assert transaction["current_state"] == "COMPLETED"
    assert transaction["payment_method"] == "upi"
    assert transaction["amount_paid_paise"] == 3000
    assert transaction["change_paise"] == 0

    extra_payment = pay(client, reference, "upi")
    assert extra_payment.status_code == 409
    assert extra_payment.json()["code"] == "PAYMENT_NOT_ALLOWED"

    replay = dispense(client, reference)
    assert replay.status_code == 200
    assert replay.json()["transitions"] == []
    assert replay.json()["transaction"]["current_state"] == "COMPLETED"
    assert replay.json()["transaction"]["dispensed"] is True


def test_create_and_payment_and_dispense_idempotency(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    response_one = create_transaction(
        client,
        [{"product_id": chips, "quantity": 1}],
        idempotency_key="checkout-key-1",
    )
    assert response_one.status_code == 201
    reference = response_one.json()["reference"]

    response_two = create_transaction(
        client,
        [{"product_id": chips, "quantity": 1}],
        idempotency_key="checkout-key-1",
    )
    assert response_two.status_code == 200
    assert response_two.json()["reference"] == reference
    assert response_two.json()["transitions"] == []
    assert inventory_map(client, admin_headers)[chips]["reserved_quantity"] == 1

    first_pay = pay(
        client, reference, "upi", idempotency_key="payment-key-1"
    )
    assert first_pay.status_code == 200
    assert len(first_pay.json()["transitions"]) == 1
    second_pay = pay(
        client, reference, "upi", idempotency_key="payment-key-1"
    )
    assert second_pay.status_code == 200
    assert second_pay.json()["transitions"] == []
    assert len(second_pay.json()["transaction"]["payments"]) == 1

    first_dispense = dispense(
        client, reference, idempotency_key="dispense-key-1"
    )
    assert first_dispense.json()["transaction"]["current_state"] == "COMPLETED"
    second_dispense = dispense(
        client, reference, idempotency_key="dispense-key-1"
    )
    assert second_dispense.json()["transitions"] == []
    assert inventory_map(client, admin_headers)[chips]["quantity"] == 17

    other = start_cash_purchase(client, catalog)
    conflict = pay(
        client, other["reference"], "upi", idempotency_key="payment-key-1"
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_upi_failure_without_cash_enters_error_and_releases_stock(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    transaction = start_cash_purchase(client, catalog)
    reference = transaction["reference"]

    failed = pay(client, reference, "upi", simulate_failure=True)
    assert failed.status_code == 200, failed.text
    result = failed.json()["transaction"]
    assert result["current_state"] == "ERROR"
    assert result["stock_reserved"] is False
    assert result["completed_at"] is not None
    assert result["payments"][0]["status"] == "failed"
    assert "declined" in result["error_message"].lower()
    assert failed.json()["transitions"][0]["target"] == "ERROR"

    stock = inventory_map(client, admin_headers)[chips]
    assert stock["reserved_quantity"] == 0
    assert stock["quantity"] == 18

    impossible = dispense(client, reference)
    assert impossible.status_code == 409
    assert impossible.json()["code"] == "DISPENSE_NOT_ALLOWED"

    reset = client.post(f"{API}/transactions/{reference}/reset")
    assert reset.status_code == 200
    assert reset.json()["transaction"]["current_state"] == "IDLE"


def test_upi_failure_after_cash_refunds_cash_and_releases_stock(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    transaction = start_cash_purchase(client, catalog)
    reference = transaction["reference"]

    cash = pay(client, reference, "coin", amount_paise=1000)
    assert cash.json()["transaction"]["current_state"] == "PAYMENT_PENDING"

    failed = pay(client, reference, "upi", simulate_failure=True)
    assert failed.status_code == 200
    result = failed.json()["transaction"]
    assert result["current_state"] == "CANCELLED"
    assert [step["event"] for step in failed.json()["transitions"]] == [
        "PAYMENT_FAILED",
        "PROCESS_REFUND",
    ]
    assert len(result["refunds"]) == 1
    assert result["refunds"][0]["amount_paise"] == 1000
    assert result["payments"][0]["status"] == "refunded"
    assert result["payments"][1]["status"] == "failed"

    stock = inventory_map(client, admin_headers)[chips]
    assert stock["reserved_quantity"] == 0
    assert stock["quantity"] == 18


def test_dispense_failure_refunds_and_restocks_reservation(
    client, catalog, admin_headers
):
    chips = product_id(catalog)
    transaction = start_cash_purchase(client, catalog, quantity=2)
    reference = transaction["reference"]
    pay(client, reference, "upi")

    failed = dispense(
        client,
        reference,
        simulate_failure=True,
        failure_reason="Motor jam detected",
    )
    assert failed.status_code == 200, failed.text
    result = failed.json()["transaction"]
    assert result["current_state"] == "CANCELLED"
    assert result["dispensed"] is False
    assert result["stock_reserved"] is False
    assert result["error_message"] == "Motor jam detected"
    assert [step["event"] for step in failed.json()["transitions"]] == [
        "DISPENSE_PRODUCT",
        "DISPENSE_FAILURE",
        "PROCESS_REFUND",
    ]
    assert result["refunds"][0]["amount_paise"] == 6000
    assert result["payments"][0]["status"] == "refunded"

    stock = inventory_map(client, admin_headers)[chips]
    assert stock["quantity"] == 18
    assert stock["reserved_quantity"] == 0


def test_state_logs_form_a_continuous_trace(client, catalog):
    transaction = complete_cash_purchase(client, catalog)
    detail = client.get(
        f"{API}/transactions/{transaction['reference']}"
    ).json()
    logs = detail["state_logs"]

    assert [log["sequence"] for log in logs] == list(range(1, len(logs) + 1))
    assert logs[0]["previous_state"] == "IDLE"
    assert logs[-1]["next_state"] == "COMPLETED"
    assert all(log["accepted"] is True for log in logs)
    for previous, current in zip(logs, logs[1:]):
        assert previous["next_state"] == current["previous_state"]
        assert current["context_snapshot"]["balance_paise"] >= 0
        assert isinstance(current["context_snapshot"]["total_paise"], int)

    events = [log["event"] for log in logs]
    assert events == [
        "SELECT_PRODUCT",
        "CONFIRM_PRODUCT",
        "STOCK_AVAILABLE",
        "INSERT_NOTE",
        "SUFFICIENT_AMOUNT",
        "DISPENSE_PRODUCT",
        "DISPENSE_SUCCESS",
        "RETURN_CHANGE",
    ]


def test_reset_only_allowed_from_terminal_state(client, catalog):
    transaction = complete_cash_purchase(client, catalog)
    reference = transaction["reference"]

    reset = client.post(f"{API}/transactions/{reference}/reset")
    assert reset.status_code == 200
    assert reset.json()["transaction"]["current_state"] == "IDLE"
    assert reset.json()["transitions"][0]["event"] == "RESET_MACHINE"

    second = client.post(f"{API}/transactions/{reference}/reset")
    assert second.status_code == 409
    assert second.json()["code"] == "FSM_INVALIDTRANSITION"


def test_admin_refund_requires_admin_and_is_idempotent(
    client, catalog, admin_headers, operator_headers
):
    transaction = complete_upi_purchase(client, catalog)
    reference = transaction["reference"]
    payload = {"reason": "Customer reported a damaged item"}

    forbidden = client.post(
        f"{API}/admin/transactions/{reference}/refund",
        json=payload,
        headers=operator_headers,
    )
    assert forbidden.status_code == 403

    refunded = client.post(
        f"{API}/admin/transactions/{reference}/refund",
        json=payload,
        headers=admin_headers,
    )
    assert refunded.status_code == 200, refunded.text
    result = refunded.json()
    assert result["current_state"] == "CANCELLED"
    assert result["refunds"][0]["amount_paise"] == 3000
    assert result["refunds"][0]["reason"] == payload["reason"]
    assert result["payments"][0]["status"] == "refunded"

    repeat = client.post(
        f"{API}/admin/transactions/{reference}/refund",
        json=payload,
        headers=admin_headers,
    )
    assert repeat.status_code == 200
    assert len(repeat.json()["refunds"]) == 1

    detail = client.get(
        f"{API}/admin/transactions/{reference}", headers=admin_headers
    )
    assert detail.status_code == 200
    assert detail.json()["current_state"] == "CANCELLED"


def test_admin_refund_rejects_incomplete_purchase(
    client, catalog, admin_headers
):
    transaction = start_cash_purchase(client, catalog)
    response = client.post(
        f"{API}/admin/transactions/{transaction['reference']}/refund",
        json={"reason": "Not completed yet"},
        headers=admin_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "REFUND_NOT_ALLOWED"


def test_money_must_be_integer_paise_and_duplicate_cart_lines_are_rejected(
    client, catalog
):
    chips = product_id(catalog)
    invalid_money = pay(
        client,
        start_cash_purchase(client, catalog)["reference"],
        "note",
        amount_paise=10.5,
    )
    assert invalid_money.status_code == 422

    duplicate = create_transaction(
        client,
        [
            {"product_id": chips, "quantity": 1},
            {"product_id": chips, "quantity": 2},
        ],
    )
    assert duplicate.status_code == 422
    assert any("duplicate" in error["message"].lower() for error in duplicate.json()["errors"])

    server_error = client.get(f"{API}/transactions/SV-MISSING-000")
    assert server_error.status_code == 404


def test_not_found_transactions_and_unknown_machine(client, catalog):
    missing = client.get(f"{API}/transactions/SV-NOT-FOUND")
    assert missing.status_code == 404

    unknown_machine = create_transaction(
        client,
        [{"product_id": product_id(catalog), "quantity": 1}],
        machine_id=9999,
    )
    assert unknown_machine.status_code == 404
