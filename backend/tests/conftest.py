"""Test fixtures.

Tests run against a real PostgreSQL database (TEST_DATABASE_URL) so that row
locking, CHECK constraints and concurrent purchases behave exactly as in
production. The schema is built with the Alembic migrations.
"""

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parent.parent
_env = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
TEST_DATABASE_URL = _env.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit("TEST_DATABASE_URL is not set (see backend/.env.example)", returncode=2)
if not make_url(TEST_DATABASE_URL).database.endswith("_test"):
    pytest.exit("Refusing to run: TEST_DATABASE_URL database name must end in '_test'", returncode=2)

# Must be set before the app (and its engine) is imported.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-123456")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.security import create_access_token, hash_password  # noqa: E402

PASSWORD = "Str0ngPassw0rd"


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.attributes["database_url"] = TEST_DATABASE_URL
    cfg.attributes["configure_logger"] = False
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE purchases, vehicles, users RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _create_user(email: str, role: Role) -> User:
    with SessionLocal() as db:
        user = User(email=email, full_name="Test User", hashed_password=hash_password(PASSWORD), role=role)
        db.add(user)
        db.commit()
        return user


@pytest.fixture
def customer() -> User:
    return _create_user("customer@example.com", Role.CUSTOMER)


@pytest.fixture
def admin() -> User:
    return _create_user("admin@example.com", Role.ADMIN)


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def customer_headers(customer) -> dict[str, str]:
    return auth_headers(customer)


@pytest.fixture
def admin_headers(admin) -> dict[str, str]:
    return auth_headers(admin)


SAMPLE_VEHICLE = {"make": "Toyota", "model": "Camry", "category": "Sedan", "price": 27500.00, "quantity": 5}


@pytest.fixture
def create_vehicle(client, admin_headers):
    def _create(**overrides):
        response = client.post("/api/vehicles", json={**SAMPLE_VEHICLE, **overrides}, headers=admin_headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _create
