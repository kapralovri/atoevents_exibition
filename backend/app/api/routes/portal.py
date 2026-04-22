import asyncio
import tempfile
from datetime import datetime, timezone
from typing import Annotated, Any, Optional, List, Dict

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user, get_db
from app.config import settings
from app.models.change_request import ChangeRequest
from app.models.equipment import EquipmentLineItem, EquipmentOrder
from app.models.event import Event, EventDocument
from app.models.exhibitor import Exhibitor
from app.models.faq import FaqItem
from app.models.graphic import GraphicUpload
from app.models.participant import Participant
from app.models.company import CompanyProfile
from app.models.user import User, UserRole
from app.schemas.portal import (
    ChangeRequestBody,
    CompanyProfileUpdate,
    CompleteUploadBody,
    EquipmentOrderCreate,
    GdprConsentRequest,
    GraphicApproveBody,
    ManualAckRequest,
    MultipartCompleteBody,
    MultipartInitBody,
    ParticipantCreate,
    PresignUploadBody,
)
from app.services import storage
from app.services.audit_service import log_event
from app.services.deadlines import refresh_exhibitor_locks
from app.services.email_service import notify_admin_equipment, notify_admin_new_upload, send_email
from app.services.graphics_validation import (
    ALLOWED_EXTENSIONS,
    build_preview_jpeg_from_path,
    validate_graphic_from_path,
)
from app.services.stand_matrix import slots_for_exhibitor, slot_dict_for_api, get_overlay_zones

router = APIRouter(prefix="/portal", tags=["portal"])


def _get_exhibitor(db: Session, exhibitor_id: int, user: User) -> Exhibitor:
    ex = db.query(Exhibitor).filter(Exhibitor.id == exhibitor_id).first()
    if not ex:
        raise HTTPException(404, "Exhibitor not found")
    if user.role != UserRole.ADMIN.value and ex.user_id != user.id:
        raise HTTPException(403, "Forbidden")
    return ex


def _event(db: Session, event_id: int) -> Event:
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    return ev


def _resolve_backdrop_key(ev: Event, ex: "Exhibitor") -> "str | None":
    """Return the S3 key for this exhibitor's backdrop.
    Prefers inventory_id-based key; falls back to stand_package for legacy exhibitors.
    """
    keys: dict = ev.backdrop_s3_keys or {}
    if not keys:
        return None
    # Preferred: inventory-item-keyed backdrop
    if ex.stand_inventory_id and ex.stand_inventory_id in keys:
        return keys[ex.stand_inventory_id]
    # Legacy fallback: package-keyed backdrop
    if ex.stand_package in keys:
        return keys[ex.stand_package]
    # Last resort: any available backdrop
    return next(iter(keys.values()), None)


@router.get("/me")
def me(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)) -> Dict[str, Any]:
    if user.role == UserRole.ADMIN.value:
        return {"role": "admin", "email": user.email}
    rows = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).all()
    return {
        "role": "exhibitor",
        "email": user.email,
        "exhibitors": [{"id": e.id, "event_id": e.event_id, "company_name": e.company_name} for e in rows],
    }


