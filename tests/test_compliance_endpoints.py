import pytest
from datetime import datetime, timedelta
from flask_login import LoginManager
from werkzeug.security import generate_password_hash
from types import SimpleNamespace

from app import create_app, db
from app.config import Config
from app.models import DataDeletionRequest, SecurityEvent, User, UserRole, AlertRule, Subscription, VcisoUpdate
import app.routes.users_support_routes as users_support_routes
import app.routes.users_routes as users_routes


@pytest.fixture()
def client():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True)

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
        email_verified_at=datetime.utcnow() if is_active else None,
    )
    db.session.add(user)
    db.session.commit()
    return user


def _login(client, email='user@example.com', password='Password123!'):
    return client.post('/auth/login', json={'email': email, 'password': password})


def _set_subscription(user_id, plan='free', days=30):
    now = datetime.utcnow()
    subscription = Subscription(
        user_id=user_id,
        plan=plan,
        start_date=now,
        end_date=now + timedelta(days=days),
    )
    db.session.add(subscription)
    db.session.commit()
    return subscription


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
            'country_of_residence': 'Belgium',
            'address': 'Rue de Test 1',
            'city': 'Brussels',
            'postal_code': '1000',
            'agree_to_terms': True,
            'gdpr_consent': True,
            'newsletter': True,
        },
    )
    assert valid_response.status_code == 201
    payload = valid_response.get_json()
    assert payload['user']['gdpr_consent_at'] is not None
    assert payload['user']['current_plan'] == 'Free'

    created_user = User.query.filter_by(email='with-consent@example.com').first()
    assert created_user is not None
    created_subscription = (
        Subscription.query
        .filter_by(user_id=created_user.id)
        .order_by(Subscription.end_date.desc())
        .first()
    )
    assert created_subscription is not None
    assert created_subscription.plan == 'free'


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


def test_admin_can_invite_and_activate_admin_account(client):
    _create_user(email='inviter-admin@example.com', role=UserRole.ADMIN)
    login_response = _login(client, email='inviter-admin@example.com')
    assert login_response.status_code == 200

    invite_response = client.post(
        '/api/admin/invitations',
        json={
            'email': 'new-staff-admin@example.com',
            'first_name': 'New',
            'last_name': 'Staff',
            'phone_number': '1111111111',
            'admin_role': 'billing_admin',
            'permissions': ['billing:manage', 'reports:view_all', 'users:invite', 'users:activate', 'audit:read'],
        },
    )
    assert invite_response.status_code == 201
    invite_payload = invite_response.get_json()
    assert 'activation_link' in invite_payload
    assert invite_payload['invited_user']['is_active'] is False

    activation_link = invite_payload['activation_link']
    token = activation_link.split('token=', 1)[1]

    accept_response = client.post(
        '/auth/admin-invite/accept',
        json={
            'token': token,
            'password': 'Aaaaaaaa11',
            'first_name': 'Activated',
            'last_name': 'Admin',
        },
    )
    assert accept_response.status_code == 200
    accept_payload = accept_response.get_json()
    assert accept_payload['user']['is_active'] is True
    assert accept_payload['user']['invitation_accepted_at'] is not None

    activated_user = User.query.filter_by(email='new-staff-admin@example.com').first()
    assert activated_user is not None
    assert activated_user.email_verified_at is not None


def test_admin_can_update_admin_role_and_permissions(client):
    _create_user(email='access-admin@example.com', role=UserRole.ADMIN)
    target_admin = _create_user(email='target-admin@example.com', role=UserRole.ADMIN)

    login_response = _login(client, email='access-admin@example.com')
    assert login_response.status_code == 200

    update_response = client.patch(
        f'/api/admin/users/{target_admin.id}/access',
        json={
            'admin_role': 'auditor',
            'permissions': ['audit:read', 'reports:view_all'],
        },
    )
    assert update_response.status_code == 200
    payload = update_response.get_json()
    assert payload['user']['admin_role'] == 'auditor'
    assert payload['user']['admin_permissions'] == ['audit:read', 'reports:view_all']


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


