from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import admin, auth, portal
from app.config import settings
from app.core.rate_limit import SlidingWindowLimiter, client_ip, retry_after_seconds
from app.db.session import SessionLocal
from app.models.event import Event
from app.models.exhibitor import Exhibitor
from app.services import storage
from app.services.deadlines import refresh_exhibitor_locks


def _daily_job() -> None:
    db = SessionLocal()
    try:
        today = date.today()
        for ev in db.query(Event).all():
            for ex in db.query(Exhibitor).filter(Exhibitor.event_id == ev.id).all():
                refresh_exhibitor_locks(ex, ev, today)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.ensure_bucket()
    sched = BackgroundScheduler()
    sched.add_job(_daily_job, "cron", hour=8, minute=0)
    sched.start()
    yield
    sched.shutdown(wait=False)


app = FastAPI(title="ATO COMM Exhibitor Portal API", lifespan=lifespan)

_global_limiter = SlidingWindowLimiter(settings.rate_limit_per_minute, 60.0)


# Registered before CORSMiddleware so CORS wraps it and 429 responses
# still carry CORS headers.
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if settings.rate_limit_enabled and request.url.path != "/health":
        retry = _global_limiter.check(client_ip(request))
        if retry > 0:
            seconds = retry_after_seconds(retry)
            return JSONResponse(
                {"detail": "Too many requests. Please slow down."},
                status_code=429,
                headers={"Retry-After": str(seconds)},
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(portal.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
