import pytest
from flask import Flask, jsonify

from app import create_app
from app.config import Config
from app.security import require_api_key


@pytest.fixture()
def client():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True)

    with app.app_context():
        yield app.test_client()


def test_healthz_has_request_id_and_security_headers(client):
    response = client.get('/healthz')

    assert response.status_code == 200
    assert response.headers.get('X-Request-ID')
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'


def test_metrics_endpoint_exposes_prometheus_data(client):
    # Prime metrics by generating a request first.
    client.get('/healthz')

    response = client.get('/metrics')
    payload = response.data.decode('utf-8')

    assert response.status_code == 200
    assert 'text/plain' in response.headers.get('Content-Type', '')
    assert 'gueinsight_http_requests_total' in payload


def test_require_api_key_rejects_wrong_key(monkeypatch):
    monkeypatch.setenv('GUEINSIGHT_API_KEY', 'secret-value')

    app = Flask(__name__)

    @app.route('/protected')
    @require_api_key
    def protected():
        return jsonify({'ok': True})

    test_client = app.test_client()

    unauthorized = test_client.get('/protected')
    assert unauthorized.status_code == 401

    forbidden = test_client.get('/protected', headers={'X-API-Key': 'wrong'})
    assert forbidden.status_code == 401

    authorized = test_client.get('/protected', headers={'X-API-Key': 'secret-value'})
    assert authorized.status_code == 200
