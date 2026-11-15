"""The formal EFSM: model integrity, pure simulation and denomination guards."""

from __future__ import annotations

API = "/api/v1"
SAMPLE_ITEMS = [
    {
        "product_id": 1,
        "name": "Masala Chips",
        "unit_price_paise": 3500,
        "quantity": 1,
    }
]


def simulate(client, state, event, context=None, payload=None):
    response = client.post(
        f"{API}/fsm/simulate/step",
        json={
            "state": state,
            "event": event,
            "context": context or {},
            "payload": payload or {},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def base_context(balance=0, total=3500):
    return {
        "transaction_id": 9000,
        "machine_id": 1,
        "items": SAMPLE_ITEMS,
        "balance_paise": balance,
        "total_paise": total,
        "stock_reserved": True,
    }


def test_formal_model_has_13_states_20_events_and_29_deterministic_edges(client):
    response = client.get(f"{API}/fsm/model")
    assert response.status_code == 200
    model = response.json()

    assert model["math"] == "M = (Q, Σ, δ, q0, F)"
    assert model["state_count"] == 13
    assert model["event_count"] == 20
    assert model["transition_count"] == 29
    assert len(model["states"]) == 13
    assert len(model["events"]) == 20
    assert len(model["transitions"]) == 29
    assert model["initial_state"] == "IDLE"
    assert set(model["accepting_states"]) == {"COMPLETED", "CANCELLED"}

    state_ids = {state["id"] for state in model["states"]}
    event_ids = {event["id"] for event in model["events"]}
    edges = {(edge["source"], edge["event"]) for edge in model["transitions"]}
    assert len(edges) == len(model["transitions"]), "δ must be deterministic"

    for edge in model["transitions"]:
        assert edge["source"] in state_ids
        assert edge["event"] in event_ids
        assert edge["description"]
        if edge["dynamic"]:
            assert edge["target"] is None
            assert len(edge["possible_targets"]) == 2
            assert set(edge["possible_targets"]) <= state_ids
        else:
            assert edge["target"] in state_ids

    idle = next(state for state in model["states"] if state["id"] == "IDLE")
    assert idle["is_initial"] is True
    assert idle["label"] == "Idle"


def test_pure_simulation_runs_without_persisting_a_transaction(
    client, admin_headers
):
    before = client.get(f"{API}/admin/transactions", headers=admin_headers).json()

    select = simulate(
        client,
        "IDLE",
        "SELECT_PRODUCT",
        payload={"items": SAMPLE_ITEMS},
    )
    assert select["accepted"] is True
    assert select["source"] == "IDLE"
    assert select["target"] == "PRODUCT_SELECTED"
    assert select["context"]["total_paise"] == 3500
    assert select["is_accepting_state"] is False

    confirm = simulate(client, "PRODUCT_SELECTED", "CONFIRM_PRODUCT", select["context"])
    assert confirm["accepted"] is True
    assert confirm["target"] == "INVENTORY_CHECK"

    stocked = simulate(
        client, "INVENTORY_CHECK", "STOCK_AVAILABLE", confirm["context"]
    )
    assert stocked["accepted"] is True
    assert stocked["target"] == "PAYMENT_PENDING"

    after = client.get(f"{API}/admin/transactions", headers=admin_headers).json()
    assert after["total"] == before["total"] == 0


def test_simulation_rejects_invalid_events_transitions_and_guards(client):
    invalid_event = simulate(client, "IDLE", "TELEPORT")
    assert invalid_event["accepted"] is False
    assert invalid_event["error_code"] == "INVALID_EVENT"
    assert "Σ" in invalid_event["reason"]

    invalid_transition = simulate(client, "COMPLETED", "SELECT_PRODUCT")
    assert invalid_transition["accepted"] is False
    assert invalid_transition["error_code"] == "INVALID_TRANSITION"
    assert invalid_transition["target"] is None

    empty_cart = simulate(client, "IDLE", "SELECT_PRODUCT")
    assert empty_cart["accepted"] is False
    assert empty_cart["error_code"] == "GUARD_REJECTED"
    assert "Select at least one product" in empty_cart["reason"]

    insufficient = simulate(
        client,
        "PAYMENT_PENDING",
        "SUFFICIENT_AMOUNT",
        base_context(balance=1000),
    )
    assert insufficient["accepted"] is False
    assert insufficient["error_code"] == "GUARD_REJECTED"
    assert "Insufficient funds" in insufficient["reason"]

    dispense_early = simulate(
        client, "PAYMENT_PENDING", "DISPENSE_PRODUCT", base_context(balance=3500)
    )
    assert dispense_early["accepted"] is False
    assert dispense_early["error_code"] == "INVALID_TRANSITION"


def test_simulation_rejects_malformed_context_without_a_server_error(client):
    response = client.post(
        f"{API}/fsm/simulate/step",
        json={
            "state": "IDLE",
            "event": "SELECT_PRODUCT",
            "context": {
                "items": [
                    {
                        "product_id": 1,
                        "quantity": 1,
                    }
                ]
            },
            "payload": {},
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["accepted"] is False
    assert body["error_code"] == "INVALID_CONTEXT"
    assert "cart item" in body["reason"]
    assert body["context"]["items"] == []


def test_simulation_accepts_context_without_optional_item_name(client):
    result = simulate(
        client,
        "IDLE",
        "SELECT_PRODUCT",
        {
            "items": [
                {
                    "product_id": 1,
                    "unit_price_paise": 3500,
                    "quantity": 1,
                }
            ]
        },
    )
    assert result["accepted"] is True
    assert result["context"]["items"][0]["name"] == "Product 1"
    assert result["target"] == "PRODUCT_SELECTED"


def test_valid_coin_and_note_denominations_are_guarded(client):
    valid_coins = [100, 200, 500, 1000, 2000]
    for amount in valid_coins:
        result = simulate(
            client,
            "PAYMENT_PENDING",
            "INSERT_COIN",
            base_context(total=1_000_000),
            {"amount_paise": amount, "kind": "coin"},
        )
        assert result["accepted"] is True, amount
        assert result["target"] == "PAYMENT_PENDING"
        assert result["context"]["balance_paise"] == amount

    rejected_coin = simulate(
        client,
        "PAYMENT_PENDING",
        "INSERT_COIN",
        base_context(total=1_000_000),
        {"amount_paise": 5000, "kind": "coin"},
    )
    assert rejected_coin["accepted"] is False
    assert rejected_coin["error_code"] == "GUARD_REJECTED"
    assert "not an accepted coin" in rejected_coin["reason"]

    valid_notes = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000]
    for amount in valid_notes:
        result = simulate(
            client,
            "PAYMENT_PENDING",
            "INSERT_NOTE",
            base_context(total=1_000_000),
            {"amount_paise": amount, "kind": "note"},
        )
        assert result["accepted"] is True, amount
        assert result["context"]["balance_paise"] == amount

    rejected_note = simulate(
        client,
        "PAYMENT_PENDING",
        "INSERT_NOTE",
        base_context(total=1_000_000),
        {"amount_paise": 500, "kind": "note"},
    )
    assert rejected_note["accepted"] is False
    assert "not an accepted note" in rejected_note["reason"]


def test_simulation_payment_paths_and_service_mode(client):
    context = base_context(total=3500)

    inserted = simulate(
        client,
        "PAYMENT_PENDING",
        "INSERT_NOTE",
        context,
        {"amount_paise": 5000, "kind": "note"},
    )
    assert inserted["accepted"] is True
    assert inserted["context"]["balance_paise"] == 5000

    accepted = simulate(
        client,
        "PAYMENT_PENDING",
        "SUFFICIENT_AMOUNT",
        inserted["context"],
    )
    assert accepted["accepted"] is True
    assert accepted["target"] == "PAYMENT_ACCEPTED"

    upi = simulate(
        client,
        "PAYMENT_PENDING",
        "PAYMENT_SUCCESS",
        base_context(),
        {"credit_upi": True},
    )
    assert upi["accepted"] is True
    assert upi["target"] == "PAYMENT_ACCEPTED"
    assert upi["context"]["balance_paise"] == 3500

    failed = simulate(client, "PAYMENT_PENDING", "PAYMENT_FAILED", base_context())
    assert failed["accepted"] is True
    assert failed["target"] == "ERROR"

    failed_with_cash = simulate(
        client, "PAYMENT_PENDING", "PAYMENT_FAILED", base_context(balance=1000)
    )
    assert failed_with_cash["accepted"] is True
    assert failed_with_cash["target"] == "REFUNDING"

    refunded = simulate(
        client,
        "REFUNDING",
        "PROCESS_REFUND",
        {**base_context(balance=3500), "refunded_paise": 0},
    )
    assert refunded["accepted"] is True
    assert refunded["target"] == "CANCELLED"
    assert refunded["is_accepting_state"] is True

    enter = simulate(client, "IDLE", "ENTER_MAINTENANCE")
    assert enter["accepted"] is True
    assert enter["target"] == "MAINTENANCE"
    exit_service = simulate(client, "MAINTENANCE", "EXIT_MAINTENANCE")
    assert exit_service["accepted"] is True
    assert exit_service["target"] == "IDLE"
