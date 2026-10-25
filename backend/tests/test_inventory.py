import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import SessionLocal
from app.main import app
from app.models import Purchase, Vehicle


def get_quantity(vehicle_id: int) -> int:
    with SessionLocal() as db:
        return db.get(Vehicle, vehicle_id).quantity


def purchase_count(vehicle_id: int) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(Purchase).where(Purchase.vehicle_id == vehicle_id))


# ---------- Purchase ----------

def test_purchase_decrements_stock_and_records_purchase(client, create_vehicle, customer_headers):
    vehicle = create_vehicle(quantity=3)

    response = client.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=customer_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle"]["quantity"] == 2
    assert body["purchase"]["quantity"] == 1
    assert body["purchase"]["unit_price"] == 27500.0
    assert body["purchase"]["vehicle_id"] == vehicle["id"]
    assert get_quantity(vehicle["id"]) == 2
    assert purchase_count(vehicle["id"]) == 1


def test_purchase_multiple_units(client, create_vehicle, customer_headers):
    vehicle = create_vehicle(quantity=5)
    response = client.post(f"/api/vehicles/{vehicle['id']}/purchase", json={"quantity": 5}, headers=customer_headers)
    assert response.status_code == 200
    assert response.json()["vehicle"]["quantity"] == 0


def test_admin_can_also_purchase(client, create_vehicle, admin_headers):
    vehicle = create_vehicle(quantity=1)
    assert client.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=admin_headers).status_code == 200


def test_purchase_when_out_of_stock_is_rejected(client, create_vehicle, customer_headers):
    vehicle = create_vehicle(quantity=0)

    response = client.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=customer_headers)

    assert response.status_code == 409
    assert "stock" in response.json()["detail"].lower()
    assert get_quantity(vehicle["id"]) == 0
    assert purchase_count(vehicle["id"]) == 0


def test_purchase_more_than_available_is_rejected_without_partial_change(client, create_vehicle, customer_headers):
    vehicle = create_vehicle(quantity=2)
    response = client.post(f"/api/vehicles/{vehicle['id']}/purchase", json={"quantity": 3}, headers=customer_headers)
    assert response.status_code == 409
    assert get_quantity(vehicle["id"]) == 2


@pytest.mark.parametrize("quantity", [0, -1, 1.5, "two"])
def test_purchase_rejects_invalid_quantity(client, create_vehicle, customer_headers, quantity):
    vehicle = create_vehicle(quantity=5)
    response = client.post(
        f"/api/vehicles/{vehicle['id']}/purchase", json={"quantity": quantity}, headers=customer_headers
    )
    assert response.status_code == 422
    assert get_quantity(vehicle["id"]) == 5


def test_purchase_nonexistent_vehicle_returns_404(client, customer_headers):
    assert client.post("/api/vehicles/9999/purchase", headers=customer_headers).status_code == 404


def test_purchase_requires_authentication(client, create_vehicle):
    vehicle = create_vehicle()
    assert client.post(f"/api/vehicles/{vehicle['id']}/purchase").status_code == 401
    assert get_quantity(vehicle["id"]) == 5


# ---------- Restock ----------

def test_admin_can_restock(client, create_vehicle, admin_headers):
    vehicle = create_vehicle(quantity=0)

    response = client.post(f"/api/vehicles/{vehicle['id']}/restock", json={"quantity": 7}, headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["quantity"] == 7
    assert get_quantity(vehicle["id"]) == 7


def test_restock_makes_out_of_stock_vehicle_purchasable(client, create_vehicle, admin_headers, customer_headers):
    vehicle = create_vehicle(quantity=0)
    url = f"/api/vehicles/{vehicle['id']}"
    assert client.post(f"{url}/purchase", headers=customer_headers).status_code == 409
    client.post(f"{url}/restock", json={"quantity": 1}, headers=admin_headers)
    assert client.post(f"{url}/purchase", headers=customer_headers).status_code == 200


@pytest.mark.parametrize("quantity", [0, -5, 2.5])
def test_restock_rejects_invalid_quantity(client, create_vehicle, admin_headers, quantity):
    vehicle = create_vehicle(quantity=1)
    response = client.post(f"/api/vehicles/{vehicle['id']}/restock", json={"quantity": quantity}, headers=admin_headers)
    assert response.status_code == 422
    assert get_quantity(vehicle["id"]) == 1


def test_restock_cannot_exceed_maximum_stock(client, create_vehicle, admin_headers):
    vehicle = create_vehicle(quantity=99_999)
    response = client.post(f"/api/vehicles/{vehicle['id']}/restock", json={"quantity": 2}, headers=admin_headers)
    assert response.status_code == 409
    assert get_quantity(vehicle["id"]) == 99_999


def test_restock_nonexistent_vehicle_returns_404(client, admin_headers):
    assert client.post("/api/vehicles/9999/restock", json={"quantity": 1}, headers=admin_headers).status_code == 404


# ---------- Concurrency ----------

def test_concurrent_purchases_never_oversell(create_vehicle, customer_headers):
    """20 buyers race for 5 cars: exactly 5 succeed and stock ends at 0."""
    stock, buyers = 5, 20
    vehicle = create_vehicle(quantity=stock)
    barrier = threading.Barrier(buyers)

    def buy() -> int:
        with TestClient(app) as c:
            barrier.wait()  # release all requests at the same moment
            return c.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=customer_headers).status_code

    with ThreadPoolExecutor(max_workers=buyers) as pool:
        statuses = list(pool.map(lambda _: buy(), range(buyers)))

    assert statuses.count(200) == stock
    assert statuses.count(409) == buyers - stock
    assert get_quantity(vehicle["id"]) == 0
    assert purchase_count(vehicle["id"]) == stock


def test_concurrent_multi_unit_purchases_keep_inventory_consistent(create_vehicle, customer_headers):
    """Mixed-size orders racing for 10 units: sold units always equal the stock decrease."""
    vehicle = create_vehicle(quantity=10)
    orders = [3, 3, 3, 3, 2, 2, 1, 1]
    barrier = threading.Barrier(len(orders))

    def buy(quantity: int) -> tuple[int, int]:
        with TestClient(app) as c:
            barrier.wait()
            r = c.post(f"/api/vehicles/{vehicle['id']}/purchase", json={"quantity": quantity}, headers=customer_headers)
            return r.status_code, quantity

    with ThreadPoolExecutor(max_workers=len(orders)) as pool:
        results = list(pool.map(buy, orders))

    sold = sum(q for status, q in results if status == 200)
    assert all(status in (200, 409) for status, _ in results)
    assert sold <= 10
    assert get_quantity(vehicle["id"]) == 10 - sold
    with SessionLocal() as db:
        recorded = db.scalar(select(func.coalesce(func.sum(Purchase.quantity), 0)).where(Purchase.vehicle_id == vehicle["id"]))
    assert recorded == sold