def test_admin_session_isolated_from_user_context(client):
    _create_user(email='isolated-admin@example.com', role=UserRole.ADMIN)

    admin_login = client.post(
        '/admin_login',
        json={'email': 'isolated-admin@example.com', 'password': 'Password123!'},
    )
    assert admin_login.status_code == 200

    default_session = client.get('/auth/session')
    assert default_session.status_code == 200
    assert default_session.get_json()['authenticated'] is False

    user_context_session = client.get('/auth/session', headers={'X-Auth-Context': 'user'})
    assert user_context_session.status_code == 200
    assert user_context_session.get_json()['authenticated'] is False

    admin_context_session = client.get('/auth/session', headers={'X-Auth-Context': 'admin'})
    assert admin_context_session.status_code == 200
    payload = admin_context_session.get_json()
    assert payload['authenticated'] is True
    assert payload['user']['email'] == 'isolated-admin@example.com'


def test_admin_login_replaces_existing_user_session(client):
    _create_user(email='signed-in-user@example.com')
    _create_user(email='switch-admin@example.com', role=UserRole.ADMIN)

    user_login = _login(client, email='signed-in-user@example.com')
    assert user_login.status_code == 200

    admin_login = client.post(
        '/admin_login',
        json={'email': 'switch-admin@example.com', 'password': 'Password123!'},
    )
    assert admin_login.status_code == 200

    default_session = client.get('/auth/session')
    assert default_session.status_code == 200
    assert default_session.get_json()['authenticated'] is False

    admin_context_session = client.get('/auth/session', headers={'X-Auth-Context': 'admin'})
    assert admin_context_session.status_code == 200
    payload = admin_context_session.get_json()
    assert payload['authenticated'] is True
    assert payload['user']['email'] == 'switch-admin@example.com'


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


def test_free_user_can_start_paid_trial_checkout_session(client):
    user = _create_user(email='trialstarter@example.com')
    _set_subscription(user.id, plan='free', days=3650)

    login_response = _login(client, email='trialstarter@example.com')
    assert login_response.status_code == 200

    response = client.post('/checkout/create-session', json={'tier_id': 'starter', 'trial_days': 14})
    assert response.status_code == 200
    payload = response.get_json()
    assert 'checkout_url' in payload

    latest_subscription = (
        Subscription.query
        .filter_by(user_id=user.id)
        .order_by(Subscription.end_date.desc())
        .first()
    )
    assert latest_subscription.plan == 'starter'
    assert latest_subscription.is_trial is True


def test_checkout_uses_stripe_secret_key_fallback_when_api_key_missing(client):
    user = _create_user(email='stripe-secret-fallback@example.com')
    _set_subscription(user.id, plan='free', days=3650)

    login_response = _login(client, email='stripe-secret-fallback@example.com')
    assert login_response.status_code == 200

    app = client.application
    app.config['TESTING'] = False
    app.config['STRIPE_API_KEY'] = ''
    app.config['STRIPE_SECRET_KEY'] = 'stripe_secret_fallback_placeholder'

    original_customer_create = users_routes.stripe.Customer.create
    original_checkout = users_routes.stripe.checkout

    def _fake_customer_create(**kwargs):
        return SimpleNamespace(id='cus_test_123')

    def _fake_session_create(**kwargs):
        return SimpleNamespace(url='https://checkout.stripe.test/session_123')

    users_routes.stripe.Customer.create = _fake_customer_create
    users_routes.stripe.checkout = SimpleNamespace(
        Session=SimpleNamespace(create=_fake_session_create)
    )

    try:
        response = client.post('/checkout/create-session', json={'tier_id': 'starter', 'trial_days': 14})
        assert response.status_code == 200
        payload = response.get_json()
        assert payload['checkout_url'] == 'https://checkout.stripe.test/session_123'
        assert users_routes.stripe.api_key == 'stripe_secret_fallback_placeholder'
    finally:
        users_routes.stripe.Customer.create = original_customer_create
        users_routes.stripe.checkout = original_checkout
        app.config['TESTING'] = True


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

    sent_emails = []

    def _capture_send_email(*args, **kwargs):
        sent_emails.append({'args': args, 'kwargs': kwargs})
        return {'status': 'captured'}

    original_send_email = users_support_routes.send_email
    users_support_routes.send_email = _capture_send_email

    try:
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

        assert len(sent_emails) == 2
        assert sent_emails[0]['args'][0] == 'tickets@example.com'
        assert sent_emails[0]['kwargs']['sender_profile'] == 'support'
        assert sent_emails[1]['kwargs']['sender_profile'] == 'support'
    finally:
        users_support_routes.send_email = original_send_email


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