@router.get("/me/exhibitor")
def me_exhibitor(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Convenience endpoint: returns the current user's first exhibitor record + event context."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found for this user")
    ev = _event(db, ex.event_id)
    refresh_exhibitor_locks(ex, ev)
    db.commit()
    db.refresh(ex)
    return {
        "id": ex.id,
        "company_name": ex.company_name,
        "event_id": ex.event_id,
        "event_name": ev.name,
        "stand_package": ex.stand_package,
        "stand_configuration": ex.stand_configuration,
        "area_m2": ex.area_m2,
        "booth_type": ex.stand_package,
        "booth_size": ex.area_m2,
        "graphics_status": ex.graphics_status,
        "description_status": ex.company_status,
        "participants_status": ex.participants_status,
        "overall_status": "complete" if (
            ex.fully_locked or (
                (ex.graphics_status or "").upper() in ("APPROVED", "VALID") and
                (ex.company_status or "").upper() in ("APPROVED", "SUBMITTED") and
                (ex.participants_status or "").upper() in ("APPROVED", "SUBMITTED")
            )
        ) else (
            "in_progress" if any([
                ex.graphics_status not in ("NOT_STARTED", "NOT_UPLOADED", None),
                ex.company_status not in ("NOT_STARTED", None),
                ex.participants_status not in ("NOT_STARTED", "NOT_SUBMITTED", None),
            ]) else "not_started"
        ),
        "deadline_graphics": str(ev.deadline_graphics_initial) if ev.deadline_graphics_initial else None,
        "deadline_company_profile": str(ev.deadline_company_profile) if ev.deadline_company_profile else None,
        "deadline_participants": str(ev.deadline_participants) if ev.deadline_participants else None,
        "deadline_final_graphics": str(ev.deadline_final_graphics) if ev.deadline_final_graphics else None,
        "needs_manual_modal": ex.manual_acknowledged_at is None,
        "gdpr_ok": ex.gdpr_consent_at is not None,
        "locks": {
            "graphics": ex.section_graphics_locked,
            "company": ex.section_company_locked,
            "participants": ex.section_participants_locked,
        },
        # Description page reads these directly from /me/exhibitor
        "description": (lambda cp: cp.description if cp else "")(
            db.query(CompanyProfile).filter(CompanyProfile.exhibitor_id == ex.id).first()
        ),
        # Participants page reads participants list directly from /me/exhibitor
        "participants": [
            {
                "id": str(p.id),
                "full_name": f"{p.first_name} {p.last_name}".strip(),
                "first_name": p.first_name,
                "last_name": p.last_name,
                "email": p.email,
                "job_title": p.job_title,
                "phone": p.phone or "",
            }
            for p in db.query(Participant).filter(Participant.exhibitor_id == ex.id).all()
        ],
    }


def _graphic_status(raw: Optional[str]) -> str:
    """Normalize DB/validation status to lowercase frontend tokens."""
    if not raw:
        return "not_uploaded"
    mapping = {
        "PENDING": "not_uploaded",
        "NOT_UPLOADED": "not_uploaded",
        "UPLOADED": "under_review",
        "UNDER_REVIEW": "under_review",
        "VALID": "approved",
        "APPROVED": "approved",
        "INVALID": "revision",
        "REVISION_NEEDED": "revision",
        "NEEDS_REVISION": "revision",
    }
    return mapping.get(raw.upper(), raw.lower())


@router.get("/me/exhibitor/graphics")
def me_exhibitor_graphics(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Convenience endpoint: returns graphic slots for the current user's exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found for this user")
    slots = slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2)
    uploads = {
        u.slot_key: u
        for u in db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == ex.id).all()
    }
    result = []
    for slot in slots:
        upload = uploads.get(slot.key)
        result.append({
            "id": slot.key,
            "name": slot.key,
            "label": slot.label,
            "required": slot.required,
            "status": _graphic_status(upload.validation_status if upload else None),
            "file_name": upload.original_filename if upload else None,
            "file_size": upload.size_bytes if upload else None,
            "uploaded_at": upload.created_at.isoformat() if upload else None,
            "version_number": None,
            "admin_comment": ex.graphics_admin_comment if upload else None,
            "preview_url": storage.presign_get(upload.preview_s3_key) if (upload and upload.preview_s3_key) else None,
        })
    return result


class _MeCompanyUpdate(BaseModel):
    company_description: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    logo_s3_key: Optional[str] = None


class _MeParticipantsBulk(BaseModel):
    participants: List[Dict[str, Any]]


