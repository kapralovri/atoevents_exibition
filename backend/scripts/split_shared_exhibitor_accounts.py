"""One-off: split exhibitor records that share a login with a staff
(admin/manager) account into their own dedicated exhibitor accounts.

Background: a demo-data import bug left several exhibitor records
pointing at a manager's user_id instead of their own. Renaming that
shared account's email (e.g. via the admin panel) would rename the
manager's login too and lock them out.

For every exhibitor whose user has a staff role, this creates a fresh
EXHIBITOR-role account (unique placeholder email, random password) and
repoints the exhibitor record at it. The admin can then safely set each
one's real email via the admin panel.

Run: python -m scripts.split_shared_exhibitor_accounts
"""
import os
import secrets
import string
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.exhibitor import Exhibitor
from app.models.user import User, UserRole, is_staff


def _random_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main() -> None:
    db = SessionLocal()
    try:
        exhibitors = db.query(Exhibitor).all()
        split = []
        for ex in exhibitors:
            u = db.query(User).filter(User.id == ex.user_id).first()
            if not u or not is_staff(u.role):
                continue
            placeholder_email = f"exhibitor-{ex.id}@placeholder.atocomm.eu"
            new_user = User(
                email=placeholder_email,
                hashed_password=hash_password(_random_password()),
                role=UserRole.EXHIBITOR.value,
            )
            db.add(new_user)
            db.flush()
            split.append((ex.id, ex.company_name, u.email, new_user.id, placeholder_email))
            ex.user_id = new_user.id
        db.commit()

        if not split:
            print("No shared staff/exhibitor accounts found — nothing to split.")
            return

        print(f"Split {len(split)} exhibitor record(s) off shared staff accounts:\n")
        for ex_id, company, staff_email, new_user_id, placeholder in split:
            print(f"  exhibitor #{ex_id:<4} {company:<45} was sharing {staff_email:<28} -> user #{new_user_id} {placeholder}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
