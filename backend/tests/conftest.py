"""Test bootstrap.

The database URL is overridden *before* the FastAPI app is imported so the
suite can never touch the developer's smartvend.db. Each test starts from a
fresh schema with deterministic demo users, catalog, machines and stock.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
TEST_DB_PATH = TESTS_DIR / "test_smartvend.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "smartvend-test-secret-not-for-production-7f4c2a"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

from fastapi.testclient import TestClient  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.seed import seed_demo_data  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    TEST_DB_PATH.unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def fresh_database(client):
    """Recreate the schema and deterministic seed data for every test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db, include_history=False)
    yield


@pytest.fixture()
def db():
    with SessionLocal() as session:
        yield session


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post(
        f"{API}/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def admin_headers(client):
    return _login(client, "admin@smartvend.in", "Admin@123")


@pytest.fixture()
def operator_headers(client):
    return _login(client, "operator@smartvend.in", "Operator@123")


@pytest.fixture()
def catalog(client):
    response = client.get(f"{API}/catalog", params={"machine_id": 1})
    assert response.status_code == 200, response.text
    return {product["sku"]: product for product in response.json()["products"]}
