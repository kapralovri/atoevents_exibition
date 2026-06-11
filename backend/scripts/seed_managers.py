"""Create the initial manager accounts. Run: python -m scripts.seed_managers

Idempotent — safe to re-run. Managers receive a default temporary password
(see app.services.managers_seed.DEFAULT_MANAGER_PASSWORD) and should change it
after first login.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.services.managers_seed import DEFAULT_MANAGER_PASSWORD, MANAGERS, seed_managers


def main() -> None:
    db = SessionLocal()
    try:
        created = seed_managers(db)
        print(f"Managers seeded: {created} created, {len(MANAGERS) - created} already existed")
        if created:
            print(f"Default temporary password: {DEFAULT_MANAGER_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
