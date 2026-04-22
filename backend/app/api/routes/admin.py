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


class StandInventoryItem(BaseModel):
    id: str
    package: str = Field(..., pattern="^(SHELL_ONLY|SYSTEM|BESPOKE)$")
    area_m2: float = Field(..., gt=0)
    configuration: str = Field(..., pattern="^(LINEAR|ANGULAR|PENINSULA|ISLAND)$")
    total: int = Field(..., ge=1)


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
    stand_inventory: Optional[List[StandInventoryItem]] = None
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
    stand_inventory: Optional[List[StandInventoryItem]] = None
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
    # Primary: select an inventory item — stand fields derived automatically
    stand_inventory_id: Optional[str] = None
    # Flat fields — required when stand_inventory_id is None (e.g. BESPOKE custom)
    stand_package: Optional[str] = Field(None, pattern="^(SHELL_ONLY|SYSTEM|BESPOKE)$")
    stand_configuration: Optional[str] = Field(None, pattern="^(LINEAR|ANGULAR|PENINSULA|ISLAND)$")
    area_m2: Optional[float] = Field(None, gt=0)


class ExhibitorUpdate(BaseModel):
    company_name: Optional[str] = None
    stand_inventory_id: Optional[str] = None
    stand_package: Optional[str] = Field(None, pattern="^(SHELL_ONLY|SYSTEM|BESPOKE)$")
    stand_configuration: Optional[str] = Field(None, pattern="^(LINEAR|ANGULAR|PENINSULA|ISLAND)$")
    area_m2: Optional[float] = Field(None, gt=0)


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


def _inventory_slug(package: str, area_m2: float, configuration: str) -> str:
    """Generate deterministic id slug: so_9_lin, sys_18_ang, besp_12_pen"""
    pkg = {"SHELL_ONLY": "so", "SYSTEM": "sys", "BESPOKE": "besp"}.get(package.upper(), package.lower()[:4])
    cfg = {"LINEAR": "lin", "ANGULAR": "ang", "PENINSULA": "pen", "ISLAND": "isl"}.get(
        configuration.upper(), configuration.lower()[:3]
    )
    area = int(area_m2) if area_m2 == int(area_m2) else area_m2
    return f"{pkg}_{area}_{cfg}"


def _random_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _is_exhibitor_complete(ex: Exhibitor) -> bool:
    """True when all three submission sections are in a terminal-success state."""
    gs = (ex.graphics_status or "").upper()
    cs = (ex.company_status or "").upper()
    ps = (ex.participants_status or "").upper()
    graphics_done = gs in ("APPROVED", "VALID")
    company_done = cs in ("APPROVED", "SUBMITTED")
    participants_done = ps in ("SUBMITTED", "APPROVED")
    return graphics_done and company_done and participants_done


# ── Event endpoints ───────────────────────────────────────────────────────────

@router.post("/events", dependencies=[Depends(require_admin)])
def create_event(body: EventCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    auto = _default_deadlines(body.start_date)
    inv_data = (
        [item.model_dump() for item in body.stand_inventory]
        if body.stand_inventory else None
    )
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
        stand_inventory=inv_data,
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
        "stand_inventory": ev.stand_inventory or [],
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
    data = body.model_dump(exclude_unset=True)
    # Serialize StandInventoryItem objects → plain dicts for JSONB storage
    if "stand_inventory" in data and data["stand_inventory"] is not None:
        data["stand_inventory"] = [
            item if isinstance(item, dict) else item
            for item in data["stand_inventory"]
        ]
    for k, v in data.items():
        setattr(ev, k, v)
    db.commit()
    return {"status": "ok"}


@router.delete("/events/{event_id}", dependencies=[Depends(require_admin)])
def delete_event(
    event_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Delete an event and all its exhibitors / documents. Logs to audit trail."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")

    event_name = ev.name
    exhibitor_ids = [ex.id for ex in db.query(Exhibitor).filter(Exhibitor.event_id == event_id).all()]

    # Cascade delete child records
    db.query(GraphicUpload).filter(
        GraphicUpload.exhibitor_id.in_(exhibitor_ids)
    ).delete(synchronize_session=False)
    db.query(Participant).filter(
        Participant.exhibitor_id.in_(exhibitor_ids)
    ).delete(synchronize_session=False)
    db.query(CompanyProfile).filter(
        CompanyProfile.exhibitor_id.in_(exhibitor_ids)
    ).delete(synchronize_session=False)
    db.query(Exhibitor).filter(Exhibitor.event_id == event_id).delete(synchronize_session=False)
    db.query(EventDocument).filter(EventDocument.event_id == event_id).delete(synchronize_session=False)
    db.delete(ev)

    log_event(
        db,
        user_id=admin.id,
        event_type="admin_delete_event",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        payload={
            "event_id": event_id,
            "event_name": event_name,
            "exhibitors_deleted": len(exhibitor_ids),
        },
    )
    db.commit()
    return {"status": "deleted", "event_id": event_id, "event_name": event_name}


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
            "stand_inventory_id": ex.stand_inventory_id,
            "booth_type": ex.stand_package.lower().replace("_", " "),
            "booth_size": ex.area_m2,
        })
    db.commit()
    return result