def test_dashboard_compliance_locked_for_free_plan(client):
    user = _create_user(email='free-dashboard@example.com')
    _login(client, email='free-dashboard@example.com')

    response = client.get('/auth/dashboard/compliance')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['access_level'] == 'locked'
    assert payload['tier'] == 'free'


def test_user_security_events_requires_enterprise_plan(client):
    _create_user(email='events-free@example.com')
    _login(client, email='events-free@example.com')

    response = client.get('/auth/security_events')
    assert response.status_code == 403


def test_enterprise_only_endpoints_require_active_enterprise_subscription(client):
    user = _create_user(email='expired-enterprise@example.com')
    _set_subscription(user.id, plan='enterprise_risk', days=-1)
    _login(client, email='expired-enterprise@example.com')

    sub_users_response = client.get('/auth/sub-users')
    assert sub_users_response.status_code == 403
    assert 'Enterprise plan required' in sub_users_response.get_json()['error']

    analytics_response = client.get('/auth/analytics/summary')
    assert analytics_response.status_code == 403
    assert 'Compliance plan required' in analytics_response.get_json()['error']


def test_user_security_events_returns_user_and_global_for_enterprise(client):
    enterprise_user = _create_user(email='events-enterprise@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_risk')

    other_user = _create_user(email='events-other@example.com')
    _set_subscription(other_user.id, plan='enterprise_risk')

    db.session.add(SecurityEvent(user_id=None, event_type='global.notice', severity='info', details='Global incident signal'))
    db.session.add(SecurityEvent(user_id=enterprise_user.id, event_type='user.incident', severity='high', details='User-specific event'))
    db.session.add(SecurityEvent(user_id=other_user.id, event_type='other.incident', severity='critical', details='Should be filtered out'))
    db.session.commit()

    _login(client, email='events-enterprise@example.com')
    response = client.get('/auth/security_events?limit=20')

    assert response.status_code == 200
    payload = response.get_json()
    event_types = [item['event_type'] for item in payload['security_events']]
    assert 'global.notice' in event_types
    assert 'user.incident' in event_types
    assert 'other.incident' not in event_types


def test_vciso_notes_requires_enterprise_elite_plan(client):
    _create_user(email='vciso-basic@example.com')
    _login(client, email='vciso-basic@example.com')

    response = client.get('/api/vciso/notes')
    assert response.status_code == 403
    assert 'Enterprise Elite' in response.get_json()['error']


def test_vciso_notes_returns_global_and_targeted_updates_for_elite(client):
    admin = _create_user(email='vciso-admin@example.com', role=UserRole.ADMIN)
    elite_user = _create_user(email='vciso-elite@example.com')
    other_user = _create_user(email='vciso-other@example.com')

    _set_subscription(elite_user.id, plan='enterprise_elite', days=30)

    db.session.add(
        VcisoUpdate(
            user_id=None,
            title='Global advisory',
            note='Applies to all enterprise users.',
            action_items='Rotate keys',
            author_name='Security Team',
            created_by_admin_id=admin.id,
            is_active=True,
        )
    )
    db.session.add(
        VcisoUpdate(
            user_id=elite_user.id,
            title='Targeted advisory',
            note='Applies to elite user only.',
            action_items='Enable MFA',
            author_name='Security Team',
            created_by_admin_id=admin.id,
            is_active=True,
        )
    )
    db.session.add(
        VcisoUpdate(
            user_id=other_user.id,
            title='Other user advisory',
            note='Should not be visible.',
            action_items='N/A',
            author_name='Security Team',
            created_by_admin_id=admin.id,
            is_active=True,
        )
    )
    db.session.add(
        VcisoUpdate(
            user_id=None,
            title='Inactive advisory',
            note='Should not be visible.',
            action_items='N/A',
            author_name='Security Team',
            created_by_admin_id=admin.id,
            is_active=False,
        )
    )
    db.session.commit()

    _login(client, email='vciso-elite@example.com')
    response = client.get('/api/vciso/notes')

    assert response.status_code == 200
    payload = response.get_json()
    titles = [item['title'] for item in payload['notes']]
    assert 'Global advisory' in titles
    assert 'Targeted advisory' in titles
    assert 'Other user advisory' not in titles
    assert 'Inactive advisory' not in titles