@router.patch("/me/exhibitor/company")
def me_patch_company(
    body: _MeCompanyUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Convenience: update company profile for current user's exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    if ex.section_company_locked or ex.company_status == "APPROVED":
        raise HTTPException(403, "Locked")
    cp = db.query(CompanyProfile).filter(CompanyProfile.exhibitor_id == ex.id).first()
    if not cp:
        cp = CompanyProfile(exhibitor_id=ex.id, company_name=ex.company_name, website="", description="")
        db.add(cp)
    if body.company_name is not None:
        cp.company_name = body.company_name
    if body.website is not None:
        cp.website = body.website
    if body.company_description is not None:
        cp.description = body.company_description
    if body.logo_s3_key is not None:
        cp.logo_s3_key = body.logo_s3_key
    ex.company_status = "DRAFT"
    db.commit()
    return {"status": "ok"}


@router.post("/me/exhibitor/description/submit")
def me_submit_description(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Convenience: submit company description for review."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    if ex.section_company_locked:
        raise HTTPException(403, "Locked")
    ex.company_status = "UNDER_REVIEW"
    db.commit()
    return {"status": "ok"}


@router.put("/me/exhibitor/participants")
def me_put_participants(
    body: _MeParticipantsBulk,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Convenience: bulk-replace participants list for current user's exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    if ex.section_participants_locked:
        raise HTTPException(403, "Locked")
    # Delete existing and replace
    db.query(Participant).filter(Participant.exhibitor_id == ex.id).delete()
    quota = max(1, int(ex.area_m2 // 9))
    complimentary_count = 0
    for p_data in body.participants:
        badge = "COMPLIMENTARY" if complimentary_count < quota else "ADDITIONAL"
        if badge == "COMPLIMENTARY":
            complimentary_count += 1
        # Support both {full_name, ...} and {first_name, last_name, ...} shapes
        full_name = p_data.get("full_name", "")
        first_name = p_data.get("first_name") or (full_name.split(" ")[0] if full_name else "")
        last_name = p_data.get("last_name") or (" ".join(full_name.split(" ")[1:]) if " " in full_name else "")
        p = Participant(
            exhibitor_id=ex.id,
            first_name=first_name,
            last_name=last_name,
            job_title=p_data.get("job_title", ""),
            email=p_data.get("email", ""),
            phone=p_data.get("phone", ""),
            badge_type=badge,
        )
        db.add(p)
    ex.participants_status = "UNDER_REVIEW"
    db.commit()
    return {"status": "ok"}


@router.post("/me/exhibitor/logo/presign")
def me_logo_presign(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Return a presigned PUT URL for uploading a company logo image."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    if ex.section_company_locked or ex.company_status == "APPROVED":
        raise HTTPException(403, "Company section locked")
    s3_key = f"logos/{ex.id}/logo.png"
    result = storage.presign_put(s3_key, content_type="image/png")
    return {"upload_url": result["url"], "s3_key": s3_key}


_ALLOWED_GRAPHICS_MIME = {
    "image/tiff", "image/x-tiff",
    "image/png",
    "image/jpeg",
    "application/pdf",
    "application/octet-stream",  # browsers sometimes report this for TIFF
}


class _GraphicsPresignBody(BaseModel):
    content_type: str = "image/tiff"

    @classmethod
    def _normalize(cls, v: str) -> str:
        return (v or "").strip().lower() or "application/octet-stream"


def _graphics_upload_allowed(ex: "Exhibitor") -> None:
    """Raise 403 if the exhibitor is not allowed to upload graphics right now."""
    if ex.section_graphics_locked:
        raise HTTPException(403, "Graphics section locked")
    if ex.graphics_status == "APPROVED":
        raise HTTPException(403, "Graphics have been approved — uploads locked")


@router.post("/me/exhibitor/graphics/{slot_key}/presign")
def me_graphics_presign(
    slot_key: str,
    body: _GraphicsPresignBody,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Convenience: presign graphic upload for current user's exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    _graphics_upload_allowed(ex)
    ct = _GraphicsPresignBody._normalize(body.content_type)
    if ct not in _ALLOWED_GRAPHICS_MIME:
        raise HTTPException(400, f"Unsupported content type: {ct}")
    # Use a unique key per upload; extension depends on content type
    _ext_map = {"image/jpeg": ".jpg", "application/pdf": ".pdf"}
    _ext_suffix = _ext_map.get(ct, ".tif")
    s3_key = f"graphics/{ex.id}/{slot_key}/{slot_key}{_ext_suffix}"
    result = storage.presign_put(s3_key, content_type=ct)
    return {"upload_url": result["url"], "s3_key": s3_key, "content_type": ct}


@router.post("/me/exhibitor/graphics/{slot_key}/finalize")
def me_graphics_finalize(
    slot_key: str,
    body: Dict[str, Any],
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Convenience: finalize graphic upload for current user's exhibitor."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    _graphics_upload_allowed(ex)
    s3_key = body.get("s3_key", "")
    original_filename = body.get("original_filename", "file.tif")
    return _finalize_graphic_upload(db, ex, slot_key, s3_key, original_filename, user, request, background_tasks)


@router.post("/exhibitors/{exhibitor_id}/manual")
def manual_ack(
    exhibitor_id: int,
    body: ManualAckRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if body.acknowledged:
        ex.manual_acknowledged_at = datetime.now(timezone.utc)
        ex.manual_defer_until_next_login = False
        log_event(
            db,
            user_id=user.id,
            event_type="manual_ack",
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            payload={"exhibitor_id": exhibitor_id},
        )
    else:
        ex.manual_defer_until_next_login = True
        log_event(
            db,
            user_id=user.id,
            event_type="manual_defer",
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            payload={"exhibitor_id": exhibitor_id},
        )
    db.commit()
    return {"status": "ok"}


@router.post("/exhibitors/{exhibitor_id}/gdpr")
def gdpr_consent(
    exhibitor_id: int,
    body: GdprConsentRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if body.consent:
        ex.gdpr_consent_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok"}


@router.get("/exhibitors/{exhibitor_id}/summary")
def exhibitor_summary(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    ev = _event(db, ex.event_id)
    refresh_exhibitor_locks(ex, ev)
    db.commit()
    db.refresh(ex)
    needs_manual_modal = ex.manual_acknowledged_at is None
    return {
        "company_name": ex.company_name,
        "event_id": ex.event_id,
        "needs_manual_modal": needs_manual_modal,
        "graphics_status": ex.graphics_status,
        "company_status": ex.company_status,
        "participants_status": ex.participants_status,
        "locks": {
            "graphics": ex.section_graphics_locked,
            "company": ex.section_company_locked,
            "participants": ex.section_participants_locked,
        },
        "gdpr_ok": ex.gdpr_consent_at is not None,
    }


@router.get("/exhibitors/{exhibitor_id}/graphics/slots")
def graphics_slots(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    slots = slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2)
    uploads = {u.slot_key: u for u in db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all()}
    return {
        "slots": [slot_dict_for_api(s) for s in slots],
        "uploads": {
            k: {
                "validation_status": v.validation_status,
                "preview_url": storage.presign_get(v.preview_s3_key) if v.preview_s3_key else None,
            }
            for k, v in uploads.items()
        },
        "graphics_status": ex.graphics_status,
        "locked": ex.section_graphics_locked,
        "admin_comment": ex.graphics_admin_comment,
    }


@router.post("/uploads/presign")
def presign_upload(
    body: PresignUploadBody,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, body.exhibitor_id, user)
    if ex.section_graphics_locked:
        raise HTTPException(403, "Graphics section locked")
    if body.file_size > settings.max_upload_bytes:
        raise HTTPException(400, "File too large")
    keys_allowed = {s.key for s in slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2)}
    if body.slot_key not in keys_allowed:
        raise HTTPException(400, "Invalid slot")
    prefix = f"events/{ex.event_id}/exhibitors/{ex.id}/graphics"
    key = storage.new_upload_key(prefix, body.filename)
    p = storage.presign_put(key, body.content_type)
    return {"upload_url": p["url"], "s3_key": key}


@router.post("/uploads/multipart/init")
def multipart_init(
    body: MultipartInitBody,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, body.exhibitor_id, user)
    if ex.section_graphics_locked:
        raise HTTPException(403, "Graphics section locked")
    keys_allowed = {s.key for s in slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2)}
    if body.slot_key not in keys_allowed:
        raise HTTPException(400, "Invalid slot")
    prefix = f"events/{ex.event_id}/exhibitors/{ex.id}/graphics"
    key = storage.new_upload_key(prefix, body.filename)
    uid = storage.presign_multipart_create(key, body.content_type)
    return {"s3_key": key, "upload_id": uid}


@router.get("/uploads/multipart/part-url")
def multipart_part_url(
    s3_key: str,
    upload_id: str,
    part_number: int,
    user: Annotated[User, Depends(get_current_user)],
) -> Dict[str, str]:
    url = storage.presign_multipart_part(s3_key, upload_id, part_number)
    return {"upload_url": url}


def _finalize_graphic_upload(
    db: Session,
    ex: Exhibitor,
    slot_key: str,
    s3_key: str,
    original_filename: str,
    user: User,
    request: Optional[Request],
    background_tasks: Optional[BackgroundTasks],
) -> Dict[str, Any]:
    try:
        size_bytes = int(storage.head_object(s3_key)["ContentLength"])
    except Exception:  # noqa: BLE001
        size_bytes = 0
    slot = next(
        (s for s in slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2) if s.key == slot_key),
        None,
    )
    if not slot:
        storage.delete_object(s3_key)
        raise HTTPException(400, "Invalid slot")

    # Determine file extension for temp file (preserve for validators)
    import os as _os
    src_ext = _os.path.splitext(original_filename)[1].lower() or ".tif"
    if src_ext not in ALLOWED_EXTENSIONS:
        src_ext = ".tif"
    if src_ext == ".pdf":
        mime_type = "application/pdf"
    elif src_ext in (".jpg", ".jpeg"):
        mime_type = "image/jpeg"
    else:
        mime_type = "image/tiff"

    with tempfile.NamedTemporaryFile(suffix=src_ext, delete=True) as tmp:
        storage.download_to_path(s3_key, tmp.name)
        ok, msg, meta = validate_graphic_from_path(tmp.name, slot)
        if not ok:
            storage.delete_object(s3_key)
            raise HTTPException(400, msg)

        preview_bytes = build_preview_jpeg_from_path(tmp.name)
        preview_key = storage.new_upload_key(
            f"events/{ex.event_id}/exhibitors/{ex.id}/previews", f"{slot_key}.jpg"
        )
        storage.upload_bytes(preview_key, preview_bytes, "image/jpeg")

    existing = (
        db.query(GraphicUpload)
        .filter(GraphicUpload.exhibitor_id == ex.id, GraphicUpload.slot_key == slot_key)
        .first()
    )
    if existing:
        if existing.s3_key:
            storage.delete_object(existing.s3_key)
        if existing.preview_s3_key:
            storage.delete_object(existing.preview_s3_key)
        db.delete(existing)
        db.flush()

    gu = GraphicUpload(
        exhibitor_id=ex.id,
        slot_key=slot_key,
        slot_label=slot.label,
        original_filename=original_filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        s3_key=s3_key,
        preview_s3_key=preview_key,
        width_px=meta.get("width_px"),
        height_px=meta.get("height_px"),
        dpi_x=meta.get("dpi_x"),
        dpi_y=meta.get("dpi_y"),
        validation_status="VALID",
        validation_message=msg if msg else None,
    )
    db.add(gu)
    ex.graphics_status = "UNDER_REVIEW"
    db.commit()
    db.refresh(gu)

    log_event(
        db,
        user_id=user.id,
        event_type="graphic_upload_complete",
        ip=get_client_ip(request) if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
        payload={"exhibitor_id": ex.id, "slot_key": slot_key},
    )

    if background_tasks and settings.admin_notify_email:
        ev = _event(db, ex.event_id)

        def _notify() -> None:
            sub, text = notify_admin_new_upload(ex.company_name, ev.name)
            asyncio.run(send_email(settings.admin_notify_email, sub, text))

        background_tasks.add_task(_notify)

    return {"graphic_upload_id": gu.id, "validation_status": "VALID"}


@router.post("/uploads/complete")
def complete_upload(
    body: CompleteUploadBody,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, body.exhibitor_id, user)
    if ex.section_graphics_locked:
        raise HTTPException(403, "Graphics section locked")
    return _finalize_graphic_upload(
        db, ex, body.slot_key, body.s3_key, body.original_filename, user, request, background_tasks
    )


@router.post("/uploads/multipart/complete")
def multipart_complete(
    body: MultipartCompleteBody,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, body.exhibitor_id, user)
    if ex.section_graphics_locked:
        raise HTTPException(403, "Graphics section locked")
    try:
        storage.complete_multipart_upload(body.s3_key, body.upload_id, body.parts)
    except Exception as e:  # noqa: BLE001
        storage.abort_multipart_upload(body.s3_key, body.upload_id)
        raise HTTPException(400, f"Multipart complete failed: {e}") from e
    return _finalize_graphic_upload(
        db, ex, body.slot_key, body.s3_key, body.original_filename, user, request, background_tasks
    )


@router.get("/me/exhibitor/final-pdf")
def me_final_pdf(user: Annotated[User, Depends(get_current_user)], db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return a presigned GET URL for the final stand visualization PDF,
    attached by the admin after graphics review."""
    ex = db.query(Exhibitor).filter(Exhibitor.user_id == user.id).first()
    if not ex:
        raise HTTPException(404, "No exhibitor profile found")
    if not ex.final_stand_pdf_s3_key:
        return {"url": None, "filename": None, "uploaded_at": None}
    return {
        "url": storage.presign_get(ex.final_stand_pdf_s3_key),
        "filename": ex.final_stand_pdf_filename,
        "uploaded_at": ex.final_stand_pdf_uploaded_at.isoformat() if ex.final_stand_pdf_uploaded_at else None,
    }


@router.get("/exhibitors/{exhibitor_id}/preview")
def preview_assets(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    ev = _event(db, ex.event_id)
    _bk = _resolve_backdrop_key(ev, ex)
    backdrop = storage.presign_get(_bk) if _bk else None
    zones = get_overlay_zones(ex.stand_package, ex.stand_configuration)
    layers = []
    for u in db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all():
        if u.preview_s3_key:
            layer: dict[str, Any] = {"slot_key": u.slot_key, "url": storage.presign_get(u.preview_s3_key)}
            zone = zones.get(u.slot_key)
            if zone:
                layer["zone"] = {"x": zone[0], "y": zone[1], "w": zone[2], "h": zone[3]}
            layers.append(layer)
    return {"backdrop_url": backdrop, "layers": layers}


@router.get("/exhibitors/{exhibitor_id}/preview/render")
def render_preview(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    """Generate and return a server-composited stand preview JPEG."""
    from fastapi.responses import Response as FastAPIResponse
    from app.services.stand_composer import build_stand_composite

    ex = _get_exhibitor(db, exhibitor_id, user)
    ev = _event(db, ex.event_id)

    # Find backdrop S3 key — prefers inventory_id key, falls back to stand_package
    backdrop_key: str | None = _resolve_backdrop_key(ev, ex)

    if not backdrop_key:
        raise HTTPException(404, "No backdrop image configured for this stand type. Ask the organiser to upload one.")

    # Collect uploaded graphic previews with zone coordinates
    zones = get_overlay_zones(ex.stand_package, ex.stand_configuration)
    uploads = db.query(GraphicUpload).filter(GraphicUpload.exhibitor_id == exhibitor_id).all()
    layers = []
    for u in uploads:
        if not u.preview_s3_key:
            continue
        zone = zones.get(u.slot_key)
        if zone:
            layers.append({
                "preview_s3_key": u.preview_s3_key,
                "zone": {"x": zone[0], "y": zone[1], "w": zone[2], "h": zone[3]},
            })

    # If no uploaded layers, just return the backdrop itself
    if not layers:
        raw = storage.download_bytes(backdrop_key)
        return FastAPIResponse(content=raw, media_type="image/jpeg")

    jpeg_bytes = build_stand_composite(backdrop_key, layers)
    return FastAPIResponse(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache", "Content-Disposition": "inline; filename=preview.jpg"},
    )


@router.post("/exhibitors/{exhibitor_id}/graphics/approve")
def approve_graphics(
    exhibitor_id: int,
    body: GraphicApproveBody,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    if not body.signature_accepted:
        raise HTTPException(400, "Signature required")
    ex = _get_exhibitor(db, exhibitor_id, user)
    if ex.graphics_status != "UNDER_REVIEW" and ex.graphics_status != "APPROVED":
        pass
    ex.graphics_status = "APPROVED"
    ex.section_graphics_locked = True
    db.commit()
    log_event(
        db,
        user_id=user.id,
        event_type="graphic_signature_confirm",
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        payload={"exhibitor_id": exhibitor_id},
    )
    return {"status": "ok"}


@router.get("/exhibitors/{exhibitor_id}/company")
def get_company(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    cp = db.query(CompanyProfile).filter(CompanyProfile.exhibitor_id == exhibitor_id).first()
    if not cp:
        raise HTTPException(404, "Profile not found")
    return {
        "company_name": cp.company_name,
        "website": cp.website,
        "description": cp.description,
        "logo_s3_key": cp.logo_s3_key,
        "status": ex.company_status,
        "locked": ex.section_company_locked,
        "admin_comment": ex.company_admin_comment,
    }


@router.patch("/exhibitors/{exhibitor_id}/company")
def patch_company(
    exhibitor_id: int,
    body: CompanyProfileUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if ex.section_company_locked or ex.company_status == "APPROVED":
        raise HTTPException(403, "Locked")
    cp = db.query(CompanyProfile).filter(CompanyProfile.exhibitor_id == exhibitor_id).first()
    if not cp:
        raise HTTPException(404)
    cp.company_name = body.company_name
    cp.website = body.website
    cp.description = body.description
    cp.logo_s3_key = body.logo_s3_key
    ex.company_status = "DRAFT"
    db.commit()
    return {"status": "ok"}


@router.post("/exhibitors/{exhibitor_id}/company/submit")
def submit_company(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if ex.section_company_locked:
        raise HTTPException(403, "Locked")
    ex.company_status = "UNDER_REVIEW"
    db.commit()
    return {"status": "ok"}


@router.get("/exhibitors/{exhibitor_id}/participants")
def list_participants(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    quota = max(1, int(ex.area_m2 // 9))
    rows = db.query(Participant).filter(Participant.exhibitor_id == exhibitor_id).all()
    complimentary = sum(1 for r in rows if r.badge_type == "COMPLIMENTARY")
    additional = sum(1 for r in rows if r.badge_type == "ADDITIONAL")
    return {
        "quota_complimentary": quota,
        "participants": [
            {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "job_title": p.job_title,
                "email": p.email,
                "phone": p.phone,
                "badge_type": p.badge_type,
            }
            for p in rows
        ],
        "status": ex.participants_status,
        "locked": ex.section_participants_locked,
    }


@router.post("/exhibitors/{exhibitor_id}/participants")
def add_participant(
    exhibitor_id: int,
    body: ParticipantCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if ex.section_participants_locked:
        raise HTTPException(403, "Locked")
    quota = max(1, int(ex.area_m2 // 9))
    current = db.query(Participant).filter(Participant.exhibitor_id == exhibitor_id).all()
    complimentary_count = sum(1 for r in current if r.badge_type == "COMPLIMENTARY")
    badge = "COMPLIMENTARY" if complimentary_count < quota else "ADDITIONAL"
    p = Participant(
        exhibitor_id=exhibitor_id,
        first_name=body.first_name,
        last_name=body.last_name,
        job_title=body.job_title,
        email=str(body.email),
        phone=body.phone,
        badge_type=badge,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id}


@router.delete("/participants/{participant_id}")
def delete_participant(
    participant_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    p = db.query(Participant).filter(Participant.id == participant_id).first()
    if not p:
        raise HTTPException(404)
    ex = _get_exhibitor(db, p.exhibitor_id, user)
    if ex.section_participants_locked:
        raise HTTPException(403, "Locked")
    db.delete(p)
    db.commit()
    return {"status": "ok"}


@router.post("/exhibitors/{exhibitor_id}/participants/submit")
def submit_participants(
    exhibitor_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    if ex.section_participants_locked:
        raise HTTPException(403, "Locked")
    ex.participants_status = "SUBMITTED"
    db.commit()
    return {"status": "ok"}


@router.post("/exhibitors/{exhibitor_id}/equipment")
def submit_equipment(
    exhibitor_id: int,
    body: EquipmentOrderCreate,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    ev = _event(db, ex.event_id)
    order = EquipmentOrder(exhibitor_id=exhibitor_id, notes=body.notes)
    db.add(order)
    db.flush()
    for it in body.items:
        db.add(
            EquipmentLineItem(
                order_id=order.id,
                sku=it.sku,
                name=it.name,
                quantity=it.quantity,
                unit_price=it.unit_price,
            )
        )
    db.commit()
    db.refresh(order)

    lines = [{"name": it.name, "quantity": it.quantity} for it in body.items]

    def _notify() -> None:
        sub, text = notify_admin_equipment(ex.company_name, ev.name, lines)
        asyncio.run(send_email(settings.admin_notify_email, sub, text))

    if background_tasks and settings.admin_notify_email:
        background_tasks.add_task(_notify)
    return {"order_id": order.id}


@router.post("/exhibitors/{exhibitor_id}/change-request")
def change_request(
    exhibitor_id: int,
    body: ChangeRequestBody,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ex = _get_exhibitor(db, exhibitor_id, user)
    cr = ChangeRequest(exhibitor_id=exhibitor_id, section=body.section, message=body.message)
    db.add(cr)
    db.commit()
    db.refresh(cr)

    def _notify() -> None:
        asyncio.run(
            send_email(
                settings.admin_notify_email,
                "Exhibitor revision request",
                f"{ex.company_name} requested unlock for {body.section}. {body.message or ''}",
            )
        )

    if background_tasks and settings.admin_notify_email:
        background_tasks.add_task(_notify)
    return {"id": cr.id}


@router.get("/events/{event_id}/documents")
def list_documents(
    event_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    ex_rows = db.query(Exhibitor).filter(Exhibitor.user_id == user.id, Exhibitor.event_id == event_id).all()
    if user.role != UserRole.ADMIN.value and not ex_rows:
        raise HTTPException(403, "Forbidden")
    docs = db.query(EventDocument).filter(EventDocument.event_id == event_id).all()
    return [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "title": d.title,
            "version_label": d.version_label,
            "download_url": storage.presign_get(d.s3_key),
        }
        for d in docs
    ]


@router.get("/faq")
def list_faq(event_id: Optional[int] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    q = db.query(FaqItem)
    if event_id is not None:
        q = q.filter(or_(FaqItem.event_id == event_id, FaqItem.event_id.is_(None)))
    return [
        {"id": f.id, "question": f.question, "answer": f.answer}
        for f in q.order_by(FaqItem.sort_order).all()
    ]
