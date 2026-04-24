import pytest
from flask_login import LoginManager
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.config import Config
from app.models import DataDeletionRequest, SecurityEvent, User, UserRole


@pytest.fixture()
def client():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True)

    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    with app.app_context():
        db.drop_all()
        db.create_all()

        yield app.test_client()

        db.session.remove()
        db.drop_all()


def _create_user(email='user@example.com', role=UserRole.USER, is_active=True):
    user = User(
        email=email,
        password=generate_password_hash('Password123!', method='pbkdf2:sha256'),
        first_name='Test',
        last_name='User',
        phone_number='0000000000',
        role=role,
        is_active=is_active,
    )
    db.session.add(user)
    db.session.commit()
    return user


def _login(client, email='user@example.com', password='Password123!'):
    return client.post('/auth/login', json={'email': email, 'password': password})


def test_signup_requires_explicit_consent(client):
    response = client.post(
        '/auth/signup',
        json={
            'email': 'no-consent@example.com',
            'password': 'Password123!',
            'first_name': 'No',
            'last_name': 'Consent',
            'phone_number': '1234',
            'agree_to_terms': False,
            'gdpr_consent': False,
        },
    )
    assert response.status_code == 400

    valid_response = client.post(
        '/auth/signup',
        json={
            'email': 'with-consent@example.com',
            'password': 'Password123!',
            'first_name': 'With',
            'last_name': 'Consent',
            'phone_number': '1234',
            'agree_to_terms': True,
            'gdpr_consent': True,
            'newsletter': True,
        },
    )
    assert valid_response.status_code == 201
    payload = valid_response.get_json()
    assert payload['user']['gdpr_consent_at'] is not None


def test_login_rate_limit_logs_security_event(client):
    _create_user(email='ratelimit@example.com')

    for _ in range(8):
        response = client.post('/auth/login', json={'email': 'ratelimit@example.com', 'password': 'wrong-pass'})
        assert response.status_code in {401, 429}

    final_response = client.post('/auth/login', json={'email': 'ratelimit@example.com', 'password': 'wrong-pass'})
    assert final_response.status_code == 429

    events = SecurityEvent.query.filter(SecurityEvent.event_type == 'auth.login.rate_limited').all()
    assert len(events) >= 1


def test_export_and_delete_request_flow(client):
    _create_user(email='privacy@example.com')
    login_response = _login(client, email='privacy@example.com')
    assert login_response.status_code == 200

    export_response = client.post('/auth/privacy/export')
    assert export_response.status_code == 200
    export_payload = export_response.get_json()
    assert export_payload['export']['user']['email'] == 'privacy@example.com'

    delete_response = client.post('/auth/privacy/delete-request', json={'reason': 'No longer needed'})
    assert delete_response.status_code == 202

    deletion_requests = DataDeletionRequest.query.filter_by(status='pending').all()
    assert len(deletion_requests) == 1

    user = User.query.filter_by(email='privacy@example.com').first()
    assert user.is_active is False


def test_admin_can_view_compliance_endpoints(client):
    _create_user(email='admin@example.com', role=UserRole.ADMIN)
    user = _create_user(email='member@example.com')

    _login(client, email='admin@example.com')

    client.post('/auth/login', json={'email': 'member@example.com', 'password': 'bad'})
    client.post('/auth/login', json={'email': 'member@example.com', 'password': 'Password123!'})

    db.session.add(DataDeletionRequest(user_id=user.id, reason='test', status='pending'))
    db.session.commit()

    events_response = client.get('/admin/security_events')
    assert events_response.status_code == 200
    assert 'security_events' in events_response.get_json()

    requests_response = client.get('/admin/deletion_requests')
    assert requests_response.status_code == 200
    assert 'deletion_requests' in requests_response.get_json()