def test_vciso_note_post_is_admin_only_and_validates_required_fields(client):
    _create_user(email='vciso-user@example.com')
    _create_user(email='vciso-admin2@example.com', role=UserRole.ADMIN)

    _login(client, email='vciso-user@example.com')
    forbidden = client.post(
        '/api/vciso/notes',
        json={
            'target_user_id': 1,
            'type': 'advisory',
            'priority': 'high',
            'title': 'Test',
            'body': 'Body',
        },
    )
    assert forbidden.status_code == 403

    _login(client, email='vciso-admin2@example.com')
    bad_payload = client.post('/api/vciso/notes', json={'title': 'Missing fields'})
    assert bad_payload.status_code == 400
    assert 'Missing required fields' in bad_payload.get_json()['error']

    created = client.post(
        '/api/vciso/notes',
        json={
            'target_user_id': 1,
            'type': 'advisory',
            'priority': 'high',
            'title': 'Security advisory',
            'body': 'Apply conditional access policy.',
        },
    )
    assert created.status_code == 201
    assert 'stub' in created.get_json()['message'].lower()


def test_dashboard_compliance_basic_for_compliance_plan(client):
    user = _create_user(email='compliance-pro@example.com')
    _set_subscription(user.id, plan='compliance_pro')
    _login(client, email='compliance-pro@example.com')

    response = client.get('/auth/dashboard/compliance')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['access_level'] == 'basic'
    assert payload['tier'] == 'compliance'
    assert isinstance(payload.get('gdpr_checklist'), list)


def test_compliance_intake_and_score_for_compliance_plan(client):
    user = _create_user(email='intake-score@example.com')
    _set_subscription(user.id, plan='compliance_pro')
    _login(client, email='intake-score@example.com')

    intake_response = client.post(
        '/auth/compliance/intake',
        json={
            'organization': {'legal_name': 'Example NV', 'country': 'BE'},
            'controls': [
                {'control_id': 'gdpr_32', 'status': 'implemented', 'evidence_url': 's3://evidence/1'},
                {'control_id': 'nis2_21a', 'status': 'partial'},
            ],
            'incidents': [
                {'classification': 'nis2_reportable', 'severity': 'high', 'reported_24h': True, 'reported_72h': False},
            ],
            'identities': {'mfa_enabled_percent': 94},
        },
    )
    assert intake_response.status_code == 201
    intake_payload = intake_response.get_json()
    assert intake_payload['summary']['controls_count'] == 2

    score_response = client.get('/auth/compliance/score')
    assert score_response.status_code == 200
    score_payload = score_response.get_json()
    assert 'overall_score' in score_payload
    assert score_payload['details']['required_controls'] == 2


def test_vciso_recommendations_require_enterprise_and_can_persist(client):
    non_enterprise_user = _create_user(email='vciso-rec-basic@example.com')
    _set_subscription(non_enterprise_user.id, plan='compliance_pro')
    _login(client, email='vciso-rec-basic@example.com')

    forbidden = client.post('/auth/vciso/recommendations', json={})
    assert forbidden.status_code == 403

    enterprise_user = _create_user(email='vciso-rec-enterprise@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_elite')
    _login(client, email='vciso-rec-enterprise@example.com')

    intake_response = client.post(
        '/auth/compliance/intake',
        json={
            'organization': {'legal_name': 'Enterprise Test Org', 'country': 'BE'},
            'controls': [
                {'control_id': 'gdpr_32', 'status': 'partial'},
                {'control_id': 'nis2_21a', 'status': 'partial'},
            ],
            'incidents': [
                {'classification': 'nis2_reportable', 'severity': 'critical', 'reported_24h': False, 'reported_72h': False},
            ],
            'identities': {'mfa_enabled_percent': 80},
        },
    )
    assert intake_response.status_code == 201

    rec_response = client.post('/auth/vciso/recommendations', json={'persist': True})
    assert rec_response.status_code == 200
    rec_payload = rec_response.get_json()
    assert rec_payload['tier'] == 'enterprise'
    assert len(rec_payload['recommendations']) >= 1
    assert rec_payload['persisted'] >= 1


