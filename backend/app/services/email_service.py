from email.message import EmailMessage
from typing import Any, Optional, List, Dict, Tuple

import aiosmtplib

from app.config import settings


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
    text = f"Welcome to ATO COMM Exhibitor Portal.\n\nLogin: {email_addr}\nTemporary password: {password}\n\n{login_url}"
    html = f"<p>Welcome to ATO COMM Exhibitor Portal.</p><p>Login: {email_addr}</p><p>Temporary password: {password}</p><p><a href='{login_url}'>Open portal</a></p>"
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
