from flask import Flask
import pytest

from app import security


def _reset_rate_limit_cache():
    security._rate_limit_cache.clear()


def test_normalize_api_key_trims_and_handles_none():
    assert security._normalize_api_key(None) is None
    assert security._normalize_api_key('  abc  ') == 'abc'


def test_prune_expired_rate_limit_windows_removes_old_entries():
    _reset_rate_limit_cache()
    security._rate_limit_cache['1.1.1.1:10'] = 3
    security._rate_limit_cache['1.1.1.1:11'] = 4
    security._rate_limit_cache['1.1.1.1:12'] = 5

    security._prune_expired_rate_limit_windows(12)

    assert '1.1.1.1:10' not in security._rate_limit_cache
    assert '1.1.1.1:11' in security._rate_limit_cache
    assert '1.1.1.1:12' in security._rate_limit_cache


def test_require_api_key_rejects_and_allows_by_header(monkeypatch):
    app = Flask(__name__)

    @app.get('/protected')
    @security.require_api_key
    def protected():
        return {'ok': True}, 200

    with app.test_client() as client:
        monkeypatch.setenv('GUEINSIGHT_API_KEY', 'expected-key')

        missing = client.get('/protected')
        assert missing.status_code == 401

        wrong = client.get('/protected', headers={'X-API-Key': 'wrong'})
        assert wrong.status_code == 401

        allowed = client.get('/protected', headers={'X-API-Key': 'expected-key'})
        assert allowed.status_code == 200
        assert allowed.get_json()['ok'] is True


def test_rate_limit_blocks_after_threshold(monkeypatch):
    app = Flask(__name__)

    @app.get('/limited')
    @security.rate_limit
    def limited():
        return {'ok': True}, 200

    _reset_rate_limit_cache()
    monkeypatch.setattr(security, 'RATE_LIMIT', 2)
    monkeypatch.setattr(security, 'RATE_PERIOD', 60)
    monkeypatch.setattr(security, 'time', lambda: 120)

    with app.test_client() as client:
        first = client.get('/limited')
        second = client.get('/limited')
        third = client.get('/limited')

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429


def test_encrypt_and_decrypt_sensitive_value_round_trip():
    app = Flask(__name__)
    app.config.update(SECRET_KEY='test-secret', SECURITY_PASSWORD_SALT='test-salt')

    with app.app_context():
        encrypted = security.encrypt_sensitive_value('my-api-token')
        assert encrypted != 'my-api-token'
        assert security.decrypt_sensitive_value(encrypted) == 'my-api-token'


def test_encrypt_sensitive_value_requires_non_empty_input():
    app = Flask(__name__)
    app.config.update(SECRET_KEY='test-secret', SECURITY_PASSWORD_SALT='test-salt')

    with app.app_context():
        with pytest.raises(ValueError):
            security.encrypt_sensitive_value('')


def test_decrypt_sensitive_value_rejects_plaintext():
    app = Flask(__name__)
    app.config.update(SECRET_KEY='test-secret', SECURITY_PASSWORD_SALT='test-salt')

    with app.app_context():
        with pytest.raises(ValueError):
            security.decrypt_sensitive_value('not-encrypted')


def test_encrypt_sensitive_value_requires_configured_secrets():
    app = Flask(__name__)
    app.config.update(SECRET_KEY='', SECURITY_PASSWORD_SALT='')

    with app.app_context():
        with pytest.raises(RuntimeError):
            security.encrypt_sensitive_value('my-api-token')
