from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, portal
from app.config import settings
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
