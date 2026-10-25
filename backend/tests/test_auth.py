from datetime import datetime, timedelta, timezone

import jwt

from app.database import SessionLocal
from app.models import User
from tests.conftest import PASSWORD

NEW_USER = {"email": "Jane.Doe@Example.com", "full_name": "Jane Doe", "password": "S3curePass"}


def register(client, **overrides):
    return client.post("/api/auth/register", json={**NEW_USER, **overrides})


# ---------- Registration ----------

def test_register_creates_customer_account(client):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "jane.doe@example.com"  # normalised to lower case
    assert body["full_name"] == "Jane Doe"
    assert body["role"] == "customer"
    assert "password" not in body and "hashed_password" not in body


def test_register_stores_hashed_password_not_plaintext(client):
    register(client)
    with SessionLocal() as db:
        user = db.query(User).one()
    assert user.hashed_password != NEW_USER["password"]
    assert user.hashed_password.startswith("$2b$")


def test_register_duplicate_email_is_rejected_case_insensitively(client):
    assert register(client).status_code == 201
    response = register(client, email="JANE.DOE@example.com")
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


def test_register_cannot_self_assign_admin_role(client):
    response = register(client, role="admin")
    assert response.status_code == 201
    assert response.json()["role"] == "customer"


def test_register_rejects_invalid_input(client):
    assert register(client, email="not-an-email").status_code == 422
    assert register(client, password="short1").status_code == 422
    assert register(client, password="nodigitsatall").status_code == 422
    assert register(client, password="12345678").status_code == 422
    assert register(client, password="a1" * 40).status_code == 422  # > 72 bytes
    assert register(client, full_name="   ").status_code == 422
    assert client.post("/api/auth/register", json={}).status_code == 422


# ---------- Login ----------

def test_login_returns_token_and_user(client):
    register(client)
    response = client.post("/api/auth/login", json={"email": "jane.doe@example.com", "password": "S3curePass"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "jane.doe@example.com"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "jane.doe@example.com"


def test_login_email_is_case_insensitive(client):
    register(client)
    response = client.post("/api/auth/login", json={"email": "JANE.DOE@EXAMPLE.COM", "password": "S3curePass"})
    assert response.status_code == 200


def test_login_with_wrong_password_is_unauthorized(client, customer):
    response = client.post("/api/auth/login", json={"email": customer.email, "password": "Wrong-pass1"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_with_unknown_email_gives_same_error(client):
    response = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_rejects_malformed_body(client):
    assert client.post("/api/auth/login", json={"email": "x"}).status_code == 422


# ---------- Token verification ----------

def test_me_requires_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_rejects_garbage_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def _token(user_id: int, key: str, expires_in: timedelta) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + expires_in}, key, algorithm="HS256")


def test_me_rejects_expired_token(client, customer):
    from app.config import get_settings

    token = _token(customer.id, get_settings().secret_key, timedelta(minutes=-1))
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_me_rejects_token_signed_with_other_key(client, customer):
    token = _token(customer.id, "some-other-secret-key-of-sufficient-length", timedelta(minutes=5))
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_me_rejects_unsigned_token(client, customer):
    token = jwt.encode({"sub": str(customer.id)}, key=None, algorithm="none")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_for_deleted_user_is_rejected(client, customer, customer_headers):
    with SessionLocal() as db:
        db.delete(db.get(User, customer.id))
        db.commit()
    assert client.get("/api/auth/me", headers=customer_headers).status_code == 401