def test_dashboard_vciso_locked_for_non_enterprise(client):
    user = _create_user(email='no-vciso@example.com')
    _set_subscription(user.id, plan='compliance_pro')
    _login(client, email='no-vciso@example.com')

    response = client.get('/auth/dashboard/vciso')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['access_level'] == 'locked'
    assert payload['updates'] == []


def test_dashboard_vciso_returns_global_and_targeted_updates(client):
    enterprise_user = _create_user(email='enterprise-client@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_risk')

    another_user = _create_user(email='another-client@example.com')
    _set_subscription(another_user.id, plan='enterprise_risk')

    global_update = VcisoUpdate(
        user_id=None,
        title='Global advisory',
        note='Apply baseline hardening controls.',
        action_items='Review endpoint policy',
        author_name='Gabriel Aloho',
        is_active=True,
    )
    targeted_update = VcisoUpdate(
        user_id=enterprise_user.id,
        title='Client-specific advisory',
        note='Reduce privileged standing access.',
        action_items='Rotate admin tokens',
        author_name='Gabriel Aloho',
        is_active=True,
    )
    other_target = VcisoUpdate(
        user_id=another_user.id,
        title='Other client update',
        note='This should not appear for first client.',
        action_items='N/A',
        author_name='Gabriel Aloho',
        is_active=True,
    )
    db.session.add_all([global_update, targeted_update, other_target])
    db.session.commit()

    _login(client, email='enterprise-client@example.com')
    response = client.get('/auth/dashboard/vciso')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['access_level'] == 'full'
    titles = [item['title'] for item in payload['updates']]
    assert 'Global advisory' in titles
    assert 'Client-specific advisory' in titles
    assert 'Other client update' not in titles


