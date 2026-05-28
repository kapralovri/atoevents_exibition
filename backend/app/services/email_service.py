from email.message import EmailMessage
from typing import Any, Optional, List, Dict, Tuple

import aiosmtplib

from app.config import settings

_SECTION_NAMES: Dict[str, str] = {
    "graphics": "Stand Graphics",
    "company": "Company Description",
    "participants": "Participants",
}

_STATUS_LABELS: Dict[str, str] = {
    "APPROVED": "Approved ✓",
    "REVISION_NEEDED": "Revision required",
    "SUBMITTED": "Submitted",
    "DRAFT": "Draft",
    "NOT_SUBMITTED": "Not submitted",
    "NOT_UPLOADED": "Not uploaded",
    "VALID": "Approved ✓",
    "INVALID": "Revision required",
}

_BASE_STYLE = """
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 8px;
          padding: 32px; border: 1px solid #e0e0e0; }
  h2 { margin-top: 0; color: #1a1a1a; }
  p { color: #333; line-height: 1.6; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 4px;
           font-size: 13px; font-weight: bold; }
  .approved { background: #d4edda; color: #155724; }
  .revision { background: #fff3cd; color: #856404; }
  .submitted { background: #d1ecf1; color: #0c5460; }
  .unlocked { background: #e2d9f3; color: #4a1d96; }
  .btn { display: inline-block; margin-top: 20px; padding: 12px 24px;
         background: #2563eb; color: #fff; text-decoration: none;
         border-radius: 6px; font-weight: bold; }
  .comment { background: #fff3cd; border-left: 4px solid #ffc107;
             padding: 12px; margin: 16px 0; border-radius: 0 4px 4px 0; }
  .footer { margin-top: 32px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
</style>
"""


async def send_email(to: str, subject: str, body_text: str, body_html: Optional[str] = None) -> None:
    if not settings.smtp_host:
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")
    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=True,
    )


def render_welcome_exhibitor(login_url: str, email_addr: str, password: str) -> Tuple[str, str]:
    text = (
        f"Welcome to ATO COMM Exhibitor Portal.\n\n"
        f"Login: {email_addr}\n"
        f"Temporary password: {password}\n\n"
        f"Please log in and change your password: {login_url}"
    )
    html = f"""{_BASE_STYLE}
<div class="wrap">
  <h2>Welcome to ATO COMM Exhibitor Portal</h2>
  <p>Your account has been created. Please use the credentials below to log in.</p>
  <p><strong>Login:</strong> {email_addr}</p>
  <p><strong>Temporary password:</strong> <code>{password}</code></p>
  <p>After logging in, you can change your password in the portal settings.</p>
  <a href="{login_url}" class="btn">Open Portal</a>
  <div class="footer">ATO COMM · expo.atocomm.eu</div>
</div>"""
    return text, html


def render_task_status_changed(
    company_name: str,
    section: str,
    new_status: str,
    comment: Optional[str],
    portal_url: str,
) -> Tuple[str, str]:
    section_label = _SECTION_NAMES.get(section, section.title())
    status_label = _STATUS_LABELS.get(new_status, new_status)
    badge_class = (
        "approved" if new_status in ("APPROVED", "VALID")
        else "revision" if new_status in ("REVISION_NEEDED", "INVALID")
        else "submitted"
    )
    comment_block_txt = f"\nComment from organizer: {comment}" if comment else ""
    comment_block_html = (
        f'<div class="comment"><strong>Comment from organizer:</strong><br>{comment}</div>'
        if comment else ""
    )
    text = (
        f"Hi {company_name},\n\n"
        f"The status of your section «{section_label}» has been updated.\n"
        f"New status: {status_label}{comment_block_txt}\n\n"
        f"Open the portal to see details: {portal_url}"
    )
    html = f"""{_BASE_STYLE}
<div class="wrap">
  <h2>Task Status Updated</h2>
  <p>Hi <strong>{company_name}</strong>,</p>
  <p>The status of your section <strong>{section_label}</strong> has been updated:</p>
  <p><span class="badge {badge_class}">{status_label}</span></p>
  {comment_block_html}
  <a href="{portal_url}" class="btn">Open Portal</a>
  <div class="footer">ATO COMM · expo.atocomm.eu</div>
</div>"""
    return text, html


