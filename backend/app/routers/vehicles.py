from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Path, Query, Response, status
from sqlalchemy import Select, func, select, update

from app.deps import AdminUser, CurrentUser, DbSession
from app.models import Purchase, Vehicle
from app.schemas import (
    MAX_STOCK,
    PurchaseOut,
    PurchaseResponse,
    QuantityRequest,
    VehicleCreate,
    VehicleOut,
    VehicleUpdate,
)

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])

PG_INT_MAX = 2**31 - 1  # ids are PostgreSQL INTEGER; larger values would raise a DataError (500)

VehicleId = Annotated[int, Path(ge=1, le=PG_INT_MAX)]
Limit = Annotated[int, Query(ge=1, le=500)]
Offset = Annotated[int, Query(ge=0, le=PG_INT_MAX)]
PriceFilter = Annotated[Decimal | None, Query(ge=0)]
TextFilter = Annotated[str | None, Query(max_length=50)]
DEFAULT_QUANTITY = Body(default_factory=QuantityRequest)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")


def _get_or_404(db: DbSession, vehicle_id: int) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise _not_found()
    return vehicle


def _ordered(query: Select, limit: int, offset: int) -> Select:
    return query.order_by(Vehicle.make, Vehicle.model, Vehicle.id).limit(limit).offset(offset)


def _contains(value: str) -> str:
    """ILIKE pattern for a substring match, treating % and _ literally."""
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("", response_model=list[VehicleOut])
def list_vehicles(db: DbSession, _: CurrentUser, limit: Limit = 100, offset: Offset = 0):
    return db.scalars(_ordered(select(Vehicle), limit, offset)).all()


@router.get("/search", response_model=list[VehicleOut])
def search_vehicles(
    db: DbSession,
    _: CurrentUser,
    make: TextFilter = None,
    model: TextFilter = None,
    category: TextFilter = None,
    min_price: PriceFilter = None,
    max_price: PriceFilter = None,
    limit: Limit = 100,
    offset: Offset = 0,
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="min_price must be less than or equal to max_price",
        )
    query = select(Vehicle)
    if make and make.strip():
        query = query.where(Vehicle.make.ilike(_contains(make.strip()), escape="\\"))
    if model and model.strip():
        query = query.where(Vehicle.model.ilike(_contains(model.strip()), escape="\\"))
    if category and category.strip():
        query = query.where(func.lower(Vehicle.category) == category.strip().lower())
    if min_price is not None:
        query = query.where(Vehicle.price >= min_price)
    if max_price is not None:
        query = query.where(Vehicle.price <= max_price)
    return db.scalars(_ordered(query, limit, offset)).all()


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, db: DbSession, _: AdminUser):
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: VehicleId, payload: VehicleUpdate, db: DbSession, _: AdminUser):
    # Row lock so a concurrent purchase cannot interleave with an admin edit
    # of the quantity (the edit would otherwise silently overwrite the sale).
    vehicle = db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update())
    if vehicle is None:
        raise _not_found()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: VehicleId, db: DbSession, _: AdminUser) -> Response:
    db.delete(_get_or_404(db, vehicle_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{vehicle_id}/purchase", response_model=PurchaseResponse)
def purchase_vehicle(
    vehicle_id: VehicleId, db: DbSession, user: CurrentUser, payload: QuantityRequest = DEFAULT_QUANTITY
):
    # A single conditional UPDATE is atomic in PostgreSQL: concurrent buyers
    # serialise on the row lock, and each re-checks `quantity >= :n` against
    # the committed value, so stock can never go negative or be oversold.
    vehicle = db.scalar(
        update(Vehicle)
        .where(Vehicle.id == vehicle_id, Vehicle.quantity >= payload.quantity)
        .values(quantity=Vehicle.quantity - payload.quantity)
        .returning(Vehicle)
    )
    if vehicle is None:
        db.rollback()
        _get_or_404(db, vehicle_id)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient stock for this purchase")

    purchase = Purchase(
        user_id=user.id, vehicle_id=vehicle.id, quantity=payload.quantity, unit_price=vehicle.price
    )
    db.add(purchase)
    db.commit()  # stock decrement and purchase record commit together
    db.refresh(purchase)
    return PurchaseResponse(purchase=PurchaseOut.model_validate(purchase), vehicle=VehicleOut.model_validate(vehicle))


@router.post("/{vehicle_id}/restock", response_model=VehicleOut)
def restock_vehicle(vehicle_id: VehicleId, payload: QuantityRequest, db: DbSession, _: AdminUser):
    vehicle = db.scalar(
        update(Vehicle)
        .where(Vehicle.id == vehicle_id, Vehicle.quantity + payload.quantity <= MAX_STOCK)
        .values(quantity=Vehicle.quantity + payload.quantity)
        .returning(Vehicle)
    )
    if vehicle is None:
        db.rollback()
        _get_or_404(db, vehicle_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Stock cannot exceed {MAX_STOCK} units"
        )
    db.commit()
    return vehicle
