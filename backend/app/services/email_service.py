from email.message import EmailMessage
from typing import Any, Optional, List, Dict, Tuple

import aiosmtplib

from app.config import settings

# ── Brand constants ───────────────────────────────────────────────────────────
_GREEN = "#00FC90"
_BLACK = "#000000"
_WHITE = "#ffffff"
_BG    = "#e9ebee"

_LOGO       = "https://docs.atocomm.eu/comm/logos/ATO_COMM_logo.png"
_LOGO_WHITE = "https://docs.atocomm.eu/comm/logos/ATO_COMM_white3.png"
_ICON_TG    = "https://docs.atocomm.eu/comm/logos/tg.png"
_ICON_LI    = "https://docs.atocomm.eu/comm/logos/in.png"
_ICON_FB    = "https://docs.atocomm.eu/comm/logos/fb.png"

_SECTION_NAMES: Dict[str, str] = {
    "graphics":     "Stand Graphics",
    "company":      "Company Description",
    "participants": "Participants",
}

_STATUS_LABELS: Dict[str, str] = {
    "APPROVED":       "Approved",
    "VALID":          "Approved",
    "REVISION_NEEDED":"Revision Required",
    "INVALID":        "Revision Required",
    "SUBMITTED":      "Submitted",
    "DRAFT":          "Draft",
    "NOT_SUBMITTED":  "Not Submitted",
    "NOT_UPLOADED":   "Not Uploaded",
}


# ── HTML layout builder ───────────────────────────────────────────────────────

def _html_layout(hero_label: str, hero_heading: str, body_rows: str) -> str:
    """Assembles a complete ATO COMM branded HTML email.

    hero_label   — small green caps label above the heading
    hero_heading — large white heading; may contain inline HTML
    body_rows    — <tr>…</tr> blocks for the white body section
    """
    return (
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"'
        ' "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" lang="en">\n'
        "<head>\n"
        '  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '  <meta name="x-apple-disable-message-reformatting">\n'
        "  <title>ATO COMM</title>\n"
        "</head>\n"
        f'<body style="margin:0;padding:0;background-color:{_BG};-webkit-text-size-adjust:100%;">\n'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_BG};">\n'
        '<tr><td align="center" style="padding:24px 12px;">\n\n'

        # ── Container ────────────────────────────────────────────────────────
        f'<table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center"\n'
        f'       style="width:600px;max-width:600px;background-color:{_WHITE};border-radius:14px;overflow:hidden;">\n\n'

        # ── Header ───────────────────────────────────────────────────────────
        f'  <tr><td style="padding:22px 40px 18px 40px;background-color:{_WHITE};">\n'
        f'    <a href="https://www.atocomm.eu" target="_blank">\n'
        f'      <img src="{_LOGO}" alt="ato comm" height="26"\n'
        f'           style="height:26px;display:block;border:0;outline:none;">\n'
        f'    </a>\n'
        f'  </td></tr>\n\n'

        # ── Hero ─────────────────────────────────────────────────────────────
        f'  <tr><td style="background-color:{_BLACK};padding:0;">\n'
        f'    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">\n'
        f'      <tr><td style="height:4px;background-color:{_GREEN};line-height:4px;font-size:0;">&nbsp;</td></tr>\n'
        f'      <tr><td style="padding:54px 40px 50px 40px;">\n'
        f'        <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;\n'
        f'                  letter-spacing:3px;color:{_GREEN};text-transform:uppercase;font-weight:bold;">\n'
        f'          {hero_label}\n'
        f'        </p>\n'
        f'        <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:40px;\n'
        f'                   line-height:1.1;font-weight:bold;color:{_WHITE};">\n'
        f'          {hero_heading}\n'
        f'        </h1>\n'
        f'      </td></tr>\n'
        f'    </table>\n'
        f'  </td></tr>\n\n'

        # ── Body rows (injected) ──────────────────────────────────────────────
        + body_rows + "\n\n"

        # ── Footer ───────────────────────────────────────────────────────────
        f'  <tr><td style="background-color:{_BLACK};padding:0;">\n'
        f'    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">\n'
        f'      <tr><td align="center" style="padding:34px 40px 18px 40px;">\n'
        f'        <img src="{_LOGO_WHITE}" alt="ato comm" width="150"\n'
        f'             style="width:150px;display:block;margin:0 auto;border:0;">\n'
        f'      </td></tr>\n'
        f'      <tr><td align="center" style="padding:0 40px 18px 40px;'
        f'font-family:Arial,Helvetica,sans-serif;">\n'
        f'        <a href="tel:+38617774340" style="color:#a5a5a5;font-size:14px;text-decoration:none;">+386 1 777-43-40</a>\n'
        f'        <span style="color:#6d6d6d;">&nbsp;&middot;&nbsp;</span>\n'
        f'        <a href="tel:+17249938399" style="color:#a5a5a5;font-size:14px;text-decoration:none;">+1 724 993-83-99</a>\n'
        f'      </td></tr>\n'
        f'      <tr><td align="center" style="padding:0 40px 20px 40px;">\n'
        f'        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>\n'
        f'          <td style="padding:0 7px;"><a href="https://t.me/atocomm" target="_blank">'
        f'<img src="{_ICON_TG}" alt="Telegram" width="30" style="width:30px;display:block;border:0;"></a></td>\n'
        f'          <td style="padding:0 7px;"><a href="https://www.linkedin.com/company/ato-comm" target="_blank">'
        f'<img src="{_ICON_LI}" alt="LinkedIn" width="30" style="width:30px;display:block;border:0;"></a></td>\n'
        f'          <td style="padding:0 7px;"><a href="https://www.facebook.com/atocomm" target="_blank">'
        f'<img src="{_ICON_FB}" alt="Facebook" width="30" style="width:30px;display:block;border:0;"></a></td>\n'
        f'        </tr></table>\n'
        f'      </td></tr>\n'
        f'      <tr><td style="padding:0 50px;">'
        f'<div style="border-top:1px solid #2a2a2a;font-size:0;line-height:0;">&nbsp;</div></td></tr>\n'
        f'      <tr><td align="center" style="padding:20px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;">\n'
        f'        <p style="margin:0;font-size:13px;line-height:1.6;color:#a5a5a5;">\n'
        f'          ato comm d.o.o. &middot; Ptujska Gora 37A, 2323 Slovenia\n'
        f'        </p>\n'
        f'      </td></tr>\n'
        f'      <tr><td align="center" style="padding:0 40px 34px 40px;font-family:Arial,Helvetica,sans-serif;">\n'
        f'        <a href="https://www.atocomm.eu/privacy" target="_blank"\n'
        f'           style="color:{_GREEN};font-size:13px;text-decoration:none;">Privacy Policy</a>\n'
        f'      </td></tr>\n'
        f'    </table>\n'
        f'  </td></tr>\n\n'

        '</table>\n\n'
        '</td></tr>\n'
        '</table>\n'
        '</body>\n'
        '</html>'
    )


