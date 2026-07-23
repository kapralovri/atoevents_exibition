import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.core.login_bruteforce import login_guard
from app.core.rate_limit import SlidingWindowLimiter, client_ip, retry_after_seconds
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.services.email_service import render_password_changed, send_email

router = APIRouter(prefix="/auth", tags=["auth"])

_login_ip_limiter = SlidingWindowLimiter(settings.login_rate_limit_per_minute, 60.0)


def _too_many_attempts(retry: float) -> HTTPException:
    seconds = retry_after_seconds(retry)
    if seconds >= 120:
        human = f"{(seconds + 59) // 60} minutes"
    else:
        human = f"{seconds} seconds"
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many login attempts. Try again in {human}.",
        headers={"Retry-After": str(seconds)},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    email = str(body.email)
    if settings.rate_limit_enabled:
        retry = _login_ip_limiter.check(client_ip(request))
        if retry > 0:
            raise _too_many_attempts(retry)
        locked = login_guard.seconds_locked(email)
        if locked > 0:
            raise _too_many_attempts(locked)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        if settings.rate_limit_enabled:
            login_guard.register_failure(email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    login_guard.reset(email)
    token = create_access_token(subject=user.email, extra={"role": user.role, "uid": user.id})
    return TokenResponse(access_token=token)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(body.old_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")
    user.hashed_password = hash_password(body.new_password)
    db.commit()

    def _notify() -> None:
        text, html = render_password_changed(settings.frontend_url)
        asyncio.run(send_email(user.email, "ATO COMM — Password changed", text, html))

    import threading
    threading.Thread(target=_notify, daemon=True).start()

    return {"status": "ok"}
