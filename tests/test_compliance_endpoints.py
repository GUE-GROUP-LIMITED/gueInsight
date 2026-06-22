import pytest
from flask_login import LoginManager
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.config import Config
from app.models import DataDeletionRequest, SecurityEvent, User, UserRole, AlertRule


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

    final_status = None
    for _ in range(12):
        response = client.post('/auth/login', json={'email': 'ratelimit@example.com', 'password': 'wrong-pass'})
        final_status = response.status_code
        if response.status_code == 429:
            break
        assert response.status_code == 401

    assert final_status == 429

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
    assert export_payload['download_url'].startswith('/auth/privacy/export/download/')

    download_response = client.get(export_payload['download_url'])
    assert download_response.status_code == 200
    assert download_response.headers['Content-Type'].startswith('application/json')
    assert 'attachment' in download_response.headers.get('Content-Disposition', '').lower()

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
    _login(client, email='admin@example.com')

    db.session.add(DataDeletionRequest(user_id=user.id, reason='test', status='pending'))
    db.session.commit()

    events_response = client.get('/admin/security_events')
    assert events_response.status_code == 200
    assert 'security_events' in events_response.get_json()

    requests_response = client.get('/admin/deletion_requests')
    assert requests_response.status_code == 200
    assert 'deletion_requests' in requests_response.get_json()


def test_auth_session_and_logout_flow(client):
    _create_user(email='session@example.com')

    anonymous = client.get('/auth/session')
    assert anonymous.status_code == 200
    assert anonymous.get_json()['authenticated'] is False

    login_response = _login(client, email='session@example.com')
    assert login_response.status_code == 200

    authenticated = client.get('/auth/session')
    assert authenticated.status_code == 200
    auth_payload = authenticated.get_json()
    assert auth_payload['authenticated'] is True
    assert auth_payload['user']['email'] == 'session@example.com'

    logout_response = client.post('/auth/logout')
    assert logout_response.status_code == 200

    after_logout = client.get('/auth/session')
    assert after_logout.status_code == 200
    assert after_logout.get_json()['authenticated'] is False


