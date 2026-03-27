from functools import wraps
from flask import request, jsonify, current_app
import os
from time import time

# Simple in-memory rate limiter (per IP)
RATE_LIMIT = 100  # requests
RATE_PERIOD = 60  # seconds
_rate_limit_cache = {}

def require_api_key(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        valid_key = os.getenv('GUEINSIGHT_API_KEY') or getattr(current_app, 'api_key', None)
        if not api_key or api_key != valid_key:
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
        count = _rate_limit_cache.get(key, 0)
        if count >= RATE_LIMIT:
            return jsonify({'status': 'error', 'message': 'Rate limit exceeded.'}), 429
        _rate_limit_cache[key] = count + 1
        return view_func(*args, **kwargs)
    return wrapped
