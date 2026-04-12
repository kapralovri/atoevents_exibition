import asyncio
import io
import secrets
import string
from datetime import date, timedelta
from typing import Annotated, Any, Optional, List, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.config import settings
from app.core.security import hash_password
from app.models.event import Event, EventDocument
from app.models.exhibitor import Exhibitor
from app.models.faq import FaqItem
from app.models.company import CompanyProfile
from app.models.participant import Participant
from app.models.user import User, UserRole
from app.schemas.portal import AdminStatusBody
from app.services import storage
from app.services.audit_service import log_event
from app.services.deadlines import refresh_exhibitor_locks
from app.services.email_service import render_welcome_exhibitor, send_email

router = APIRouter(prefix="/admin", tags=["admin"])


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    venue_address: Optional[str] = None
    website_url: Optional[str] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue_address: Optional[str] = None
    website_url: Optional[str] = None
    deadline_graphics_initial: Optional[date] = None
    deadline_company_profile: Optional[date] = None
    deadline_participants: Optional[date] = None
    deadline_final_graphics: Optional[date] = None
    reminder_offsets_days: Optional[List[int]] = None
    backdrop_s3_keys: Optional[Dict[str, Any]] = None


class ExhibitorCreate(BaseModel):
    event_id: int
    company_name: str
    email: EmailStr
    stand_package: str = Field(..., pattern="^(SHELL_ONLY|SYSTEM|BESPOKE)$")
    stand_configuration: str = Field(..., pattern="^(LINEAR|ANGULAR|PENINSULA|ISLAND)$")
    area_m2: float = Field(..., gt=0)


class DocPresignBody(BaseModel):
    doc_type: str
    title: str
    version_label: str = "1.0"
    content_type: str = "application/pdf"


class DocCompleteBody(BaseModel):
    s3_key: str
    doc_type: str
    title: str
    version_label: str = "1.0"


class FaqUpsert(BaseModel):
    event_id: Optional[int] = None
    sort_order: int = 0
    question: str
    answer: str


def _default_deadlines(start: date) -> Dict[str, date]:
    return {
        "deadline_graphics_initial": start - timedelta(days=90),
        "deadline_company_profile": start - timedelta(days=60),
        "deadline_participants": start - timedelta(days=30),
        "deadline_final_graphics": start - timedelta(days=14),
    }


