import pytest

from tests.conftest import SAMPLE_VEHICLE


# ---------- Authentication / authorization ----------

def test_listing_vehicles_requires_authentication(client):
    assert client.get("/api/vehicles").status_code == 401
    assert client.get("/api/vehicles/search").status_code == 401


def test_customer_can_list_vehicles(client, create_vehicle, customer_headers):
    create_vehicle()
    create_vehicle(make="Honda", model="Civic")

    response = client.get("/api/vehicles", headers=customer_headers)

    assert response.status_code == 200
    assert [v["make"] for v in response.json()] == ["Honda", "Toyota"]  # ordered by make


def test_list_returns_empty_array_when_no_vehicles(client, customer_headers):
    response = client.get("/api/vehicles", headers=customer_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("post", "/api/vehicles", SAMPLE_VEHICLE),
        ("put", "/api/vehicles/1", {"price": 1000}),
        ("delete", "/api/vehicles/1", None),
        ("post", "/api/vehicles/1/restock", {"quantity": 1}),
    ],
)
def test_admin_only_endpoints_reject_customers_and_anonymous(client, customer_headers, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401
    response = getattr(client, method)(path, headers=customer_headers, **kwargs)
    assert response.status_code == 403
    assert response.json()["detail"] == "Administrator privileges required"


# ---------- Create ----------

def test_admin_can_create_vehicle(client, admin_headers):
    response = client.post("/api/vehicles", json=SAMPLE_VEHICLE, headers=admin_headers)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["make"] == "Toyota" and body["model"] == "Camry" and body["category"] == "Sedan"
    assert body["price"] == 27500.0
    assert body["quantity"] == 5


def test_create_trims_whitespace(client, admin_headers):
    response = client.post(
        "/api/vehicles", json={**SAMPLE_VEHICLE, "make": "  Ford ", "model": " F-150 "}, headers=admin_headers
    )
    assert response.status_code == 201
    assert (response.json()["make"], response.json()["model"]) == ("Ford", "F-150")


@pytest.mark.parametrize(
    "overrides",
    [
        {"price": 0},
        {"price": -100},
        {"price": 12.345},  # more than 2 decimal places
        {"price": 100_000_000},  # above MAX_PRICE
        {"price": "abc"},
        {"quantity": -1},
        {"quantity": 1.5},
        {"quantity": 1_000_000},  # above MAX_STOCK
        {"make": ""},
        {"model": "   "},
        {"category": "x" * 31},
    ],
)
def test_create_rejects_invalid_values(client, admin_headers, overrides):
    response = client.post("/api/vehicles", json={**SAMPLE_VEHICLE, **overrides}, headers=admin_headers)
    assert response.status_code == 422


def test_create_rejects_missing_fields(client, admin_headers):
    response = client.post("/api/vehicles", json={"make": "Toyota"}, headers=admin_headers)
    assert response.status_code == 422


# ---------- Update ----------

def test_admin_can_partially_update_vehicle(client, create_vehicle, admin_headers):
    vehicle = create_vehicle()

    response = client.put(f"/api/vehicles/{vehicle['id']}", json={"price": 25999.99}, headers=admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["price"] == 25999.99
    assert body["make"] == "Toyota" and body["quantity"] == 5  # untouched


def test_update_can_change_every_field(client, create_vehicle, admin_headers):
    vehicle = create_vehicle()
    update = {"make": "Lexus", "model": "ES", "category": "Luxury", "price": 45000, "quantity": 2}

    response = client.put(f"/api/vehicles/{vehicle['id']}", json=update, headers=admin_headers)

    assert response.status_code == 200
    assert {k: response.json()[k] for k in update} == update


def test_update_nonexistent_vehicle_returns_404(client, admin_headers):
    response = client.put("/api/vehicles/9999", json={"price": 1000}, headers=admin_headers)
    assert response.status_code == 404


@pytest.mark.parametrize("update", [{"price": -5}, {"quantity": -1}, {"make": None}, {"make": ""}])
def test_update_rejects_invalid_values(client, create_vehicle, admin_headers, update):
    vehicle = create_vehicle()
    response = client.put(f"/api/vehicles/{vehicle['id']}", json=update, headers=admin_headers)
    assert response.status_code == 422


# ---------- Delete ----------

def test_admin_can_delete_vehicle(client, create_vehicle, admin_headers):
    vehicle = create_vehicle()

    response = client.delete(f"/api/vehicles/{vehicle['id']}", headers=admin_headers)

    assert response.status_code == 204
    assert client.get("/api/vehicles", headers=admin_headers).json() == []
    assert client.delete(f"/api/vehicles/{vehicle['id']}", headers=admin_headers).status_code == 404


def test_vehicle_with_purchase_history_can_be_deleted(client, create_vehicle, admin_headers, customer_headers):
    vehicle = create_vehicle()
    assert client.post(f"/api/vehicles/{vehicle['id']}/purchase", headers=customer_headers).status_code == 200

    assert client.delete(f"/api/vehicles/{vehicle['id']}", headers=admin_headers).status_code == 204


# ---------- Search ----------

@pytest.fixture
def inventory(create_vehicle):
    create_vehicle(make="Toyota", model="Camry", category="Sedan", price=27500)
    create_vehicle(make="Toyota", model="RAV4", category="SUV", price=31000)
    create_vehicle(make="Ford", model="F-150", category="Truck", price=42000)
    create_vehicle(make="Honda", model="Civic", category="Sedan", price=24000)
    create_vehicle(make="Tesla", model="Model 3", category="Electric", price=40000)


def search(client, headers, **params):
    response = client.get("/api/vehicles/search", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return sorted(v["model"] for v in response.json())


def test_search_by_make_is_case_insensitive_partial_match(client, inventory, customer_headers):
    assert search(client, customer_headers, make="toy") == ["Camry", "RAV4"]


def test_search_by_model(client, inventory, customer_headers):
    assert search(client, customer_headers, model="civ") == ["Civic"]


def test_search_by_category_is_case_insensitive_exact_match(client, inventory, customer_headers):
    assert search(client, customer_headers, category="sedan") == ["Camry", "Civic"]
    assert search(client, customer_headers, category="Sed") == []


def test_search_by_price_range(client, inventory, customer_headers):
    assert search(client, customer_headers, min_price=25000, max_price=40000) == ["Camry", "Model 3", "RAV4"]
    assert search(client, customer_headers, min_price=40000) == ["F-150", "Model 3"]
    assert search(client, customer_headers, max_price=24000) == ["Civic"]


def test_search_combines_filters(client, inventory, customer_headers):
    assert search(client, customer_headers, make="toyota", category="suv", max_price=35000) == ["RAV4"]


def test_search_without_filters_returns_everything(client, inventory, customer_headers):
    assert len(search(client, customer_headers)) == 5


def test_search_treats_wildcards_literally(client, inventory, customer_headers):
    assert search(client, customer_headers, make="%") == []
    assert search(client, customer_headers, model="_") == []


@pytest.mark.parametrize(
    "params", [{"min_price": 50000, "max_price": 1000}, {"min_price": -1}, {"max_price": "cheap"}]
)
def test_search_rejects_invalid_price_range(client, customer_headers, params):
    response = client.get("/api/vehicles/search", params=params, headers=customer_headers)
    assert response.status_code == 422


# ---------- Input bounds (found in code review) ----------

@pytest.mark.parametrize(
    "method,path",
    [
        ("put", "/api/vehicles/99999999999"),
        ("delete", "/api/vehicles/99999999999"),
        ("post", "/api/vehicles/99999999999/purchase"),
        ("post", "/api/vehicles/99999999999/restock"),
        ("post", "/api/vehicles/0/purchase"),
    ],
)
def test_out_of_range_vehicle_ids_are_rejected_not_server_errors(client, admin_headers, method, path):
    kwargs = {"json": {"quantity": 1}} if method != "delete" else {}
    response = getattr(client, method)(path, headers=admin_headers, **kwargs)
    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/api/vehicles", "/api/vehicles/search"])
def test_huge_offset_is_rejected_not_server_error(client, customer_headers, path):
    response = client.get(path, params={"offset": 10**20}, headers=customer_headers)
    assert response.status_code == 422


@pytest.mark.parametrize("params", [{"min_price": "NaN"}, {"max_price": "Infinity"}])
def test_search_rejects_non_finite_prices(client, customer_headers, params):
    assert client.get("/api/vehicles/search", params=params, headers=customer_headers).status_code == 422