def _body_text(content: str) -> str:
    """Wraps body text paragraph(s) in a standard white table row."""
    return (
        f'  <tr><td style="padding:32px 40px 0 40px;background-color:{_WHITE};\n'
        f'              font-family:Arial,Helvetica,sans-serif;font-size:16px;\n'
        f'              line-height:1.6;color:#3a3a3a;">\n'
        f'    {content}\n'
        f'  </td></tr>\n'
    )


def _cta_button(url: str, label: str) -> str:
    return (
        f'  <tr><td align="center" style="padding:28px 40px 36px 40px;background-color:{_WHITE};">\n'
        f'    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">\n'
        f'      <tr><td align="center" bgcolor="{_GREEN}" style="border-radius:48px;">\n'
        f'        <a href="{url}" target="_blank"\n'
        f'           style="display:inline-block;padding:17px 44px;\n'
        f'                  font-family:Arial,Helvetica,sans-serif;font-size:17px;\n'
        f'                  font-weight:bold;color:{_BLACK};text-decoration:none;\n'
        f'                  border-radius:48px;letter-spacing:0.3px;">\n'
        f'          {label} &rarr;\n'
        f'        </a>\n'
        f'      </td></tr>\n'
        f'    </table>\n'
        f'  </td></tr>\n'
    )


def _credentials_block(label: str, value: str) -> str:
    """Renders a credential row (login / password) with monospace value."""
    return (
        f'<p style="margin:12px 0 0 0;">'
        f'<span style="color:#6d6d6d;">{label}:</span>&nbsp;'
        f'<strong style="font-family:\'Courier New\',Courier,monospace;color:{_BLACK};">{value}</strong>'
        f'</p>'
    )


def _info_box(content: str, color: str = "#f5f6f7") -> str:
    return (
        f'<div style="padding:16px 20px;background-color:{color};border-radius:8px;\n'
        f'             font-family:Arial,Helvetica,sans-serif;font-size:14px;\n'
        f'             line-height:1.55;color:#3a3a3a;margin:16px 0 0 0;">\n'
        f'  {content}\n'
        f'</div>'
    )


