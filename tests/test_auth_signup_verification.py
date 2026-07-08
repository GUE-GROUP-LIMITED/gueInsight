from app import create_app, db, mail
from app.config import Config
from app.models import User
import app.routes.users_auth_privacy_routes as auth_privacy_routes


def _signup_payload(email):
    return {
        'email': email,
        'password': 'StrongPass123',
        'first_name': 'Test',
        'last_name': 'User',
        'phone_number': '0123456789',
        'country_of_residence': 'Belgium',
        'address': 'Main Street 1',
        'city': 'Brussels',
        'postal_code': '1000',
        'agree_to_terms': True,
        'gdpr_consent': True,
    }


def test_signup_and_verification_flow_success():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True, FRONTEND_URL='http://localhost:5173')

    with app.app_context():
        db.drop_all()
        db.create_all()

    with app.test_client() as client:
        signup = client.post('/auth/signup', json=_signup_payload('verify.success@example.com'))
        assert signup.status_code == 201
        payload = signup.get_json()
        assert payload['verification_url']

        verify_path = '/' + payload['verification_url'].split('/', 3)[-1]
        verify = client.get(verify_path)
        assert verify.status_code == 302
        assert 'verified=1' in verify.headers.get('Location', '')

        with app.app_context():
            user = User.query.filter_by(email='verify.success@example.com').first()
            assert user is not None
            assert user.is_active is True
            assert user.email_verified_at is not None



def test_signup_mail_failure_returns_202_and_preserves_account(monkeypatch):
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=False, MAIL_SUPPRESS_SEND=False)

    with app.app_context():
        db.drop_all()
        db.create_all()

    def _raise_mail_error(_msg):
        raise RuntimeError('smtp unavailable')

    monkeypatch.setattr(mail, 'send', _raise_mail_error)

    with app.test_client() as client:
        signup = client.post('/auth/signup', json=_signup_payload('verify.fail@example.com'))
        assert signup.status_code == 202
        payload = signup.get_json()
        assert payload['verification_email_sent'] is False

        with app.app_context():
            user = User.query.filter_by(email='verify.fail@example.com').first()
            assert user is not None
            assert user.email_verified_at is None
            assert user.is_active is False



def test_resend_verification_for_pending_user_returns_success():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True)

    with app.app_context():
        db.drop_all()
        db.create_all()

    with app.test_client() as client:
        client.post('/auth/signup', json=_signup_payload('resend@example.com'))

        resend = client.post('/auth/verify-email/resend', json={'email': 'resend@example.com'})
        assert resend.status_code == 200
        payload = resend.get_json()
        assert payload['verification_url']


def test_failed_login_spike_triggers_auth_anomaly_alert(monkeypatch):
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True, AUTH_ANOMALY_ALERT_THRESHOLD=2, ENABLE_PRODUCTION_ALERTS=True)

    with app.app_context():
        db.drop_all()
        db.create_all()

    alerts = []
    monkeypatch.setattr(auth_privacy_routes, 'emit_operational_alert', lambda **kwargs: alerts.append(kwargs))
    monkeypatch.setattr(auth_privacy_routes, 'alerts_enabled', lambda _app: True)

    with app.test_client() as client:
        first = client.post('/auth/login', json={'email': 'missing@example.com', 'password': 'wrong'})
        second = client.post('/auth/login', json={'email': 'missing@example.com', 'password': 'wrong'})

    assert first.status_code == 401
    assert second.status_code == 401
    assert alerts
    assert alerts[-1]['category'] == 'auth_anomaly'