def _random_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/events", dependencies=[Depends(require_admin)])
def create_event(body: EventCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    d = _default_deadlines(body.start_date)
    ev = Event(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        end_date=body.end_date,
        venue_address=body.venue_address,
        website_url=body.website_url,
        reminder_offsets_days=[30, 14, 7, 3, 1],
        **d,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {"id": ev.id}


@router.get("/events", dependencies=[Depends(require_admin)])
def list_events(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    rows = db.query(Event).order_by(Event.start_date.desc()).all()
    return [{"id": e.id, "name": e.name, "start_date": str(e.start_date)} for e in rows]


@router.patch("/events/{event_id}", dependencies=[Depends(require_admin)])
def update_event(event_id: int, body: EventUpdate, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)
    db.commit()
    return {"status": "ok"}


@router.post("/events/{event_id}/documents/presign", dependencies=[Depends(require_admin)])
def presign_event_document(event_id: int, body: DocPresignBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    key = storage.new_upload_key(f"events/{event_id}/docs", body.title.replace(" ", "_") + ".pdf")
    p = storage.presign_put(key, body.content_type)
    return {"upload_url": p["url"], "s3_key": key, "doc_type": body.doc_type, "title": body.title, "version_label": body.version_label}


@router.post("/events/{event_id}/documents/complete", dependencies=[Depends(require_admin)])
def complete_event_document(
    event_id: int,
    body: DocCompleteBody,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    doc = EventDocument(
        event_id=event_id,
        doc_type=body.doc_type,
        title=body.title,
        s3_key=body.s3_key,
        version_label=body.version_label,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id}


@router.post("/backdrop/presign", dependencies=[Depends(require_admin)])
def presign_backdrop(
    event_id: int,
    package: str,
    content_type: str = "image/png",
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    key = storage.new_upload_key(f"events/{event_id}/backdrops", f"{package}.png")
    p = storage.presign_put(key, content_type)
    return {"upload_url": p["url"], "s3_key": key, "package": package}


@router.post("/backdrop/complete", dependencies=[Depends(require_admin)])
def complete_backdrop(event_id: int, package: str, s3_key: str, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    keys = dict(ev.backdrop_s3_keys or {})
    keys[package] = s3_key
    ev.backdrop_s3_keys = keys
    db.commit()
    return {"status": "ok"}


@router.post("/exhibitors", dependencies=[Depends(require_admin)])
def create_exhibitor(
    body: ExhibitorCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ev = db.query(Event).filter(Event.id == body.event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    existing = db.query(User).filter(User.email == str(body.email)).first()
    if existing:
        raise HTTPException(400, "User email already exists")
    pwd = _random_password()
    user = User(
        email=str(body.email),
        hashed_password=hash_password(pwd),
        role=UserRole.EXHIBITOR.value,
    )
    db.add(user)
    db.flush()
    ex = Exhibitor(
        event_id=body.event_id,
        user_id=user.id,
        company_name=body.company_name,
        stand_package=body.stand_package,
        stand_configuration=body.stand_configuration,
        area_m2=body.area_m2,
    )
    db.add(ex)
    db.flush()
    cp = CompanyProfile(
        exhibitor_id=ex.id,
        company_name=body.company_name,
        website="https://",
        description="",
    )
    db.add(cp)
    db.commit()
    login_url = "http://localhost:3000/login"
    text, html = render_welcome_exhibitor(login_url, str(body.email), pwd)

    def _send_sync() -> None:
        asyncio.run(send_email(str(body.email), "ATO COMM — Exhibitor Portal access", text, html))

    background_tasks.add_task(_send_sync)
    return {"exhibitor_id": ex.id, "user_id": user.id, "temporary_password": pwd}


@router.get("/events/{event_id}/dashboard", dependencies=[Depends(require_admin)])
def event_dashboard(event_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    rows = db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()
    out: List[Dict[str, Any]] = []
    for ex in rows:
        refresh_exhibitor_locks(ex, ev)
        db.add(ex)
        u = db.query(User).filter(User.id == ex.user_id).first()
        out.append(
            {
                "exhibitor_id": ex.id,
                "company": ex.company_name,
                "email": u.email if u else "",
                "stand": f"{ex.stand_package}/{ex.stand_configuration}/{ex.area_m2}m2",
                "graphics_status": ex.graphics_status,
                "company_status": ex.company_status,
                "participants_status": ex.participants_status,
                "section_locks": {
                    "graphics": ex.section_graphics_locked,
                    "company": ex.section_company_locked,
                    "participants": ex.section_participants_locked,
                },
            }
        )
    db.commit()
    return out


@router.post("/exhibitors/{exhibitor_id}/status")
def set_exhibitor_status(
    exhibitor_id: int,
    body: AdminStatusBody,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    if body.graphics_status:
        ex.graphics_status = body.graphics_status
    if body.company_status:
        ex.company_status = body.company_status
    if body.participants_status:
        ex.participants_status = body.participants_status
    if body.comment:
        if body.graphics_status:
            ex.graphics_admin_comment = body.comment
        if body.company_status:
            ex.company_admin_comment = body.comment
    db.commit()
    log_event(
        db,
        user_id=admin.id,
        event_type="admin_status_change",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        payload={"exhibitor_id": exhibitor_id, "body": body.model_dump()},
    )
    return {"status": "ok"}


@router.post("/exhibitors/{exhibitor_id}/unlock", dependencies=[Depends(require_admin)])
def unlock_sections(
    exhibitor_id: int,
    graphics: bool = False,
    company: bool = False,
    participants: bool = False,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    if graphics:
        ex.section_graphics_locked = False
    if company:
        ex.section_company_locked = False
    if participants:
        ex.section_participants_locked = False
    ex.fully_locked = False
    db.commit()
    return {"status": "ok"}


@router.get("/events/{event_id}/export/participants.xlsx", dependencies=[Depends(require_admin)])
def export_participants(event_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    ex_rows = db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"
    ws.append(
        ["Company", "First Name", "Last Name", "Job Title", "Email", "Phone", "Badge Type"],
    )
    for ex in ex_rows:
        for p in db.query(Participant).filter(Participant.exhibitor_id == ex.id).all():
            ws.append(
                [
                    ex.company_name,
                    p.first_name,
                    p.last_name,
                    p.job_title,
                    p.email,
                    p.phone or "",
                    p.badge_type,
                ]
            )
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="participants_event_{event_id}.xlsx"'},
    )


@router.post("/faq", dependencies=[Depends(require_admin)])
def upsert_faq(body: FaqUpsert, db: Session = Depends(get_db)) -> Dict[str, int]:
    item = FaqItem(
        event_id=body.event_id,
        sort_order=body.sort_order,
        question=body.question,
        answer=body.answer,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id}


@router.get("/faq", dependencies=[Depends(require_admin)])
def list_faq_admin(event_id: Optional[int] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    q = db.query(FaqItem)
    if event_id is not None:
        q = q.filter(FaqItem.event_id == event_id)
    return [
        {"id": f.id, "event_id": f.event_id, "question": f.question, "answer": f.answer, "sort_order": f.sort_order}
        for f in q.order_by(FaqItem.sort_order).all()
    ]