def _comment_box(comment: str) -> str:
    return (
        f'<div style="margin:20px 0 0 0;padding:14px 18px;'
        f'border-left:4px solid #F59E0B;background-color:#fffbeb;\n'
        f'border-radius:0 6px 6px 0;font-family:Arial,Helvetica,sans-serif;\n'
        f'font-size:14px;line-height:1.55;color:#3a3a3a;">\n'
        f'  <strong style="color:#92400e;">Comment from organizer:</strong><br>{comment}\n'
        f'</div>'
    )


# ── Core SMTP sender ──────────────────────────────────────────────────────────

async def send_email(
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> None:
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


# ── Exhibitor-facing templates ────────────────────────────────────────────────

def render_welcome_exhibitor(
    login_url: str,
    email_addr: str,
    password: str,
) -> Tuple[str, str]:
    text = (
        f"Welcome to ATO COMM Exhibitor Portal.\n\n"
        f"Your account has been created. Please log in using the credentials below.\n\n"
        f"Login:              {email_addr}\n"
        f"Temporary password: {password}\n\n"
        f"After logging in you can change your password in the portal settings.\n\n"
        f"Open portal: {login_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    body = (
        _body_text(
            "<p style='margin:0 0 8px 0;'>Your account has been created. "
            "Please use the credentials below to access the Exhibitor Portal.</p>"
            + _credentials_block("Login", email_addr)
            + _credentials_block("Temporary password", password)
            + "<p style='margin:16px 0 0 0;font-size:14px;color:#6d6d6d;'>"
            "After logging in you can change your password in the portal settings.</p>"
        )
        + _cta_button(login_url, "Open Portal")
    )
    html = _html_layout(
        "Portal Access",
        f"Welcome to<br>ATO COMM <span style='color:{_GREEN};'>Exhibitor Portal.</span>",
        body,
    )
    return text, html


def render_task_status_changed(
    company_name: str,
    section: str,
    new_status: str,
    comment: Optional[str],
    portal_url: str,
) -> Tuple[str, str]:
    section_label = _SECTION_NAMES.get(section, section.title())
    status_label  = _STATUS_LABELS.get(new_status, new_status)
    is_approved   = new_status in ("APPROVED", "VALID")
    is_revision   = new_status in ("REVISION_NEEDED", "INVALID")

    status_color = _GREEN if is_approved else ("#F59E0B" if is_revision else "#3B82F6")
    hero_verb = (
        f"<span style='color:{_GREEN};'>approved.</span>" if is_approved
        else f"<span style='color:#F59E0B;'>revision required.</span>" if is_revision
        else f"<span style='color:#3B82F6;'>updated.</span>"
    )

    comment_txt = f"\n\nComment from organizer: {comment}" if comment else ""
    text = (
        f"Hi {company_name},\n\n"
        f"The status of your section «{section_label}» has been updated.\n"
        f"New status: {status_label}{comment_txt}\n\n"
        f"Log in to see details: {portal_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )

    status_badge = (
        f'<span style="display:inline-block;padding:6px 18px;border-radius:24px;'
        f'background-color:{status_color};color:{_BLACK if is_approved else _WHITE};\n'
        f'font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">'
        f'{status_label}</span>'
    )
    body_content = (
        f"<p style='margin:0 0 8px 0;'>Hi <strong>{company_name}</strong>,</p>"
        f"<p style='margin:0 0 16px 0;'>The status of your "
        f"<strong>{section_label}</strong> section has been updated:</p>"
        + status_badge
        + (_comment_box(comment) if comment else "")
    )
    body = (
        _body_text(body_content)
        + _cta_button(portal_url, "Open Portal")
    )
    html = _html_layout(
        "Status Update",
        f"{section_label}<br>{hero_verb}",
        body,
    )
    return text, html


def render_section_unlocked(
    company_name: str,
    sections: List[str],
    portal_url: str,
) -> Tuple[str, str]:
    labels = [_SECTION_NAMES.get(s, s.title()) for s in sections]
    labels_str = ", ".join(labels)
    text = (
        f"Hi {company_name},\n\n"
        f"The following section(s) have been unlocked for editing: {labels_str}.\n\n"
        f"Please log in and make the requested changes: {portal_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    items_html = "".join(
        f'<p style="margin:6px 0 0 0;">'
        f'<span style="color:{_GREEN};font-weight:bold;font-size:17px;">&#10003;</span>'
        f'&nbsp;&nbsp;{lbl}</p>'
        for lbl in labels
    )
    body_content = (
        f"<p style='margin:0 0 12px 0;'>Hi <strong>{company_name}</strong>,</p>"
        f"<p style='margin:0 0 16px 0;'>The following section(s) have been unlocked "
        f"by the organizer. Please log in and make the requested changes:</p>"
        + items_html
        + "<p style='margin:20px 0 0 0;font-size:14px;color:#6d6d6d;'>"
        "You can edit and re-submit the unlocked sections from your portal dashboard.</p>"
    )
    body = _body_text(body_content) + _cta_button(portal_url, "Open Portal")
    html = _html_layout(
        "Action Required",
        f"Your section has<br>been <span style='color:{_GREEN};'>unlocked.</span>",
        body,
    )
    return text, html


def render_password_changed(portal_url: str) -> Tuple[str, str]:
    text = (
        f"Your ATO COMM Exhibitor Portal password has been successfully changed.\n\n"
        f"If you did not make this change, please contact the organizer immediately.\n\n"
        f"Portal: {portal_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    body_content = (
        "<p style='margin:0 0 16px 0;'>"
        "Your password for the ATO COMM Exhibitor Portal has been successfully changed.</p>"
        + _info_box(
            "If you did not make this change, please contact the organizer immediately.",
            "#fff3cd",
        )
    )
    body = _body_text(body_content) + _cta_button(portal_url, "Open Portal")
    html = _html_layout(
        "Security Notice",
        f"Your password<br>has been <span style='color:{_GREEN};'>changed.</span>",
        body,
    )
    return text, html


def render_password_reset(
    login_url: str,
    email_addr: str,
    new_password: str,
) -> Tuple[str, str]:
    text = (
        f"Your ATO COMM Exhibitor Portal password has been reset by the organizer.\n\n"
        f"Login:                {email_addr}\n"
        f"New temporary password: {new_password}\n\n"
        f"Please log in and change your password immediately.\n\n"
        f"Open portal: {login_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    body_content = (
        "<p style='margin:0 0 8px 0;'>Your password for the ATO COMM Exhibitor Portal "
        "has been reset by the organizer. Please log in using the credentials below "
        "and change your password immediately.</p>"
        + _credentials_block("Login", email_addr)
        + _credentials_block("New temporary password", new_password)
    )
    body = _body_text(body_content) + _cta_button(login_url, "Log In")
    html = _html_layout(
        "Password Reset",
        f"New temporary<br><span style='color:{_GREEN};'>password.</span>",
        body,
    )
    return text, html


def render_reminder(company_name: str, portal_url: str) -> Tuple[str, str]:
    text = (
        f"Hi {company_name},\n\n"
        f"This is a reminder to complete your pending tasks in the ATO COMM Exhibitor Portal.\n\n"
        f"Please log in and review your outstanding items: {portal_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    body_content = (
        f"<p style='margin:0 0 16px 0;'>Hi <strong>{company_name}</strong>,</p>"
        "<p style='margin:0;'>You have pending tasks in the ATO COMM Exhibitor Portal. "
        "Please log in and complete the outstanding items before the deadline.</p>"
    )
    body = _body_text(body_content) + _cta_button(portal_url, "Open Portal")
    html = _html_layout(
        "Reminder",
        f"Tasks awaiting<br>your <span style='color:{_GREEN};'>attention.</span>",
        body,
    )
    return text, html


# ── Admin notification templates ──────────────────────────────────────────────

def notify_admin_new_upload(
    exhibitor_name: str,
    event_name: str,
) -> Tuple[str, str, str]:
    subject = f"New graphic upload: {exhibitor_name}"
    text    = f"{exhibitor_name} uploaded files for {event_name}."
    body_content = (
        f"<p style='margin:0 0 8px 0;'><strong>{exhibitor_name}</strong> has uploaded "
        f"graphic files for the event <strong>{event_name}</strong>.</p>"
        "<p style='margin:8px 0 0 0;color:#6d6d6d;font-size:14px;'>"
        "Please review the uploaded files in the admin panel.</p>"
    )
    html = _html_layout(
        "Admin Notification",
        f"New graphic<br><span style='color:{_GREEN};'>upload received.</span>",
        _body_text(body_content),
    )
    return subject, text, html


def notify_admin_equipment(
    exhibitor_name: str,
    event_name: str,
    lines: List[Dict[str, Any]],
) -> Tuple[str, str, str]:
    subject = f"Equipment order: {exhibitor_name}"
    text = (
        f"Company {exhibitor_name} — event {event_name}\n\n"
        + "\n".join(f"- {x.get('name')} x{x.get('quantity')}" for x in lines)
    )
    rows_html = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;'
        f'font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3a3a3a;">'
        f'{x.get("name", "")}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;'
        f'font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:{_BLACK};">'
        f'x{x.get("quantity", 0)}</td></tr>'
        for x in lines
    )
    body_content = (
        f"<p style='margin:0 0 16px 0;'><strong>{exhibitor_name}</strong> submitted an "
        f"equipment order for <strong>{event_name}</strong>.</p>"
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        f'{rows_html}'
        f'</table>'
    )
    html = _html_layout(
        "Admin Notification",
        f"Equipment order<br><span style='color:{_GREEN};'>received.</span>",
        _body_text(body_content),
    )
    return subject, text, html


def notify_admin_participants_submitted(
    company_name: str,
    event_name: str,
    count: int,
) -> Tuple[str, str, str]:
    subject = f"Participants submitted: {company_name}"
    text    = f"{company_name} submitted {count} participant(s) for {event_name}."
    body_content = (
        f"<p style='margin:0 0 8px 0;'><strong>{company_name}</strong> has submitted "
        f"the participant list for <strong>{event_name}</strong>.</p>"
        f"<p style='margin:8px 0 0 0;font-size:32px;font-weight:bold;color:{_BLACK};'>"
        f"{count} <span style='font-size:16px;color:#6d6d6d;font-weight:normal;'>participant(s)</span></p>"
    )
    html = _html_layout(
        "Admin Notification",
        f"Participants list<br><span style='color:{_GREEN};'>submitted.</span>",
        _body_text(body_content),
    )
    return subject, text, html


def notify_admin_description_submitted(
    company_name: str,
    event_name: str,
) -> Tuple[str, str, str]:
    subject = f"Company description submitted: {company_name}"
    text    = f"{company_name} submitted their company description for {event_name}."
    body_content = (
        f"<p style='margin:0 0 8px 0;'><strong>{company_name}</strong> has submitted "
        f"their company description for <strong>{event_name}</strong>.</p>"
        "<p style='margin:8px 0 0 0;color:#6d6d6d;font-size:14px;'>"
        "Please review it in the admin panel.</p>"
    )
    html = _html_layout(
        "Admin Notification",
        f"Company description<br><span style='color:{_GREEN};'>submitted.</span>",
        _body_text(body_content),
    )
    return subject, text, html


def render_welcome_manager(
    login_url: str,
    email_addr: str,
    password: str,
) -> Tuple[str, str]:
    text = (
        f"Welcome to the ATO COMM Management Portal.\n\n"
        f"An organizer account has been created for you with full access to the "
        f"admin panel. Please log in using the credentials below.\n\n"
        f"Login:              {email_addr}\n"
        f"Temporary password: {password}\n\n"
        f"After logging in you can change your password in the portal settings.\n\n"
        f"Open portal: {login_url}\n\n"
        f"ato comm d.o.o. · Ptujska Gora 37A, 2323 Slovenia"
    )
    body = (
        _body_text(
            "<p style='margin:0 0 8px 0;'>An organizer account has been created for you "
            "with full access to the ATO COMM Management Portal. "
            "Please use the credentials below to sign in.</p>"
            + _credentials_block("Login", email_addr)
            + _credentials_block("Temporary password", password)
            + "<p style='margin:16px 0 0 0;font-size:14px;color:#6d6d6d;'>"
            "After logging in you can change your password in the portal settings.</p>"
        )
        + _cta_button(login_url, "Open Portal")
    )
    html = _html_layout(
        "Portal Access",
        f"Welcome to the<br>ATO COMM <span style='color:{_GREEN};'>Management Portal.</span>",
        body,
    )
    return text, html


def notify_admin_change_request(
    company_name: str,
    section: str,
    message: str,
) -> Tuple[str, str, str]:
    section_label = _SECTION_NAMES.get(section, section.title())
    subject = f"Revision request: {company_name}"
    text    = f"{company_name} requested unlock for {section_label}. {message}"
    body_content = (
        f"<p style='margin:0 0 16px 0;'><strong>{company_name}</strong> has requested "
        f"a revision unlock for the <strong>{section_label}</strong> section.</p>"
        + (_comment_box(message) if message else "")
    )
    html = _html_layout(
        "Admin Notification",
        f"Revision unlock<br><span style='color:{_GREEN};'>requested.</span>",
        _body_text(body_content),
    )
    return subject, text, html
