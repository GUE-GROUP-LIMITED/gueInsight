import logging
import os
from time import time
from threading import Lock

from app.notifications.alerts import send_slack_alert, send_teams_alert

logger = logging.getLogger(__name__)

# In-memory throttle cache to avoid flooding outbound channels.
_ALERT_CACHE = {}
_ALERT_LOCK = Lock()


def _is_truthy(value):
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _app_env(app=None):
    if app is not None:
        configured = app.config.get('APP_ENV') or app.config.get('ENV')
        if configured:
            return str(configured).strip().lower()
    return str(os.getenv('APP_ENV', os.getenv('FLASK_ENV', 'development'))).strip().lower()


def alerts_enabled(app=None):
    if app is not None:
        explicit = app.config.get('ENABLE_PRODUCTION_ALERTS')
        if explicit is not None:
            return bool(explicit)

    configured = os.getenv('ENABLE_PRODUCTION_ALERTS')
    if configured is not None:
        return _is_truthy(configured)

    return _app_env(app) in {'production', 'prod'}


def emit_operational_alert(category, message, details=None, min_interval_seconds=300):
    """Emit operational alerts to configured channels with a simple per-key throttle."""
    cache_key = f"{category}:{message}"
    now = int(time())

    with _ALERT_LOCK:
        previous = _ALERT_CACHE.get(cache_key)
        if previous and now - previous < int(min_interval_seconds):
            return {'status': 'throttled', 'category': category}
        _ALERT_CACHE[cache_key] = now

    details_text = ''
    if details:
        details_text = f"\nDetails: {details}"

    body = f"[gueInsight Operational Alert] {category}\n{message}{details_text}"
    logger.warning(body)

    slack_result = None
    teams_result = None

    try:
        slack_result = send_slack_alert(body)
    except Exception:
        logger.exception('Failed to send Slack operational alert for %s', category)

    try:
        teams_result = send_teams_alert(body)
    except Exception:
        logger.exception('Failed to send Teams operational alert for %s', category)

    return {
        'status': 'sent',
        'category': category,
        'slack': slack_result,
        'teams': teams_result,
    }
