"""Create default admin user. Run: python -m scripts.seed_admin"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole


def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@atocomm.eu")
    password = os.environ.get("ADMIN_PASSWORD", "admin123!")
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print("Admin already exists")
            return
        u = User(
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN.value,
        )
        db.add(u)
        db.commit()
        print(f"Created admin {email} / {password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
