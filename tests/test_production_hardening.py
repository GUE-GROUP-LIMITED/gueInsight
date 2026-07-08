import pytest
from flask import Flask, request
from werkzeug.exceptions import RequestEntityTooLarge

from app import create_app, db
from app.config import Config
from app.production_errors import init_production_errors
from app.production_errors import validate_production_config
import app.production_errors as production_errors


def test_validate_production_config_rejects_sqlite_and_weak_secrets():
    app = Flask(__name__)
    app.config.update(
        APP_ENV='production',
        SECRET_KEY='dev-secret-key',
        SECURITY_PASSWORD_SALT='dev-security-salt',
        SQLALCHEMY_DATABASE_URI='sqlite:///app.db',
        SESSION_COOKIE_SECURE=False,
        REMEMBER_COOKIE_SECURE=False,
    )

    with pytest.raises(ValueError) as excinfo:
        validate_production_config(app)

    message = str(excinfo.value)
    assert 'SQLite database is not suitable for production' in message
    assert 'SECRET_KEY must be a strong, unique production secret' in message
    assert 'SECURITY_PASSWORD_SALT must be a strong, unique production secret' in message


def test_validate_production_config_enables_secure_cookies():
    app = Flask(__name__)
    app.config.update(
        APP_ENV='production',
        SECRET_KEY='super-secret-prod-key',
        SECURITY_PASSWORD_SALT='super-secret-prod-salt',
        SQLALCHEMY_DATABASE_URI='postgresql://user:pass@localhost/gueinsight',
        MAIL_USERNAME='mailer@guecyber.com',
        MAIL_PASSWORD='smtp-pass',
        MAIL_DEFAULT_SENDER='noreply@guecyber.com',
        MAIL_ENFORCE_SENDER_MATCH=True,
        SESSION_COOKIE_SECURE=False,
        REMEMBER_COOKIE_SECURE=False,
    )

    validate_production_config(app)

    assert app.config['SESSION_COOKIE_SECURE'] is True
    assert app.config['REMEMBER_COOKIE_SECURE'] is True


def test_validate_production_config_requires_mail_settings_and_sender_domain_alignment():
    app = Flask(__name__)
    app.config.update(
        APP_ENV='production',
        SECRET_KEY='super-secret-prod-key',
        SECURITY_PASSWORD_SALT='super-secret-prod-salt',
        SQLALCHEMY_DATABASE_URI='postgresql://user:pass@localhost/gueinsight',
        MAIL_USERNAME='mailer@acme.com',
        MAIL_PASSWORD='smtp-pass',
        MAIL_DEFAULT_SENDER='noreply@other-domain.com',
        MAIL_ENFORCE_SENDER_MATCH=True,
    )

    with pytest.raises(ValueError) as excinfo:
        validate_production_config(app)

    message = str(excinfo.value)
    assert 'MAIL_DEFAULT_SENDER domain must match MAIL_USERNAME domain in production' in message


def test_validate_production_config_accepts_valid_mail_settings():
    app = Flask(__name__)
    app.config.update(
        APP_ENV='production',
        SECRET_KEY='super-secret-prod-key',
        SECURITY_PASSWORD_SALT='super-secret-prod-salt',
        SQLALCHEMY_DATABASE_URI='postgresql://user:pass@localhost/gueinsight',
        MAIL_USERNAME='mailer@guecyber.com',
        MAIL_PASSWORD='smtp-pass',
        MAIL_DEFAULT_SENDER='noreply@guecyber.com',
        MAIL_ENFORCE_SENDER_MATCH=True,
        SESSION_COOKIE_SECURE=True,
        REMEMBER_COOKIE_SECURE=True,
    )

    validate_production_config(app)


def test_create_app_skips_auto_schema_creation_in_production(monkeypatch):
    calls = []

    monkeypatch.setattr(Config, 'APP_ENV', 'production', raising=False)
    monkeypatch.setattr(Config, 'AUTO_CREATE_SCHEMA', False, raising=False)
    monkeypatch.setattr(Config, 'SECRET_KEY', 'super-secret-prod-key', raising=False)
    monkeypatch.setattr(Config, 'SECURITY_PASSWORD_SALT', 'super-secret-prod-salt', raising=False)
    monkeypatch.setattr(Config, 'MAIL_USERNAME', 'mailer@guecyber.com', raising=False)
    monkeypatch.setattr(Config, 'MAIL_PASSWORD', 'smtp-pass', raising=False)
    monkeypatch.setattr(Config, 'MAIL_DEFAULT_SENDER', 'noreply@guecyber.com', raising=False)
    monkeypatch.setattr(Config, 'MAIL_ENFORCE_SENDER_MATCH', True, raising=False)
    monkeypatch.setattr(
        Config,
        'SQLALCHEMY_DATABASE_URI',
        'postgresql://user:pass@localhost/gueinsight',
        raising=False,
    )

    monkeypatch.setattr(db, 'create_all', lambda: calls.append('create_all'))

    app = create_app()
    assert app.config['AUTO_CREATE_SCHEMA'] is False
    assert calls == []


def test_production_error_handlers_return_safe_api_responses():
    app = Flask(__name__)
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True)
    init_production_errors(app)

    @app.get('/api/boom')
    def boom():
        raise RuntimeError('kaboom')

    @app.post('/api/upload')
    def upload():
        raise RequestEntityTooLarge()

    app.config['MAX_CONTENT_LENGTH'] = 1

    with app.test_client() as client:
        not_found = client.get('/api/missing')
        assert not_found.status_code == 404
        assert not_found.get_json()['error'] == 'Not found'

        server_error = client.get('/api/boom')
        assert server_error.status_code == 500
        payload = server_error.get_json()
        assert payload['error'] == 'Internal server error'
        assert payload['request_id']

        too_large = client.post('/api/upload', data=b'x' * 8, content_type='application/octet-stream')
        assert too_large.status_code == 413
        assert too_large.get_json()['error'] == 'Payload too large'


def test_api_500_spike_triggers_operational_alert(monkeypatch):
    app = Flask(__name__)
    app.config.update(TESTING=True, ENABLE_PRODUCTION_ALERTS=True, ERROR_RATE_SPIKE_THRESHOLD=3)
    init_production_errors(app)

    alerts = []
    monkeypatch.setattr(production_errors, 'emit_operational_alert', lambda **kwargs: alerts.append(kwargs))
    monkeypatch.setattr(production_errors, 'alerts_enabled', lambda _app: True)
    production_errors._recent_api_500_events.clear()

    @app.get('/api/boom')
    def boom():
        raise RuntimeError('boom')

    with app.test_client() as client:
        for _ in range(3):
            response = client.get('/api/boom')
            assert response.status_code == 500

    assert alerts
    assert alerts[-1]['category'] == 'error_rate_spike'