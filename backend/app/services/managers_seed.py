"""Seed data for ATO COMM manager accounts.

Managers are organizer-side users (full admin-panel access) who can be assigned
as the responsible person / observers on events and who receive event
notifications. The list below is the initial roster requested by the client.

Idempotent: re-running skips emails that already exist. Used both by the
``0006`` migration (so managers exist immediately after ``alembic upgrade head``)
and by the standalone ``scripts/seed_managers.py`` helper.
"""

from __future__ import annotations

from typing import List, Tuple

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole

# Default temporary password assigned to pre-seeded managers. They have full
# admin access and should change it after first login.
DEFAULT_MANAGER_PASSWORD = "Manager1234!"

# (full_name, email). The two double-"@" typos in the source list have been
# corrected (e.savelieva@@ -> @, nkachaev@@ -> @).
MANAGERS: List[Tuple[str, str]] = [
    ("Anastasia Zamotina", "a.zamotina@atocomm.eu"),
    ("Ekaterina Savelieva", "e.savelieva@atocomm.eu"),
    ("Alena Kara", "akara@atocomm.eu"),
    ("Nikita Kachaev", "nkachaev@atocomm.eu"),
    ("Olga Rybak", "orybak@atocomm.eu"),
    ("Andrey Kondrashov", "Andrei.ux.kondrashov@gmail.com"),
    ("Gregory Terekhin", "g.terkhin@atocomm.eu"),
    ("Oksana Geokchaeva", "o.geokchaeva@atocomm.eu"),
    ("Daria Minaeva", "d.minaeva@atocomm.eu"),
    ("Anar Kalibek", "a.kalibek@atocomm.eu"),
    ("Amir Manzhukov", "a.manzhukov@atocomm.eu"),
]


def seed_managers(db: Session, password: str = DEFAULT_MANAGER_PASSWORD) -> int:
    """Create any missing manager accounts. Returns the number created.

    Idempotent — an account whose email already exists is left untouched
    (its role/password are not modified).
    """
    created = 0
    hashed = hash_password(password)
    for full_name, email in MANAGERS:
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            continue
        db.add(
            User(
                email=email,
                full_name=full_name,
                hashed_password=hashed,
                role=UserRole.MANAGER.value,
                is_active=True,
            )
        )
        created += 1
    db.commit()
    return created