def test_privacy_consent_patch_updates_profile(client):
    _create_user(email='consent@example.com')
    login_response = _login(client, email='consent@example.com')
    assert login_response.status_code == 200

    response = client.patch(
        '/auth/privacy/consent',
        json={
            'newsletter_opt_in': True,
            'refresh_legal_consent': True,
        },
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['user']['newsletter_opt_in'] is True
    assert payload['user']['gdpr_consent_at'] is not None


def test_transactions_and_receipt_not_found(client):
    _create_user(email='billing@example.com')
    login_response = _login(client, email='billing@example.com')
    assert login_response.status_code == 200

    transactions_response = client.get('/auth/transactions')
    assert transactions_response.status_code == 200
    transactions_payload = transactions_response.get_json()
    assert 'analysis_transactions' in transactions_payload
    assert 'activity_events' in transactions_payload
    assert 'billing_transactions' in transactions_payload

    receipt_response = client.get('/auth/billing/1/receipt')
    assert receipt_response.status_code == 404

    raw_receipt_response = client.get('/auth/billing/receipt/raw/1')
    assert raw_receipt_response.status_code == 404


def test_subscription_upgrade_validation(client):
    _create_user(email='upgrade@example.com')
    login_response = _login(client, email='upgrade@example.com')
    assert login_response.status_code == 200

    invalid_upgrade = client.post('/auth/subscription/upgrade', json={'plan': 'invalid-tier'})
    assert invalid_upgrade.status_code == 400


def test_admin_can_update_deletion_request_status(client):
    _create_user(email='admin2@example.com', role=UserRole.ADMIN)
    member = _create_user(email='delete-me@example.com')

    _login(client, email='admin2@example.com')

    db.session.add(DataDeletionRequest(user_id=member.id, reason='cleanup', status='pending'))
    db.session.commit()

    pending = DataDeletionRequest.query.filter_by(user_id=member.id, status='pending').first()
    assert pending is not None

    invalid = client.patch(f'/admin/deletion_requests/{pending.id}', json={'status': 'bad-status'})
    assert invalid.status_code == 400

    processed = client.patch(f'/admin/deletion_requests/{pending.id}', json={'status': 'processed'})
    assert processed.status_code == 200
    payload = processed.get_json()
    assert payload['request']['status'] == 'processed'


def test_user_can_create_and_list_support_tickets(client):
    _create_user(email='tickets@example.com')
    _login(client, email='tickets@example.com')

    empty = client.get('/support_tickets')
    assert empty.status_code == 200
    assert empty.get_json()['tickets'] == []

    create_response = client.post('/support_tickets', json={
        'subject': 'Bug in dashboard',
        'description': 'The dashboard is not loading.',
        'category': 'bug',
        'priority': 'high',
    })
    assert create_response.status_code == 201
    payload = create_response.get_json()
    assert payload['ticket']['subject'] == 'Bug in dashboard'

    list_response = client.get('/support_tickets')
    assert list_response.status_code == 200
    assert len(list_response.get_json()['tickets']) == 1


def test_support_ticket_validation(client):
    _create_user(email='val@example.com')
    _login(client, email='val@example.com')

    no_subject = client.post('/support_tickets', json={
        'description': 'Missing subject',
        'priority': 'medium',
    })
    assert no_subject.status_code == 400

    bad_priority = client.post('/support_tickets', json={
        'subject': 'Test',
        'description': 'Test ticket',
        'priority': 'extreme',
    })
    assert bad_priority.status_code == 400


def test_admin_can_list_and_toggle_alert_rules(client):
    admin = _create_user(email='alertadmin@example.com', role=UserRole.ADMIN)
    _login(client, email='alertadmin@example.com')

    rules_response = client.get('/alert_rules')
    assert rules_response.status_code == 200
    assert 'alert_rules' in rules_response.get_json()

    alerts_response = client.get('/alerts')
    assert alerts_response.status_code == 200
    assert 'alerts' in alerts_response.get_json()


def test_auth_login_validation_and_deactivated_account(client):
    missing_fields = client.post('/auth/login', json={'email': '', 'password': ''})
    assert missing_fields.status_code == 400

    invalid_credentials = client.post('/auth/login', json={'email': 'missing@example.com', 'password': 'bad'})
    assert invalid_credentials.status_code == 401

    _create_user(email='inactive@example.com', is_active=False)
    deactivated = client.post('/auth/login', json={'email': 'inactive@example.com', 'password': 'Password123!'})
    assert deactivated.status_code == 403


def test_auth_signup_validation_edges(client):
    missing_core = client.post('/auth/signup', json={'agree_to_terms': True, 'gdpr_consent': True})
    assert missing_core.status_code == 400

    short_password = client.post(
        '/auth/signup',
        json={
            'email': 'shortpass@example.com',
            'password': '123',
            'first_name': 'Short',
            'last_name': 'Pass',
            'phone_number': '1234',
            'agree_to_terms': True,
            'gdpr_consent': True,
        },
    )
    assert short_password.status_code == 400

    _create_user(email='dupe@example.com')
    duplicate = client.post(
        '/auth/signup',
        json={
            'email': 'dupe@example.com',
            'password': 'Password123!',
            'first_name': 'Dupe',
            'last_name': 'User',
            'phone_number': '1234',
            'agree_to_terms': True,
            'gdpr_consent': True,
        },
    )
    assert duplicate.status_code == 400


def test_privacy_export_download_rejects_invalid_and_cross_user_token(client):
    _create_user(email='owner@example.com')
    _create_user(email='other@example.com')

    owner_login = _login(client, email='owner@example.com')
    assert owner_login.status_code == 200

    export_response = client.post('/auth/privacy/export')
    assert export_response.status_code == 200
    download_url = export_response.get_json()['download_url']

    invalid_token_url = f'{download_url}tampered'
    invalid_token_response = client.get(invalid_token_url)
    assert invalid_token_response.status_code == 400

    client.post('/auth/logout')
    other_login = _login(client, email='other@example.com')
    assert other_login.status_code == 200

    cross_user_response = client.get(download_url)
    assert cross_user_response.status_code == 403


def test_delete_request_conflict_when_pending_exists(client):
    user = _create_user(email='pending-delete@example.com')
    db.session.add(DataDeletionRequest(user_id=user.id, reason='existing', status='pending'))
    db.session.commit()

    login_response = _login(client, email='pending-delete@example.com')
    assert login_response.status_code == 200

    conflict = client.post('/auth/privacy/delete-request', json={'reason': 'second'})
    assert conflict.status_code == 409
    assert 'request' in conflict.get_json()


def test_auth_profile_and_preferences_flow(client):
    _create_user(email='profile@example.com')
    login_response = _login(client, email='profile@example.com')
    assert login_response.status_code == 200

    missing_name = client.patch('/auth/profile', json={'first_name': '', 'last_name': 'User', 'phone_number': '1234'})
    assert missing_name.status_code == 400

    missing_phone = client.patch('/auth/profile', json={'first_name': 'Profile', 'last_name': 'User', 'phone_number': ''})
    assert missing_phone.status_code == 400

    updated = client.patch(
        '/auth/profile',
        json={
            'first_name': 'Profile',
            'last_name': 'Updated',
            'phone_number': '5550001111',
            'company': 'Acme',
            'job_title': 'Analyst',
            'primary_use_case': 'Threat intel',
            'newsletter_opt_in': True,
        },
    )
    assert updated.status_code == 200
    assert updated.get_json()['user']['first_name'] == 'Profile'

    preferences = client.get('/auth/preferences')
    assert preferences.status_code == 200
    assert 'preferences' in preferences.get_json()

    updated_preferences = client.patch(
        '/auth/preferences',
        json={
            'theme': 'dark',
            'language': 'en',
            'timezone': 'UTC',
            'notification_email_enabled': True,
        },
    )
    assert updated_preferences.status_code == 200
    assert updated_preferences.get_json()['preferences']['theme'] == 'dark'
