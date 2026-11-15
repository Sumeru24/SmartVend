"""Admin console APIs: authentication, RBAC, catalog, inventory and machines."""

from __future__ import annotations

from app.database.session import SessionLocal
from app.models import StateLog
from tests.helpers import cancel, complete_upi_purchase, create_transaction, inventory_map

API = "/api/v1"


def test_login_and_current_user(client, admin_headers, operator_headers):
    admin_me = client.get(f"{API}/auth/me", headers=admin_headers)
    assert admin_me.status_code == 200
    assert admin_me.json()["email"] == "admin@smartvend.in"
    assert admin_me.json()["role"] == "admin"
    assert "hashed_password" not in admin_me.json()

    operator_me = client.get(f"{API}/auth/me", headers=operator_headers)
    assert operator_me.status_code == 200
    assert operator_me.json()["role"] == "operator"

    case_insensitive = client.post(
        f"{API}/auth/login",
        json={"email": "ADMIN@SMARTVEND.IN", "password": "Admin@123"},
    )
    assert case_insensitive.status_code == 200

    wrong = client.post(
        f"{API}/auth/login",
        json={"email": "admin@smartvend.in", "password": "wrong-password"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Incorrect email or password."

    missing_token = client.get(f"{API}/admin/products")
    assert missing_token.status_code == 401

    garbage = client.get(
        f"{API}/admin/products", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert garbage.status_code == 401


def test_role_based_access_control(client, admin_headers, operator_headers):
    read = client.get(f"{API}/admin/products", headers=operator_headers)
    assert read.status_code == 200
    assert len(read.json()) == 12

    denied = client.post(
        f"{API}/admin/categories",
        json={"name": "Operator category", "color": "#123456"},
        headers=operator_headers,
    )
    assert denied.status_code == 403
    assert "permission" in denied.json()["detail"].lower()

    allowed = client.post(
        f"{API}/admin/categories",
        json={"name": "Admin category", "color": "#123456"},
        headers=admin_headers,
    )
    assert allowed.status_code == 201
    assert allowed.json()["slug"] == "admin-category"

    operator_status = client.patch(
        f"{API}/admin/machines/1/status",
        json={"status": "offline"},
        headers=operator_headers,
    )
    assert operator_status.status_code == 200
    assert operator_status.json()["status"] == "offline"

    operator_update_machine = client.patch(
        f"{API}/admin/machines/1",
        json={"name": "Renamed by operator"},
        headers=operator_headers,
    )
    assert operator_update_machine.status_code == 403


def test_catalog_and_public_machine_endpoints(client):
    response = client.get(f"{API}/catalog", params={"machine_id": 1})
    assert response.status_code == 200
    data = response.json()
    assert data["machine_id"] == 1
    assert data["machine_name"] == "Nexus One"
    assert data["machine_status"] == "online"
    assert len(data["products"]) == 12
    assert all(isinstance(product["price_paise"], int) for product in data["products"])
    assert all(product["price_paise"] > 0 for product in data["products"])
    assert all("stock" in product and "slot_code" in product for product in data["products"])

    machines = client.get(f"{API}/catalog/machines")
    assert machines.status_code == 200
    by_code = {machine["code"]: machine for machine in machines.json()}
    assert len(machines.json()) == 3
    assert by_code["SV-MUM-01"]["status"] == "maintenance"

    missing = client.get(f"{API}/catalog", params={"machine_id": 999})
    assert missing.status_code == 404


def test_product_and_category_crud_round_trip(client, admin_headers):
    categories = client.get(f"{API}/admin/categories", headers=admin_headers)
    assert categories.status_code == 200
    assert len(categories.json()) == 5
    category_id = categories.json()[0]["id"]

    create_category = client.post(
        f"{API}/admin/categories",
        json={
            "name": "Breakfast",
            "description": "Morning quick bites",
            "color": "#f97316",
        },
        headers=admin_headers,
    )
    assert create_category.status_code == 201
    new_category = create_category.json()

    payload = {
        "name": "Test Oats Cup",
        "description": "A deterministic test product.",
        "category_id": new_category["id"],
        "price_paise": 12345,
        "sku": "SV-OATS-TEST",
        "initial_stock": 4,
        "low_stock_threshold": 2,
    }
    created = client.post(
        f"{API}/admin/products", json=payload, headers=admin_headers
    )
    assert created.status_code == 201, created.text
    product = created.json()
    assert product["sku"] == "SV-OATS-TEST"
    assert product["price_paise"] == 12345
    assert product["total_stock"] == 12  # initial stock is applied to all 3 machines

    duplicate_sku = client.post(
        f"{API}/admin/products",
        json={**payload, "name": "Another name", "sku": "sv-oats-test"},
        headers=admin_headers,
    )
    assert duplicate_sku.status_code == 409

    decimal_money = client.post(
        f"{API}/admin/products",
        json={**payload, "name": "Decimal money", "sku": "SV-DECIMAL", "price_paise": 12.5},
        headers=admin_headers,
    )
    assert decimal_money.status_code == 422

    updated = client.patch(
        f"{API}/admin/products/{product['id']}",
        json={"price_paise": 15000, "name": "Test Oats Cup XL"},
        headers=admin_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["price_paise"] == 15000
    assert updated.json()["slug"] == "test-oats-cup-xl"

    inventory = inventory_map(client, admin_headers)[product["id"]]
    assert inventory["quantity"] == 4
    assert inventory["low_stock_threshold"] == 2

    used_category = client.delete(
        f"{API}/admin/categories/{new_category['id']}", headers=admin_headers
    )
    assert used_category.status_code == 409

    deleted = client.delete(
        f"{API}/admin/products/{product['id']}", headers=admin_headers
    )
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    gone = client.get(
        f"{API}/admin/products/{product['id']}", headers=admin_headers
    )
    assert gone.status_code == 404

    empty_category = client.delete(
        f"{API}/admin/categories/{new_category['id']}", headers=admin_headers
    )
    assert empty_category.status_code == 200


def test_inventory_restock_threshold_and_logs(
    client, admin_headers, operator_headers
):
    rows = client.get(
        f"{API}/admin/inventory", params={"machine_id": 1}, headers=admin_headers
    ).json()
    assert len(rows) == 12
    chips = next(row for row in rows if row["product_name"].startswith("Saffron"))
    summary = client.get(
        f"{API}/admin/inventory/summary",
        params={"machine_id": 1},
        headers=admin_headers,
    ).json()
    assert summary["sku_count"] == 12
    assert summary["total_units"] == sum(row["quantity"] for row in rows)

    bulk = client.post(
        f"{API}/admin/inventory/bulk",
        json={
            "machine_id": 1,
            "items": [
                {
                    "product_id": chips["product_id"],
                    "quantity": 2,
                    "low_stock_threshold": 5,
                    "slot_code": "A1",
                }
            ],
        },
        headers=admin_headers,
    )
    assert bulk.status_code == 200
    assert bulk.json()["items_updated"] == 1

    low_stock = client.get(
        f"{API}/admin/inventory",
        params={"machine_id": 1, "low_stock": True},
        headers=admin_headers,
    ).json()
    assert any(row["product_id"] == chips["product_id"] for row in low_stock)

    restocked = client.post(
        f"{API}/admin/inventory/{chips['id']}/restock",
        json={"quantity": 10, "reason": "Weekly refill"},
        headers=operator_headers,
    )
    assert restocked.status_code == 200
    assert restocked.json()["quantity"] == 12
    assert restocked.json()["available_quantity"] == 12

    threshold = client.patch(
        f"{API}/admin/inventory/{chips['id']}/threshold",
        json={"low_stock_threshold": 8},
        headers=operator_headers,
    )
    assert threshold.status_code == 200
    assert threshold.json()["low_stock_threshold"] == 8
    assert threshold.json()["is_low_stock"] is False

    logs = client.get(
        f"{API}/admin/inventory/logs",
        params={"machine_id": 1, "product_id": chips["product_id"]},
        headers=admin_headers,
    )
    assert logs.status_code == 200
    reasons = [entry["reason"] for entry in logs.json()["items"]]
    assert "Weekly refill" in reasons
    restock_log = next(
        entry for entry in logs.json()["items"] if entry["reason"] == "Weekly refill"
    )
    assert restock_log["change"] == 10
    assert restock_log["previous_quantity"] == 2
    assert restock_log["new_quantity"] == 12


def test_machine_status_maintenance_blocks_sales_and_logs_transition(
    client, catalog, admin_headers, operator_headers
):
    machines = client.get(f"{API}/admin/machines", headers=admin_headers)
    assert machines.status_code == 200
    assert len(machines.json()) == 3

    maintenance = client.post(
        f"{API}/transactions",
        json={
            "machine_id": 3,
            "items": [{"product_id": catalog["SV-CHP-001"]["id"], "quantity": 1}],
        },
    )
    assert maintenance.status_code == 423
    assert maintenance.json()["code"] == "MACHINE_UNAVAILABLE"

    entered = client.patch(
        f"{API}/admin/machines/1/status",
        json={"status": "maintenance", "reason": "Cleaning the augers"},
        headers=operator_headers,
    )
    assert entered.status_code == 200
    assert entered.json()["status"] == "maintenance"

    blocked = create_transaction(
        client,
        [{"product_id": catalog["SV-CHP-001"]["id"], "quantity": 1}],
        machine_id=1,
    )
    assert blocked.status_code == 423

    alerts = client.get(f"{API}/admin/alerts", headers=operator_headers)
    assert alerts.status_code == 200
    maintenance_alert = next(
        alert
        for alert in alerts.json()
        if alert["type"] == "maintenance"
        and alert["machine_id"] == 1
        and not alert["is_resolved"]
    )
    resolved = client.post(
        f"{API}/admin/alerts/{maintenance_alert['id']}/resolve",
        headers=operator_headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["is_resolved"] is True

    exited = client.patch(
        f"{API}/admin/machines/1/status",
        json={"status": "online"},
        headers=operator_headers,
    )
    assert exited.status_code == 200
    assert exited.json()["status"] == "online"

    accepted = create_transaction(
        client,
        [{"product_id": catalog["SV-CHP-001"]["id"], "quantity": 1}],
        machine_id=1,
    )
    assert accepted.status_code == 201

    with SessionLocal() as db:
        machine_logs = (
            db.query(StateLog)
            .filter(StateLog.machine_id == 1, StateLog.transaction_id.is_(None))
            .order_by(StateLog.sequence)
            .all()
        )
        assert [log.event for log in machine_logs] == [
            "ENTER_MAINTENANCE",
            "EXIT_MAINTENANCE",
        ]
        assert machine_logs[0].previous_state == "IDLE"
        assert machine_logs[0].next_state == "MAINTENANCE"
        assert machine_logs[1].previous_state == "MAINTENANCE"
        assert machine_logs[1].next_state == "IDLE"


def test_machine_crud_and_validation(client, admin_headers, operator_headers):
    created = client.post(
        f"{API}/admin/machines",
        json={
            "code": "SV-DEL-09",
            "name": "Lotus Nine",
            "location": "Connaught Place, Delhi",
            "status": "online",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    machine = created.json()
    assert machine["code"] == "SV-DEL-09"
    assert machine["inventory_count"] == 0

    duplicate = client.post(
        f"{API}/admin/machines",
        json={
            "code": "sv-del-09",
            "name": "Duplicate code",
            "location": "Somewhere",
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 409

    operator_create = client.post(
        f"{API}/admin/machines",
        json={"code": "SV-XXX-01", "name": "Operator machine", "location": "Nowhere"},
        headers=operator_headers,
    )
    assert operator_create.status_code == 403

    renamed = client.patch(
        f"{API}/admin/machines/{machine['id']}",
        json={"name": "Lotus Nine Updated"},
        headers=admin_headers,
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Lotus Nine Updated"

    missing = client.get(f"{API}/admin/machines/9999", headers=admin_headers)
    assert missing.status_code == 404


def test_admin_transaction_search_filters_and_pagination(
    client, catalog, admin_headers
):
    completed = complete_upi_purchase(client, catalog)
    pending = create_transaction(
        client,
        [{"product_id": catalog["SV-COLA-002"]["id"], "quantity": 1}],
    ).json()
    cancelled = cancel(client, pending["reference"], "Test cancellation").json()[
        "transaction"
    ]

    listing = client.get(f"{API}/admin/transactions", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 2

    completed_only = client.get(
        f"{API}/admin/transactions",
        params={"status": "COMPLETED"},
        headers=admin_headers,
    ).json()
    assert completed_only["total"] == 1
    assert completed_only["items"][0]["reference"] == completed["reference"]

    cancelled_only = client.get(
        f"{API}/admin/transactions",
        params={"status": cancelled["current_state"]},
        headers=admin_headers,
    ).json()
    assert cancelled_only["total"] == 1

    search_by_reference = client.get(
        f"{API}/admin/transactions",
        params={"search": completed["reference"]},
        headers=admin_headers,
    ).json()
    assert search_by_reference["total"] == 1

    search_by_product = client.get(
        f"{API}/admin/transactions",
        params={"search": "Saffron"},
        headers=admin_headers,
    ).json()
    assert search_by_product["total"] == 1

    by_machine = client.get(
        f"{API}/admin/transactions",
        params={"machine_id": 1},
        headers=admin_headers,
    ).json()
    assert by_machine["total"] == 2

    paged = client.get(
        f"{API}/admin/transactions",
        params={"page": 1, "page_size": 1},
        headers=admin_headers,
    ).json()
    assert paged["pages"] == 2
    assert len(paged["items"]) == 1

    detail = client.get(
        f"{API}/admin/transactions/{completed['reference']}",
        headers=admin_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["state_logs"]


def test_analytics_dashboard_series_and_reports(
    client, catalog, admin_headers, operator_headers
):
    complete_upi_purchase(client, catalog)
    pending = create_transaction(
        client,
        [{"product_id": catalog["SV-COLA-002"]["id"], "quantity": 1}],
    ).json()
    cancel(client, pending["reference"], "No sale")

    dashboard = client.get(
        f"{API}/admin/analytics/dashboard", headers=admin_headers
    )
    assert dashboard.status_code == 200
    stats = dashboard.json()["stats"]
    assert stats["total_revenue_paise"] == 3000
    assert stats["total_transactions"] == 2
    assert stats["successful_transactions"] == 1
    assert stats["cancelled_transactions"] == 1
    assert stats["units_sold"] == 1
    assert stats["avg_order_paise"] == 3000
    assert stats["total_products"] == 12
    assert len(dashboard.json()["revenue_series"]) == 14
    assert dashboard.json()["top_products"][0]["product_id"] == catalog["SV-CHP-001"]["id"]

    daily = client.get(
        f"{API}/admin/analytics/revenue",
        params={"period": "daily"},
        headers=admin_headers,
    ).json()
    weekly = client.get(
        f"{API}/admin/analytics/revenue",
        params={"period": "weekly"},
        headers=admin_headers,
    ).json()
    monthly = client.get(
        f"{API}/admin/analytics/revenue",
        params={"period": "monthly"},
        headers=admin_headers,
    ).json()
    assert len(daily["items"]) == 14
    assert len(weekly["items"]) == 8
    assert len(monthly["items"]) == 6
    assert daily["total_revenue_paise"] == 3000
    assert weekly["total_revenue_paise"] == 3000
    assert monthly["total_revenue_paise"] == 3000

    products = client.get(
        f"{API}/admin/analytics/products", headers=operator_headers
    ).json()
    assert len(products["all"]) == 12
    assert products["best"][0]["units_sold"] == 1
    assert products["best"][0]["revenue_paise"] == 3000

    categories = client.get(
        f"{API}/admin/analytics/categories", headers=admin_headers
    ).json()
    assert categories[0]["name"] == "Snacks"
    assert categories[0]["revenue_paise"] == 3000

    payments = client.get(
        f"{API}/admin/analytics/payments", headers=admin_headers
    ).json()
    assert payments[0]["method"] == "upi"
    assert payments[0]["count"] == 1
    assert payments[0]["share_percent"] == 100.0

    statuses = client.get(
        f"{API}/admin/analytics/statuses", headers=admin_headers
    ).json()
    status_map = {row["status"]: row["count"] for row in statuses}
    assert status_map["COMPLETED"] == 1
    assert status_map["CANCELLED"] == 1

    inventory = client.get(
        f"{API}/admin/analytics/inventory", headers=admin_headers
    ).json()
    assert len(inventory["by_category"]) == 5
    assert inventory["total_available_units"] > 0
    assert isinstance(inventory["stock_value_paise"], int)

    machine_stats = client.get(
        f"{API}/admin/analytics/machines", headers=admin_headers
    ).json()
    assert len(machine_stats) == 3
    nexus = next(row for row in machine_stats if row["name"] == "Nexus One")
    assert nexus["transactions"] == 1
    assert nexus["revenue_paise"] == 3000

    csv_summary = client.get(
        f"{API}/admin/reports/export",
        params={"format": "csv", "report_type": "summary"},
        headers=admin_headers,
    )
    assert csv_summary.status_code == 200
    assert "text/csv" in csv_summary.headers["content-type"]
    assert "attachment; filename=" in csv_summary.headers["content-disposition"]
    assert "Reference" in csv_summary.text
    assert "COMPLETED" in csv_summary.text

    csv_products = client.get(
        f"{API}/admin/reports/export",
        params={"format": "csv", "report_type": "products"},
        headers=admin_headers,
    )
    assert csv_products.status_code == 200
    assert "Saffron Masala Chips" in csv_products.text

    pdf = client.get(
        f"{API}/admin/reports/export",
        params={"format": "pdf", "report_type": "transactions"},
        headers=admin_headers,
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")

    invalid_format = client.get(
        f"{API}/admin/reports/export",
        params={"format": "xlsx"},
        headers=admin_headers,
    )
    assert invalid_format.status_code == 422
