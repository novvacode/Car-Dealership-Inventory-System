"""Insert sample vehicles into an empty inventory.

    python -m scripts.seed

Does nothing if any vehicles already exist, so it is safe to re-run.
"""

from decimal import Decimal

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Vehicle

SAMPLE_VEHICLES = [
    ("Toyota", "Camry", "Sedan", "27500.00", 8),
    ("Toyota", "RAV4 Hybrid", "SUV", "33450.00", 5),
    ("Honda", "Civic", "Sedan", "24950.00", 12),
    ("Honda", "CR-V", "SUV", "31200.00", 0),
    ("Ford", "F-150", "Truck", "41995.00", 4),
    ("Ford", "Mustang GT", "Coupe", "44090.00", 2),
    ("Tesla", "Model 3", "Electric", "40240.00", 6),
    ("Tesla", "Model Y", "Electric", "44990.00", 3),
    ("BMW", "X5", "SUV", "65200.00", 2),
    ("BMW", "M4", "Coupe", "79100.00", 1),
    ("Chevrolet", "Silverado", "Truck", "38700.00", 0),
    ("Mazda", "MX-5 Miata", "Convertible", "29930.00", 3),
    ("Hyundai", "Ioniq 5", "Electric", "42600.00", 4),
    ("Volkswagen", "Golf GTI", "Hatchback", "32300.00", 5),
    ("Kia", "Carnival", "Van", "36900.00", 2),
    ("Porsche", "911 Carrera", "Coupe", "116950.00", 1),
]


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Vehicle)):
            print("Inventory is not empty; skipping seed.")
            return
        db.add_all(
            Vehicle(make=make, model=model, category=category, price=Decimal(price), quantity=quantity)
            for make, model, category, price, quantity in SAMPLE_VEHICLES
        )
        db.commit()
        print(f"Seeded {len(SAMPLE_VEHICLES)} vehicles.")


if __name__ == "__main__":
    main()
