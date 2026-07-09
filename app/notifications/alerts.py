import os
import logging

import requests
from flask import current_app
from flask_mail import Message

from app import mail

REQUEST_TIMEOUT_SECONDS = 10
logger = logging.getLogger(__name__)


def _resolve_profile_sender(profile):
    """Resolve a sender identity for transactional categories."""
    profile_name = (profile or '').strip().lower()
    if not profile_name:
        return current_app.config.get('MAIL_DEFAULT_SENDER')

    mapping = {
        'support': current_app.config.get('MAIL_SUPPORT_SENDER') or os.getenv('MAIL_SUPPORT_SENDER'),
        'billing': current_app.config.get('MAIL_BILLING_SENDER') or os.getenv('MAIL_BILLING_SENDER'),
        'privacy': current_app.config.get('MAIL_PRIVACY_SENDER') or os.getenv('MAIL_PRIVACY_SENDER'),
        'security': current_app.config.get('MAIL_SECURITY_SENDER') or os.getenv('MAIL_SECURITY_SENDER'),
        'alerts': current_app.config.get('MAIL_ALERTS_SENDER') or os.getenv('MAIL_ALERTS_SENDER'),
    }
    return mapping.get(profile_name) or current_app.config.get('MAIL_DEFAULT_SENDER')


def _resolve_profile_sender_name(profile):
    profile_name = (profile or '').strip().lower()
    default_name = current_app.config.get('MAIL_SENDER_NAME', 'GueInsight')
    mapping = {
        'support': current_app.config.get('MAIL_SUPPORT_SENDER_NAME') or default_name,
        'billing': current_app.config.get('MAIL_BILLING_SENDER_NAME') or default_name,
        'privacy': current_app.config.get('MAIL_PRIVACY_SENDER_NAME') or default_name,
        'security': current_app.config.get('MAIL_SECURITY_SENDER_NAME') or default_name,
        'alerts': current_app.config.get('MAIL_ALERTS_SENDER_NAME') or default_name,
    }
    return mapping.get(profile_name) or default_name


def _format_sender_identity(sender_value, sender_profile=None):
    if isinstance(sender_value, (tuple, list)) and len(sender_value) > 1:
        display_name = str(sender_value[0] or _resolve_profile_sender_name(sender_profile)).strip()
        sender_email = str(sender_value[1] or '').strip()
        return (display_name, sender_email) if sender_email else sender_value

    raw_sender = str(sender_value or '').strip()
    if not raw_sender:
        return raw_sender

    # If caller already provided a formatted mailbox (e.g. Name <email>), preserve it.
    if '<' in raw_sender and '>' in raw_sender:
        return raw_sender

    if '@' in raw_sender:
        return (_resolve_profile_sender_name(sender_profile), raw_sender)

    return raw_sender


def _normalize_reply_to(reply_to, sender_profile=None):
    if reply_to:
        return reply_to

    reply_map = {
        'support': current_app.config.get('MAIL_SUPPORT_REPLY_TO') or os.getenv('MAIL_SUPPORT_REPLY_TO'),
        'billing': current_app.config.get('MAIL_BILLING_REPLY_TO') or os.getenv('MAIL_BILLING_REPLY_TO'),
        'privacy': current_app.config.get('MAIL_PRIVACY_REPLY_TO') or os.getenv('MAIL_PRIVACY_REPLY_TO'),
        'security': current_app.config.get('MAIL_SECURITY_REPLY_TO') or os.getenv('MAIL_SECURITY_REPLY_TO'),
    }
    profile_name = (sender_profile or '').strip().lower()
    if profile_name in reply_map and reply_map[profile_name]:
        return reply_map[profile_name]

    return current_app.config.get('MAIL_DEFAULT_SENDER')


def send_email(to_email, subject, body, sender=None, reply_to=None, sender_profile=None):
    """Send plain text transactional email with optional sender profile routing."""
    recipient = (to_email or '').strip()
    if not recipient:
        raise ValueError('Recipient email is required.')

    chosen_sender = _format_sender_identity(
        sender or _resolve_profile_sender(sender_profile),
        sender_profile=sender_profile,
    )
    chosen_reply_to = _normalize_reply_to(reply_to, sender_profile=sender_profile)

    msg = Message(
        subject,
        recipients=[recipient],
        sender=chosen_sender,
        reply_to=chosen_reply_to,
        body=body,
    )

    if current_app.config.get('TESTING') or current_app.config.get('MAIL_SUPPRESS_SEND'):
        logger.info('MAIL_SUPPRESS_SEND enabled: email suppressed for %s (%s)', recipient, subject)
        return {
            'status': 'suppressed',
            'to': recipient,
            'sender': chosen_sender,
            'reply_to': chosen_reply_to,
        }

    mail.send(msg)
    return {
        'status': 'sent',
        'to': recipient,
        'sender': chosen_sender,
        'reply_to': chosen_reply_to,
    }

# --- Slack Notification ---
def send_slack_alert(message, webhook_url=None):
    """
    Send a message to a Slack channel using an incoming webhook.
    """
    webhook_url = webhook_url or os.getenv('SLACK_WEBHOOK_URL')
    if not webhook_url:
        return {'error': 'No Slack webhook URL configured.'}
    payload = {"text": message}
    resp = requests.post(webhook_url, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
    return {'status_code': resp.status_code, 'response': resp.text}

# --- Microsoft Teams Notification ---
def send_teams_alert(message, webhook_url=None):
    """
    Send a message to a Microsoft Teams channel using an incoming webhook.
    """
    webhook_url = webhook_url or os.getenv('TEAMS_WEBHOOK_URL')
    if not webhook_url:
        return {'error': 'No Teams webhook URL configured.'}
    payload = {"text": message}
    resp = requests.post(webhook_url, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
    return {'status_code': resp.status_code, 'response': resp.text}

# --- SMS Notification (Twilio Example) ---
def send_sms_alert(message, to_number, from_number=None, account_sid=None, auth_token=None):
    """
    Send an SMS alert using Twilio API.
    """
    from_number = from_number or os.getenv('TWILIO_FROM_NUMBER')
    account_sid = account_sid or os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = auth_token or os.getenv('TWILIO_AUTH_TOKEN')
    if not (account_sid and auth_token and from_number):
        return {'error': 'Twilio credentials not configured.'}
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {"To": to_number, "From": from_number, "Body": message}
    resp = requests.post(url, data=data, auth=(account_sid, auth_token), timeout=REQUEST_TIMEOUT_SECONDS)
    return {'status_code': resp.status_code, 'response': resp.text}