@router.get("/events/{event_id}/stand-availability", dependencies=[Depends(require_admin)])
def get_stand_availability(event_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Return inventory items with real-time booked/available counts."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    inventory: list = ev.stand_inventory or []
    if not inventory:
        return []
    # Batch count bookings per inventory_id
    counts: Dict[str, int] = dict(
        db.query(Exhibitor.stand_inventory_id, func.count(Exhibitor.id))
        .filter(
            Exhibitor.event_id == event_id,
            Exhibitor.stand_inventory_id.isnot(None),
        )
        .group_by(Exhibitor.stand_inventory_id)
        .all()
    )
    keys: Dict[str, Any] = ev.backdrop_s3_keys or {}
    result = []
    for item in inventory:
        item_id = item["id"]
        total = int(item.get("total", 0))
        booked = counts.get(item_id, 0)
        available = max(total - booked, 0)
        backdrop_key = keys.get(item_id)
        result.append({
            "id": item_id,
            "package": item["package"],
            "area_m2": item["area_m2"],
            "configuration": item["configuration"],
            "total": total,
            "booked": booked,
            "available": available,
            "is_full": total > 0 and booked >= total,
            "backdrop_url": storage.presign_get(backdrop_key) if backdrop_key else None,
        })
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


class BackdropPresignBody(BaseModel):
    event_id: int
    inventory_id: Optional[str] = None   # preferred — inventory item id
    stand_package: Optional[str] = None  # legacy fallback
    filename: str = "backdrop.jpg"
    content_type: str = "image/jpeg"


class BackdropCompleteBody(BaseModel):
    event_id: int
    inventory_id: Optional[str] = None   # preferred
    stand_package: Optional[str] = None  # legacy fallback
    s3_key: str


@router.post("/backdrop/presign", dependencies=[Depends(require_admin)])
def presign_backdrop(body: BackdropPresignBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == body.event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    key_name = body.inventory_id or body.stand_package
    if not key_name:
        raise HTTPException(400, "inventory_id or stand_package required")
    safe_name = body.filename.replace("/", "_")[:200]
    key = storage.new_upload_key(f"events/{body.event_id}/backdrops/{key_name}", safe_name)
    p = storage.presign_put(key, body.content_type)
    return {"upload_url": p["url"], "s3_key": key, "inventory_id": key_name}


@router.post("/backdrop/complete", dependencies=[Depends(require_admin)])
def complete_backdrop(body: BackdropCompleteBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ev = db.query(Event).filter(Event.id == body.event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    key_name = body.inventory_id or body.stand_package
    if not key_name:
        raise HTTPException(400, "inventory_id or stand_package required")
    keys = dict(ev.backdrop_s3_keys or {})
    keys[key_name] = body.s3_key
    ev.backdrop_s3_keys = keys
    db.commit()
    return {"status": "ok"}


# ── Final stand PDF (admin attaches after graphics review) ────────────────────

class FinalPdfPresignBody(BaseModel):
    exhibitor_id: int
    filename: str = "stand.pdf"
    content_type: str = "application/pdf"


class FinalPdfCompleteBody(BaseModel):
    exhibitor_id: int
    s3_key: str
    filename: str


@router.post("/exhibitors/{exhibitor_id}/final-pdf/presign", dependencies=[Depends(require_admin)])
def presign_final_pdf(exhibitor_id: int, body: FinalPdfPresignBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    safe_name = body.filename.replace("/", "_")[:200]
    key = storage.new_upload_key(f"exhibitors/{exhibitor_id}/final_pdf", safe_name)
    p = storage.presign_put(key, body.content_type)
    return {"upload_url": p["url"], "s3_key": key}


@router.post("/exhibitors/{exhibitor_id}/final-pdf/complete", dependencies=[Depends(require_admin)])
def complete_final_pdf(exhibitor_id: int, body: FinalPdfCompleteBody, db: Session = Depends(get_db)) -> Dict[str, str]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    # Drop any previous final PDF from storage
    if ex.final_stand_pdf_s3_key and ex.final_stand_pdf_s3_key != body.s3_key:
        try:
            storage.delete_object(ex.final_stand_pdf_s3_key)
        except Exception:  # noqa: BLE001
            pass
    ex.final_stand_pdf_s3_key = body.s3_key
    ex.final_stand_pdf_filename = body.filename
    ex.final_stand_pdf_uploaded_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}


@router.get("/exhibitors/{exhibitor_id}/final-pdf", dependencies=[Depends(require_admin)])
def get_final_pdf(exhibitor_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    if not ex.final_stand_pdf_s3_key:
        return {"url": None, "filename": None, "uploaded_at": None}
    return {
        "url": storage.presign_get(ex.final_stand_pdf_s3_key),
        "filename": ex.final_stand_pdf_filename,
        "uploaded_at": ex.final_stand_pdf_uploaded_at.isoformat() if ex.final_stand_pdf_uploaded_at else None,
    }


# ── Exhibitor endpoints ───────────────────────────────────────────────────────

@router.post("/exhibitors", dependencies=[Depends(require_admin)])
def create_exhibitor(
    body: ExhibitorCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # ── Lock event row to serialize overbooking checks against concurrent writers ──
    ev = (
        db.query(Event)
        .filter(Event.id == body.event_id)
        .with_for_update()
        .first()
    )
    if not ev:
        raise HTTPException(404, "Event not found")

    # ── Resolve stand fields ──────────────────────────────────────────────────
    inventory: list = ev.stand_inventory or []
    is_overbooked = False

    if body.stand_inventory_id:
        # Primary path: inventory item
        item = next((i for i in inventory if i["id"] == body.stand_inventory_id), None)
        if item is None:
            raise HTTPException(400, f"Stand inventory item '{body.stand_inventory_id}' not found for this event")
        stand_package = item["package"]
        stand_configuration = item["configuration"]
        area_m2 = float(item["area_m2"])
        # Overbooking check — safe under FOR UPDATE on the event row above
        booked_count: int = (
            db.query(func.count(Exhibitor.id))
            .filter(
                Exhibitor.event_id == body.event_id,
                Exhibitor.stand_inventory_id == body.stand_inventory_id,
            )
            .scalar() or 0
        )
        total_slots = int(item.get("total", 0))
        is_overbooked = total_slots > 0 and booked_count >= total_slots
    else:
        # Fallback path: flat fields (e.g. BESPOKE custom size)
        if not (body.stand_package and body.stand_configuration and body.area_m2):
            raise HTTPException(
                400,
                "Provide stand_inventory_id OR (stand_package + stand_configuration + area_m2)"
            )
        stand_package = body.stand_package
        stand_configuration = body.stand_configuration
        area_m2 = float(body.area_m2)

    # ── User resolution ───────────────────────────────────────────────────────
    existing_user = db.query(User).filter(User.email == str(body.email)).first()
    is_new_user = existing_user is None
    if is_new_user:
        pwd = _random_password()
        existing_user = User(email=str(body.email), hashed_password=hash_password(pwd), role=UserRole.EXHIBITOR.value)
        db.add(existing_user)
        db.flush()
    else:
        pwd = None

    # Note: same user can have multiple stands (exhibitor records) for the same event

    ex = Exhibitor(
        event_id=body.event_id,
        user_id=existing_user.id,
        company_name=body.company_name,
        stand_package=stand_package,
        stand_configuration=stand_configuration,
        area_m2=area_m2,
        stand_inventory_id=body.stand_inventory_id,
    )
    db.add(ex)
    db.flush()
    cp = CompanyProfile(exhibitor_id=ex.id, company_name=body.company_name, website="", description="")
    db.add(cp)
    db.commit()
    log_event(
        db,
        user_id=admin.id,
        event_type="admin_create_exhibitor",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        payload={
            "exhibitor_id": ex.id,
            "event_id": body.event_id,
            "stand_inventory_id": body.stand_inventory_id,
            "stand_package": stand_package,
            "area_m2": area_m2,
            "overbooked": is_overbooked,
            "is_new_user": is_new_user,
        },
    )
    if is_new_user and pwd:
        login_url = "http://localhost:3000/login"
        text, html = render_welcome_exhibitor(login_url, str(body.email), pwd)

        def _send_sync() -> None:
            asyncio.run(send_email(str(body.email), "ATO COMM — Exhibitor Portal access", text, html))

        background_tasks.add_task(_send_sync)
    return {
        "exhibitor_id": ex.id,
        "user_id": existing_user.id,
        "temporary_password": pwd,
        "is_new_user": is_new_user,
        "overbooked": is_overbooked,
    }


@router.get("/exhibitors/{exhibitor_id}", dependencies=[Depends(require_admin)])
def get_exhibitor(exhibitor_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    u = db.query(User).filter(User.id == ex.user_id).first()
    graphics = db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all()
    sp = ex.stand_package or ""
    sc = ex.stand_configuration or ""
    return {
        "id": ex.id,
        "company_name": ex.company_name,
        "email": u.email if u else "",
        "booth_type": sp.lower().replace("_", " ") if sp else "",
        "booth_config": sc.lower() if sc else "",
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
        "event_id": ex.event_id,
        "stand_inventory_id": ex.stand_inventory_id,
        "company_description": ex.company_profile.description if ex.company_profile else "",
        "website": ex.company_profile.website if ex.company_profile else "",
        # Short TTL (5 min): admin preview only, discourages link sharing
        "logo_url": storage.presign_get(ex.company_profile.logo_s3_key, expires_in=300)
            if (ex.company_profile and ex.company_profile.logo_s3_key) else None,
        "participants": [
            {
                "id": p.id,
                "full_name": f"{p.first_name} {p.last_name}".strip(),
                "job_title": p.job_title,
                "email": p.email,
                "phone": p.phone or "",
                "badge_type": p.badge_type if hasattr(p, "badge_type") else None,
            }
            for p in db.query(Participant).filter(Participant.exhibitor_id == exhibitor_id).all()
        ],
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


@router.patch("/exhibitors/{exhibitor_id}", dependencies=[Depends(require_admin)])
def update_exhibitor(
    exhibitor_id: int,
    body: ExhibitorUpdate,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Update stand configuration and/or company name for a registered exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")

    changes: Dict[str, Any] = {}

    if body.company_name is not None:
        changes["company_name"] = {"from": ex.company_name, "to": body.company_name}
        ex.company_name = body.company_name
        if ex.company_profile:
            ex.company_profile.company_name = body.company_name

    if body.stand_inventory_id is not None:
        ev = db.query(Event).filter(Event.id == ex.event_id).first()
        item = next((i for i in (ev.stand_inventory or []) if i["id"] == body.stand_inventory_id), None)
        if item is None:
            raise HTTPException(400, f"Stand inventory item '{body.stand_inventory_id}' not found for this event")
        changes["stand"] = {
            "mode": "inventory",
            "inventory_id": body.stand_inventory_id,
            "package": item["package"],
            "configuration": item["configuration"],
            "area_m2": float(item["area_m2"]),
        }
        ex.stand_inventory_id = body.stand_inventory_id
        ex.stand_package = item["package"]
        ex.stand_configuration = item["configuration"]
        ex.area_m2 = float(item["area_m2"])
    else:
        # Flat fields for custom/BESPOKE — must be atomic (all-or-nothing)
        flat_given = [body.stand_package, body.stand_configuration, body.area_m2]
        any_given = any(x is not None for x in flat_given)
        all_given = all(x is not None for x in flat_given)
        if any_given and not all_given:
            raise HTTPException(
                400,
                "Custom stand override requires stand_package + stand_configuration + area_m2 together",
            )
        if all_given:
            changes["stand"] = {
                "mode": "custom",
                "package": body.stand_package,
                "configuration": body.stand_configuration,
                "area_m2": body.area_m2,
            }
            ex.stand_inventory_id = None  # detach from inventory
            ex.stand_package = body.stand_package
            ex.stand_configuration = body.stand_configuration
            ex.area_m2 = body.area_m2

    db.commit()
    log_event(
        db,
        user_id=admin.id,
        event_type="admin_update_exhibitor",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        payload={"exhibitor_id": exhibitor_id, "changes": changes},
    )
    return {"status": "ok"}


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
            "download_url": storage.presign_get(g.s3_key) if g.s3_key else None,
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
