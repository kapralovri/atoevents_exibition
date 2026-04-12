import asyncio
import io
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any, Optional, List, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.config import settings
from app.core.security import hash_password
from app.models.audit import AuditLog
from app.models.event import Event, EventDocument
from app.models.exhibitor import Exhibitor
from app.models.faq import FaqItem
from app.models.company import CompanyProfile
from app.models.graphic import GraphicUpload
from app.models.participant import Participant
from app.models.user import User, UserRole
from app.schemas.portal import AdminStatusBody
from app.services import storage
from app.services.audit_service import log_event
from app.services.deadlines import refresh_exhibitor_locks
from app.services.email_service import render_welcome_exhibitor, send_email

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class StandSlotConfig(BaseModel):
    enabled: bool = True
    count: int = Field(0, ge=0)
    area_m2: float = Field(0.0, ge=0)


class EventCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=512)
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    venue_address: Optional[str] = None
    website_url: Optional[str] = None
    status: str = "upcoming"
    alias_shell: str = "СТАРТ"
    alias_system: str = "ПРО"
    alias_bespoke: str = "ИНДИВИДУАЛ"
    stand_slots: Optional[Dict[str, Any]] = None
    deadline_graphics_initial: Optional[date] = None
    deadline_company_profile: Optional[date] = None
    deadline_participants: Optional[date] = None
    deadline_final_graphics: Optional[date] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    venue_address: Optional[str] = None
    website_url: Optional[str] = None
    status: Optional[str] = None
    alias_shell: Optional[str] = None
    alias_system: Optional[str] = None
    alias_bespoke: Optional[str] = None
    stand_slots: Optional[Dict[str, Any]] = None
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


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def _is_exhibitor_complete(ex: Exhibitor) -> bool:
    """True when all three submission sections are in a terminal-success state."""
    graphics_done = ex.graphics_status in ("APPROVED", "VALID")
    company_done = ex.company_status in ("APPROVED", "SUBMITTED")
    participants_done = ex.participants_status in ("SUBMITTED",)
    return graphics_done and company_done and participants_done


# ── Event endpoints ───────────────────────────────────────────────────────────

