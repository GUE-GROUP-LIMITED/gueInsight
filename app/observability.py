import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

from flask import g, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest


REQUEST_COUNT = Counter(
    'gueinsight_http_requests_total',
    'Total HTTP requests processed',
    ['method', 'endpoint', 'status_code'],
)

REQUEST_LATENCY = Histogram(
    'gueinsight_http_request_duration_seconds',
    'Latency of HTTP requests',
    ['method', 'endpoint'],
)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }

        request_id = getattr(record, 'request_id', None)
        if request_id:
            payload['request_id'] = request_id

        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)

        return json.dumps(payload)


class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = getattr(g, 'request_id', None)
        return True


def setup_logging(app):
    level_name = str(os.getenv('LOG_LEVEL', 'INFO')).upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestIdFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = [handler]

    app.logger.setLevel(level)


def register_observability(app):
    setup_logging(app)

    @app.before_request
    def _before_request_observability():
        g.request_start_time = time.perf_counter()
        g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())

    @app.after_request
    def _after_request_observability(response):
        duration = max(time.perf_counter() - getattr(g, 'request_start_time', time.perf_counter()), 0.0)
        endpoint = request.endpoint or request.path or 'unknown'

        REQUEST_COUNT.labels(request.method, endpoint, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, endpoint).observe(duration)

        response.headers['X-Request-ID'] = getattr(g, 'request_id', '')
        return response

    @app.route('/metrics')
    def metrics():
        return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}