def render_section_unlocked(company_name: str, sections: List[str], portal_url: str) -> Tuple[str, str]:
    section_labels = [_SECTION_NAMES.get(s, s.title()) for s in sections]
    sections_str = ", ".join(section_labels)
    text = (
        f"Hi {company_name},\n\n"
        f"The following section(s) have been unlocked for editing: {sections_str}.\n\n"
        f"Please log in and make the requested changes: {portal_url}"
    )
    html = f"""{_BASE_STYLE}
<div class="wrap">
  <h2>Section Unlocked for Editing</h2>
  <p>Hi <strong>{company_name}</strong>,</p>
  <p>The following section(s) have been unlocked by the organizer:</p>
  <p><span class="badge unlocked">{sections_str}</span></p>
  <p>Please log in and make the necessary changes.</p>
  <a href="{portal_url}" class="btn">Open Portal</a>
  <div class="footer">ATO COMM · expo.atocomm.eu</div>
</div>"""
    return text, html


def render_password_changed(portal_url: str) -> Tuple[str, str]:
    text = (
        f"Your ATO COMM Exhibitor Portal password has been changed.\n\n"
        f"If you did not request this change, please contact the organizer immediately.\n\n"
        f"Portal: {portal_url}"
    )
    html = f"""{_BASE_STYLE}
<div class="wrap">
  <h2>Password Changed</h2>
  <p>Your password for the ATO COMM Exhibitor Portal has been successfully changed.</p>
  <p>If you did not make this change, please contact the organizer immediately.</p>
  <a href="{portal_url}" class="btn">Open Portal</a>
  <div class="footer">ATO COMM · expo.atocomm.eu</div>
</div>"""
    return text, html


def render_password_reset(login_url: str, email_addr: str, new_password: str) -> Tuple[str, str]:
    text = (
        f"Your ATO COMM Exhibitor Portal password has been reset by the organizer.\n\n"
        f"Login: {email_addr}\n"
        f"New temporary password: {new_password}\n\n"
        f"Please log in and change your password: {login_url}"
    )
    html = f"""{_BASE_STYLE}
<div class="wrap">
  <h2>Password Reset</h2>
  <p>Your password for the ATO COMM Exhibitor Portal has been reset by the organizer.</p>
  <p><strong>Login:</strong> {email_addr}</p>
  <p><strong>New temporary password:</strong> <code>{new_password}</code></p>
  <p>Please log in and change your password immediately.</p>
  <a href="{login_url}" class="btn">Log In</a>
  <div class="footer">ATO COMM · expo.atocomm.eu</div>
</div>"""
    return text, html


def notify_admin_new_upload(exhibitor_name: str, event_name: str) -> Tuple[str, str]:
    sub = f"New graphic upload: {exhibitor_name}"
    text = f"{exhibitor_name} uploaded files for {event_name}."
    return sub, text


def notify_admin_equipment(exhibitor_name: str, event_name: str, lines: List[Dict[str, Any]]) -> Tuple[str, str]:
    sub = f"Equipment order: {exhibitor_name}"
    body = f"Company {exhibitor_name} — event {event_name}\n\n" + "\n".join(
        f"- {x.get('name')} x{x.get('quantity')}" for x in lines
    )
    return sub, body


def notify_admin_participants_submitted(company_name: str, event_name: str, count: int) -> Tuple[str, str]:
    sub = f"Participants submitted: {company_name}"
    text = f"{company_name} submitted {count} participant(s) for {event_name}."
    return sub, text