@router.post("/events", dependencies=[Depends(require_admin)])
def create_event(body: EventCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    auto = _default_deadlines(body.start_date)
    ev = Event(
        name=body.name,
        description=body.description,
        start_date=body.start_date,
        end_date=body.end_date,
        venue_address=body.venue_address,
        website_url=body.website_url,
        status=body.status,
        alias_shell=body.alias_shell,
        alias_system=body.alias_system,
        alias_bespoke=body.alias_bespoke,
        stand_slots=body.stand_slots,
        reminder_offsets_days=[30, 14, 7, 3, 1],
        deadline_graphics_initial=body.deadline_graphics_initial or auto["deadline_graphics_initial"],
        deadline_company_profile=body.deadline_company_profile or auto["deadline_company_profile"],
        deadline_participants=body.deadline_participants or auto["deadline_participants"],
        deadline_final_graphics=body.deadline_final_graphics or auto["deadline_final_graphics"],
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {"id": ev.id}


@router.get("/events", dependencies=[Depends(require_admin)])
def list_events(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    rows = db.query(Event).order_by(Event.start_date.desc()).all()
    result = []
    for e in rows:
        exs = db.query(Exhibitor).filter(Exhibitor.event_id == e.id).all()
        completed = sum(1 for ex in exs if _is_exhibitor_complete(ex))
        result.append({
            "id": e.id,
            "name": e.name,
            "date": str(e.start_date),
            "start_date": str(e.start_date),
            "end_date": str(e.end_date) if e.end_date else None,
            "location": e.venue_address or "",
            "website_url": e.website_url or "",
            "status": e.status,
            "exhibitor_count": len(exs),
            "completed_count": completed,
            "deadline_graphics_initial": str(e.deadline_graphics_initial) if e.deadline_graphics_initial else None,
            "deadline_company_profile": str(e.deadline_company_profile) if e.deadline_company_profile else None,
            "deadline_participants": str(e.deadline_participants) if e.deadline_participants else None,
            "deadline_final_graphics": str(e.deadline_final_graphics) if e.deadline_final_graphics else None,
        })
    return result


@router.get("/events/{event_id}", dependencies=[Depends(require_admin)])
def get_event(event_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    exs = db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()
    completed = sum(1 for ex in exs if _is_exhibitor_complete(ex))
    docs = [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "title": d.title,
            "s3_key": d.s3_key,
            "version_label": d.version_label,
            "created_at": d.created_at.isoformat(),
        }
        for d in ev.documents
    ]
    return {
        "id": ev.id,
        "name": ev.name,
        "description": ev.description,
        "date": str(ev.start_date),
        "start_date": str(ev.start_date),
        "end_date": str(ev.end_date) if ev.end_date else None,
        "location": ev.venue_address or "",
        "venue_address": ev.venue_address or "",
        "website_url": ev.website_url or "",
        "status": ev.status,
        "alias_shell": ev.alias_shell,
        "alias_system": ev.alias_system,
        "alias_bespoke": ev.alias_bespoke,
        "stand_slots": ev.stand_slots,
        "backdrop_s3_keys": ev.backdrop_s3_keys,
        "deadline_graphics": str(ev.deadline_graphics_initial) if ev.deadline_graphics_initial else None,
        "deadline_description": str(ev.deadline_company_profile) if ev.deadline_company_profile else None,
        "deadline_participants": str(ev.deadline_participants) if ev.deadline_participants else None,
        "deadline_final_graphics": str(ev.deadline_final_graphics) if ev.deadline_final_graphics else None,
        "exhibitor_count": len(exs),
        "completed_count": completed,
        "documents": docs,
    }


@router.patch("/events/{event_id}", dependencies=[Depends(require_admin)])
def update_event(event_id: int, body: EventUpdate, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)
    db.commit()
    return {"status": "ok"}


@router.get("/events/{event_id}/exhibitors", dependencies=[Depends(require_admin)])
def list_event_exhibitors(event_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    rows = db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()
    result = []
    for ex in rows:
        refresh_exhibitor_locks(ex, ev)
        db.add(ex)
        u = db.query(User).filter(User.id == ex.user_id).first()
        result.append({
            "id": ex.id,
            "company_name": ex.company_name,
            "email": u.email if u else "",
            "stand_package": ex.stand_package,
            "stand_configuration": ex.stand_configuration,
            "area_m2": ex.area_m2,
            "graphics_status": ex.graphics_status,
            "description_status": ex.company_status,
            "participants_status": ex.participants_status,
            "overall_status": "locked" if ex.fully_locked else (
                "complete" if _is_exhibitor_complete(ex) else "in_progress"
            ),
            "booth_type": ex.stand_package.lower().replace("_", " "),
            "booth_size": ex.area_m2,
        })
    db.commit()
    return result


# ── Document + backdrop endpoints ─────────────────────────────────────────────

@router.post("/events/{event_id}/documents/presign", dependencies=[Depends(require_admin)])
def presign_event_document(event_id: int, body: DocPresignBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    key = storage.new_upload_key(f"events/{event_id}/docs", body.title.replace(" ", "_") + ".pdf")
    p = storage.presign_put(key, body.content_type)
    return {"upload_url": p["url"], "s3_key": key, "doc_type": body.doc_type, "title": body.title, "version_label": body.version_label}


@router.post("/events/{event_id}/documents/complete", dependencies=[Depends(require_admin)])
def complete_event_document(event_id: int, body: DocCompleteBody, db: Session = Depends(get_db)) -> Dict[str, Any]:
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
def presign_backdrop(event_id: int, package: str, content_type: str = "image/png", db: Session = Depends(get_db)) -> Dict[str, str]:
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


# ── Exhibitor endpoints ───────────────────────────────────────────────────────

@router.post("/exhibitors", dependencies=[Depends(require_admin)])
def create_exhibitor(body: ExhibitorCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> Dict[str, Any]:
    ev = db.query(Event).filter(Event.id == body.event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    existing = db.query(User).filter(User.email == str(body.email)).first()
    if existing:
        raise HTTPException(400, "User email already exists")
    pwd = _random_password()
    user = User(email=str(body.email), hashed_password=hash_password(pwd), role=UserRole.EXHIBITOR.value)
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
    cp = CompanyProfile(exhibitor_id=ex.id, company_name=body.company_name, website="https://", description="")
    db.add(cp)
    db.commit()
    login_url = "http://localhost:3000/login"
    text, html = render_welcome_exhibitor(login_url, str(body.email), pwd)

    def _send_sync() -> None:
        asyncio.run(send_email(str(body.email), "ATO COMM — Exhibitor Portal access", text, html))

    background_tasks.add_task(_send_sync)
    return {"exhibitor_id": ex.id, "user_id": user.id, "temporary_password": pwd}


@router.get("/exhibitors/{exhibitor_id}", dependencies=[Depends(require_admin)])
def get_exhibitor(exhibitor_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    u = db.query(User).filter(User.id == ex.user_id).first()
    graphics = db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all()
    return {
        "id": ex.id,
        "company_name": ex.company_name,
        "email": u.email if u else "",
        "booth_type": ex.stand_package.lower().replace("_", " "),
        "booth_config": ex.stand_configuration.lower(),
        "booth_size": ex.area_m2,
        "stand_package": ex.stand_package,
        "stand_configuration": ex.stand_configuration,
        "area_m2": ex.area_m2,
        "overall_status": "locked" if ex.fully_locked else (
            "complete" if _is_exhibitor_complete(ex) else "in_progress"
        ),
        "graphics_status": ex.graphics_status,
        "description_status": ex.company_status,
        "participants_status": ex.participants_status,
        "gdpr_accepted": ex.gdpr_consent_at is not None,
        "company_description": ex.company_profile.description if ex.company_profile else "",
        "graphics": [
            {
                "id": g.id,
                "slot_key": g.slot_key,
                "slot_label": g.slot_label,
                "file_name": g.original_filename,
                "file_size": g.size_bytes,
                "uploaded_at": g.created_at.isoformat(),
                "status": g.validation_status.lower(),
                "admin_comment": ex.graphics_admin_comment,
                "version_number": None,
            }
            for g in graphics
        ],
    }


@router.get("/exhibitors/{exhibitor_id}/graphics", dependencies=[Depends(require_admin)])
def get_exhibitor_graphics(exhibitor_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    graphics = db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all()
    return [
        {
            "id": g.id,
            "slot_key": g.slot_key,
            "slot_label": g.slot_label,
            "file_name": g.original_filename,
            "file_size": g.size_bytes,
            "uploaded_at": g.created_at.isoformat(),
            "status": g.validation_status.lower(),
            "admin_comment": ex.graphics_admin_comment,
            "version_number": None,
        }
        for g in graphics
    ]


@router.post("/graphics/{upload_id}/approve", dependencies=[Depends(require_admin)])
def approve_graphic(upload_id: int, db: Session = Depends(get_db)) -> Dict[str, str]:
    g = db.query(GraphicUpload).filter(GraphicUpload.id == upload_id).first()
    if not g:
        raise HTTPException(404, "Upload not found")
    g.validation_status = "VALID"
    ex = db.query(Exhibitor).filter(Exhibitor.id == g.exhibitor_id).first()
    if ex:
        ex.graphics_status = "APPROVED"
        ex.graphics_admin_comment = None
    db.commit()
    return {"status": "ok"}


@router.post("/graphics/{upload_id}/revision", dependencies=[Depends(require_admin)])
def request_graphic_revision(upload_id: int, body: Dict[str, str], db: Session = Depends(get_db)) -> Dict[str, str]:
    g = db.query(GraphicUpload).filter(GraphicUpload.id == upload_id).first()
    if not g:
        raise HTTPException(404, "Upload not found")
    g.validation_status = "INVALID"
    g.validation_message = body.get("comment", "")
    ex = db.query(Exhibitor).filter(Exhibitor.id == g.exhibitor_id).first()
    if ex:
        ex.graphics_status = "REVISION_NEEDED"
        ex.graphics_admin_comment = body.get("comment", "")
    db.commit()
    return {"status": "ok"}


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


@router.post("/exhibitors/{exhibitor_id}/reminder", dependencies=[Depends(require_admin)])
def send_reminder(exhibitor_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> Dict[str, str]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    u = db.query(User).filter(User.id == ex.user_id).first()
    if u:
        def _send() -> None:
            asyncio.run(send_email(u.email, "ATO COMM — Reminder", f"Please complete your portal tasks for {ex.company_name}.", ""))
        background_tasks.add_task(_send)
    return {"status": "ok"}


# ── Dashboard / legacy ────────────────────────────────────────────────────────

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
        out.append({
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
        })
    db.commit()
    return out


# ── Participants export ───────────────────────────────────────────────────────

@router.get("/events/{event_id}/export/participants", dependencies=[Depends(require_admin)])
@router.get("/events/{event_id}/export/participants.xlsx", dependencies=[Depends(require_admin)])
def export_participants(event_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    ex_rows = db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"
    ws.append(["Company", "First Name", "Last Name", "Job Title", "Email", "Phone", "Badge Type"])
    for ex in ex_rows:
        for p in db.query(Participant).filter(Participant.exhibitor_id == ex.id).all():
            ws.append([ex.company_name, p.first_name, p.last_name, p.job_title, p.email, p.phone or "", p.badge_type])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="participants_event_{event_id}.xlsx"'},
    )


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit", dependencies=[Depends(require_admin)])
def list_audit_logs(limit: int = 500, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 1000))
        .all()
    )
    result = []
    for log in logs:
        actor_name = "system"
        if log.user_id:
            u = db.query(User).filter(User.id == log.user_id).first()
            actor_name = u.email if u else f"user#{log.user_id}"
        actor_type = "admin" if (log.payload or {}).get("role") == "admin" else "exhibitor"
        # Derive a human-readable action from event_type
        details = ""
        payload = log.payload or {}
        if isinstance(payload, dict):
            details = payload.get("detail") or payload.get("message") or str(payload)[:120]
        result.append({
            "id": log.id,
            "actor_type": actor_type,
            "actor_name": actor_name,
            "action": log.event_type,
            "entity_type": payload.get("entity_type", ""),
            "entity_id": str(payload.get("entity_id", "")),
            "details": details,
            "created_at": log.created_at.isoformat(),
        })
    return result


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics", dependencies=[Depends(require_admin)])
def get_analytics(event_id: Optional[int] = None, db: Session = Depends(get_db)) -> Dict[str, Any]:
    q = db.query(Exhibitor)
    if event_id:
        q = q.filter(Exhibitor.event_id == event_id)
    all_ex = q.all()
    total = len(all_ex)
    completed = sum(1 for ex in all_ex if _is_exhibitor_complete(ex))
    in_progress = sum(1 for ex in all_ex if not _is_exhibitor_complete(ex) and not ex.fully_locked)
    locked = sum(1 for ex in all_ex if ex.fully_locked)

    completion_rate = round((completed / total * 100) if total else 0)

    # Days to nearest deadline
    days_to_deadline = 0
    if event_id:
        ev = db.query(Event).filter(Event.id == event_id).first()
        if ev and ev.deadline_participants:
            diff = (ev.deadline_participants - date.today()).days
            days_to_deadline = max(diff, 0)
    else:
        # Pick nearest upcoming deadline across all active events
        events = db.query(Event).filter(Event.status == "active").all()
        upcoming = []
        for ev in events:
            for dl in [ev.deadline_graphics_initial, ev.deadline_company_profile, ev.deadline_participants, ev.deadline_final_graphics]:
                if dl and dl >= date.today():
                    upcoming.append((dl - date.today()).days)
        days_to_deadline = min(upcoming) if upcoming else 0

    # Graphics status breakdown
    graphics_counts: Dict[str, int] = {}
    for ex in all_ex:
        s = ex.graphics_status
        graphics_counts[s] = graphics_counts.get(s, 0) + 1
    graphics_status = [{"name": k.replace("_", " ").title(), "value": v} for k, v in graphics_counts.items()]

    status_distribution = [
        {"name": "Complete",    "value": completed,   "color": "hsl(154 100% 49%)"},
        {"name": "In Progress", "value": in_progress, "color": "hsl(45 96% 48%)"},
        {"name": "Locked",      "value": locked,      "color": "hsl(0 72% 51%)"},
        {"name": "Pending",     "value": max(total - completed - in_progress - locked, 0), "color": "hsl(213 20% 78%)"},
    ]

    return {
        "total_exhibitors": total,
        "completion_rate": completion_rate,
        "in_progress": in_progress,
        "days_to_deadline": days_to_deadline,
        "status_distribution": status_distribution,
        "graphics_status": graphics_status,
    }


# ── FAQ ───────────────────────────────────────────────────────────────────────

@router.post("/faq", dependencies=[Depends(require_admin)])
def upsert_faq(body: FaqUpsert, db: Session = Depends(get_db)) -> Dict[str, int]:
    item = FaqItem(event_id=body.event_id, sort_order=body.sort_order, question=body.question, answer=body.answer)
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
