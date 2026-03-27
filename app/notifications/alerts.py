import requests
import os

# --- Slack Notification ---
def send_slack_alert(message, webhook_url=None):
    """
    Send a message to a Slack channel using an incoming webhook.
    """
    webhook_url = webhook_url or os.getenv('SLACK_WEBHOOK_URL')
    if not webhook_url:
        return {'error': 'No Slack webhook URL configured.'}
    payload = {"text": message}
    resp = requests.post(webhook_url, json=payload)
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
    resp = requests.post(webhook_url, json=payload)
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
    resp = requests.post(url, data=data, auth=(account_sid, auth_token))
    return {'status_code': resp.status_code, 'response': resp.text}
