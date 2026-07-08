from functools import wraps
from flask import request, jsonify, current_app
import os
from time import time
from hmac import compare_digest
from threading import Lock
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

# Simple in-memory rate limiter (per IP)
RATE_LIMIT = 100  # requests
RATE_PERIOD = 60  # seconds
_rate_limit_cache = {}
_cache_lock = Lock()


def _normalize_api_key(value):
    if value is None:
        return None
    return str(value).strip()


def _get_fernet():
    """Build a deterministic Fernet key from app secrets for at-rest encryption."""
    secret = _normalize_api_key(current_app.config.get('SECRET_KEY'))
    salt = _normalize_api_key(current_app.config.get('SECURITY_PASSWORD_SALT'))
    if not secret or not salt:
        raise RuntimeError('Encryption secrets are not configured.')

    digest = hashlib.sha256(f"{secret}:{salt}".encode('utf-8')).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_sensitive_value(value):
    normalized = _normalize_api_key(value)
    if not normalized:
        raise ValueError('Cannot encrypt empty value.')
    return _get_fernet().encrypt(normalized.encode('utf-8')).decode('utf-8')


def decrypt_sensitive_value(value):
    normalized = _normalize_api_key(value)
    if not normalized:
        raise ValueError('Cannot decrypt empty value.')
    try:
        return _get_fernet().decrypt(normalized.encode('utf-8')).decode('utf-8')
    except InvalidToken as exc:
        raise ValueError('Stored value is not decryptable with active secrets.') from exc


def _prune_expired_rate_limit_windows(current_window):
    # Keep only the active and previous window to bound memory growth.
    min_window = current_window - 1
    expired = [key for key in _rate_limit_cache if int(key.rsplit(':', 1)[-1]) < min_window]
    for key in expired:
        _rate_limit_cache.pop(key, None)

def require_api_key(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        api_key = _normalize_api_key(request.headers.get('X-API-Key'))
        valid_key = _normalize_api_key(os.getenv('GUEINSIGHT_API_KEY') or getattr(current_app, 'api_key', None))
        if not api_key or not valid_key or not compare_digest(api_key, valid_key):
            return jsonify({'status': 'error', 'message': 'Invalid or missing API key.'}), 401
        return view_func(*args, **kwargs)
    return wrapped

def rate_limit(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        ip = request.remote_addr
        now = int(time())
        window = now // RATE_PERIOD
        key = f"{ip}:{window}"
        with _cache_lock:
            _prune_expired_rate_limit_windows(window)
            count = _rate_limit_cache.get(key, 0)
            if count >= RATE_LIMIT:
                return jsonify({'status': 'error', 'message': 'Rate limit exceeded.'}), 429
            _rate_limit_cache[key] = count + 1
        return view_func(*args, **kwargs)
    return wrapped