def test_admin_can_post_vciso_update_for_enterprise_user(client):
    _create_user(email='vciso-admin@example.com', role=UserRole.ADMIN)
    enterprise_user = _create_user(email='vciso-target@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_professional')

    _login(client, email='vciso-admin@example.com')

    response = client.post(
        '/api/admin/vciso',
        json={
            'target_user_id': enterprise_user.id,
            'title': 'Priority recommendation',
            'note': 'Harden privileged identity governance.',
            'action_items': ['Enable conditional access', 'Review MFA enforcement'],
        },
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['update']['title'] == 'Priority recommendation'
    created = VcisoUpdate.query.filter_by(user_id=enterprise_user.id, title='Priority recommendation').first()
    assert created is not None


def test_admin_vciso_update_rejects_non_enterprise_target(client):
    _create_user(email='vciso-admin2@example.com', role=UserRole.ADMIN)
    free_user = _create_user(email='free-target@example.com')
    _set_subscription(free_user.id, plan='compliance_pro')

    _login(client, email='vciso-admin2@example.com')

    response = client.post(
        '/api/admin/vciso',
        json={
            'target_user_id': free_user.id,
            'title': 'Should fail',
            'note': 'vCISO portal is enterprise only.',
        },
    )

    assert response.status_code == 400


def test_admin_can_list_vciso_updates_including_inactive(client):
    _create_user(email='vciso-admin3@example.com', role=UserRole.ADMIN)
    enterprise_user = _create_user(email='vciso-history-target@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_risk')

    active_update = VcisoUpdate(
        user_id=enterprise_user.id,
        title='Active advisory',
        note='Active note',
        action_items='Do thing A',
        author_name='Gabriel Aloho',
        is_active=True,
    )
    inactive_update = VcisoUpdate(
        user_id=None,
        title='Inactive advisory',
        note='Inactive note',
        action_items='Do thing B',
        author_name='Gabriel Aloho',
        is_active=False,
    )
    db.session.add_all([active_update, inactive_update])
    db.session.commit()

    _login(client, email='vciso-admin3@example.com')

    response_active_only = client.get('/api/admin/vciso')
    assert response_active_only.status_code == 200
    active_titles = [item['title'] for item in response_active_only.get_json()['updates']]
    assert 'Active advisory' in active_titles
    assert 'Inactive advisory' not in active_titles

    response_with_inactive = client.get('/api/admin/vciso?include_inactive=true')
    assert response_with_inactive.status_code == 200
    all_titles = [item['title'] for item in response_with_inactive.get_json()['updates']]
    assert 'Active advisory' in all_titles
    assert 'Inactive advisory' in all_titles

    response_inactive_only = client.get('/api/admin/vciso?status=inactive')
    assert response_inactive_only.status_code == 200
    inactive_titles = [item['title'] for item in response_inactive_only.get_json()['updates']]
    assert 'Inactive advisory' in inactive_titles
    assert 'Active advisory' not in inactive_titles

    response_global_scope = client.get('/api/admin/vciso?scope=all_enterprise&status=all')
    assert response_global_scope.status_code == 200
    global_titles = [item['title'] for item in response_global_scope.get_json()['updates']]
    assert 'Inactive advisory' in global_titles
    assert 'Active advisory' not in global_titles

    response_paged = client.get('/api/admin/vciso?status=all&limit=1&offset=1')
    assert response_paged.status_code == 200
    paged_payload = response_paged.get_json()
    assert paged_payload['limit'] == 1
    assert paged_payload['offset'] == 1
    assert paged_payload['total'] >= 2
    assert len(paged_payload['updates']) == 1


def test_admin_vciso_search_filters_by_title_and_author(client):
    _create_user(email='search-admin@example.com', role=UserRole.ADMIN)
    enterprise_user = _create_user(email='search-target@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_elite')

    db.session.add_all([
        VcisoUpdate(
            user_id=enterprise_user.id,
            title='Identity hardening review',
            note='Apply zero-trust principles.',
            author_name='Gabriel Aloho',
            is_active=True,
        ),
        VcisoUpdate(
            user_id=None,
            title='Patch management advisory',
            note='Reduce patch window to 72h.',
            author_name='Security Team',
            is_active=True,
        ),
    ])
    db.session.commit()

    _login(client, email='search-admin@example.com')

    title_search = client.get('/api/admin/vciso?status=all&q=identity')
    assert title_search.status_code == 200
    titles = [u['title'] for u in title_search.get_json()['updates']]
    assert any('Identity' in t for t in titles)
    assert all('Patch' not in t for t in titles)

    author_search = client.get('/api/admin/vciso?status=all&q=Security+Team')
    assert author_search.status_code == 200
    author_titles = [u['title'] for u in author_search.get_json()['updates']]
    assert any('Patch' in t for t in author_titles)
    assert all('Identity' not in t for t in author_titles)

    email_search = client.get('/api/admin/vciso?status=all&scope=single_client&q=search-target')
    assert email_search.status_code == 200
    email_results = email_search.get_json()['updates']
    assert len(email_results) >= 1
    assert all(u['scope'] == 'single_client' for u in email_results)

    empty_search = client.get('/api/admin/vciso?status=all&q=nonexistentxyz')
    assert empty_search.status_code == 200
    assert empty_search.get_json()['total'] == 0


def test_admin_can_edit_and_deactivate_vciso_update(client):
    _create_user(email='vciso-admin4@example.com', role=UserRole.ADMIN)
    enterprise_user = _create_user(email='vciso-edit-target@example.com')
    _set_subscription(enterprise_user.id, plan='enterprise_elite')

    update = VcisoUpdate(
        user_id=enterprise_user.id,
        title='Original title',
        note='Original note',
        action_items='Step one',
        author_name='Gabriel Aloho',
        is_active=True,
    )
    db.session.add(update)
    db.session.commit()

    _login(client, email='vciso-admin4@example.com')

    edit_response = client.patch(
        f'/api/admin/vciso/{update.id}',
        json={
            'title': 'Updated title',
            'note': 'Updated note',
            'action_items': ['Step one', 'Step two'],
            'author_name': 'Gabriel Aloho',
        },
    )
    assert edit_response.status_code == 200
    edited_payload = edit_response.get_json()['update']
    assert edited_payload['title'] == 'Updated title'
    assert 'Step two' in edited_payload['action_items']

    deactivate_response = client.patch(
        f'/api/admin/vciso/{update.id}',
        json={'is_active': False},
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.get_json()['update']['is_active'] is False


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
