from typing import Optional, List, Dict
from pydantic import BaseModel, EmailStr, Field, HttpUrl


class ManualAckRequest(BaseModel):
    acknowledged: bool = True


class GdprConsentRequest(BaseModel):
    consent: bool = True


class CompanyProfileUpdate(BaseModel):
    company_name: str = Field(..., max_length=512)
    website: str
    description: str = Field(..., max_length=1000)
    logo_s3_key: Optional[str] = None


class ParticipantCreate(BaseModel):
    first_name: str
    last_name: str
    job_title: str
    email: EmailStr
    phone: Optional[str] = None


class EquipmentLineIn(BaseModel):
    sku: str
    name: str
    quantity: int = 1
    unit_price: Optional[float] = None


class EquipmentOrderCreate(BaseModel):
    items: List[EquipmentLineIn]
    notes: Optional[str] = None


class PresignUploadBody(BaseModel):
    exhibitor_id: int
    slot_key: str
    filename: str
    content_type: str = "image/tiff"
    file_size: int


class CompleteUploadBody(BaseModel):
    exhibitor_id: int
    slot_key: str
    s3_key: str
    original_filename: str


class MultipartInitBody(BaseModel):
    exhibitor_id: int
    slot_key: str
    filename: str
    content_type: str = "image/tiff"


class MultipartCompleteBody(BaseModel):
    exhibitor_id: int
    slot_key: str
    s3_key: str
    upload_id: str
    parts: List[Dict]  # {PartNumber, ETag}
    original_filename: str


class GraphicApproveBody(BaseModel):
    signature_accepted: bool = True


class ChangeRequestBody(BaseModel):
    section: str
    message: Optional[str] = None


class AdminStatusBody(BaseModel):
    graphics_status: Optional[str] = None
    company_status: Optional[str] = None
    participants_status: Optional[str] = None
    comment: Optional[str] = None
