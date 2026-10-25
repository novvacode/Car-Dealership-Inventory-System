from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models import Role

MAX_PRICE = Decimal("10000000")
MAX_STOCK = 100_000

# Prices are stored as NUMERIC(12,2) and validated as Decimal (no float
# rounding), but serialised as JSON numbers for the frontend.
Price = Annotated[
    Decimal,
    Field(gt=0, le=MAX_PRICE, max_digits=12, decimal_places=2),
    PlainSerializer(float, return_type=float),
]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if len(value.encode()) > 72:  # bcrypt only uses the first 72 bytes
            raise ValueError("Password must be at most 72 bytes")
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Role


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Vehicles ----------

class VehicleBase(BaseModel):
    make: Name
    model: Name
    category: Category
    price: Price


class VehicleCreate(VehicleBase):
    quantity: int = Field(ge=0, le=MAX_STOCK)


class VehicleUpdate(BaseModel):
    """Partial update: only supplied fields are changed."""

    make: Name | None = None
    model: Name | None = None
    category: Category | None = None
    price: Price | None = None
    quantity: int | None = Field(default=None, ge=0, le=MAX_STOCK)

    @model_validator(mode="after")
    def reject_explicit_nulls(self):
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class VehicleOut(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quantity: int
    created_at: datetime
    updated_at: datetime


class QuantityRequest(BaseModel):
    quantity: int = Field(default=1, ge=1, le=MAX_STOCK)


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int | None
    quantity: int
    unit_price: Annotated[Decimal, PlainSerializer(float, return_type=float)]
    created_at: datetime


class PurchaseResponse(BaseModel):
    purchase: PurchaseOut
    vehicle: VehicleOut
