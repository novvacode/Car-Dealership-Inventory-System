"""Create an administrator account, or promote an existing user to admin.

Public registration only ever creates customers, so this is the only way to
obtain admin rights. Run it from the backend directory:

    python -m scripts.create_admin --email admin@example.com --name "Site Admin"

The password is prompted for (not echoed). For non-interactive environments
such as CI or container start-up, set ADMIN_PASSWORD in the environment instead.
"""

import argparse
import getpass
import os
import sys

from pydantic import ValidationError
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Role, User
from app.schemas import RegisterRequest
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Administrator")
    args = parser.parse_args()

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == args.email.lower()))
        if existing:
            existing.role = Role.ADMIN
            db.commit()
            print(f"Promoted existing user {existing.email} to admin.")
            return

        password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
        if not os.environ.get("ADMIN_PASSWORD") and password != getpass.getpass("Confirm password: "):
            sys.exit("Passwords do not match.")
        try:
            # Reuse the registration rules so admins get the same password policy.
            data = RegisterRequest(email=args.email, full_name=args.name, password=password)
        except ValidationError as exc:
            sys.exit("Invalid input:\n" + "\n".join(f"  - {e['msg']}" for e in exc.errors()))

        db.add(User(email=data.email, full_name=data.full_name,
                    hashed_password=hash_password(data.password), role=Role.ADMIN))
        db.commit()
        print(f"Created admin {data.email}.")


if __name__ == "__main__":
    main()
