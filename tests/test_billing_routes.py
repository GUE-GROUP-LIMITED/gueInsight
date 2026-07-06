from datetime import datetime, timedelta

from app import create_app, db
from app.config import Config
from app.models import (
    BillingTransaction, User, UserRole, Subscription, UserNotification,
    AnalysisTransaction, UserActivityEvent, BillingStatus, NotificationSeverity,
)
from app.routes import users_routes as ur
from werkzeug.security import generate_password_hash
import pytest


@pytest.fixture()
def client():
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True)

    with app.app_context():
        db.drop_all()
        db.create_all()
        ur._LOGIN_RATE_CACHE.clear()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def _create_user(email='billing@example.com'):
    user = User(
        email=email,
        password=generate_password_hash('Password123!', method='pbkdf2:sha256'),
        first_name='Billing',
        last_name='User',
        phone_number='0000000000',
        role=UserRole.USER,
        is_active=True,
        email_verified_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()
    return user


def _login(client, email='billing@example.com', password='Password123!'):
    return client.post('/auth/login', json={'email': email, 'password': password})


def test_notifications_endpoint_empty(client):
    user = _create_user()
    _login(client)

    response = client.get('/auth/notifications')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['notifications'] == []
    assert payload['unread_count'] == 0


def test_notifications_with_unread_filtering(client):
    user = _create_user()
    db.session.add(UserNotification(user_id=user.id, type='system', title='A', message='First', severity=NotificationSeverity.INFO, is_read=False))
    db.session.add(UserNotification(user_id=user.id, type='system', title='B', message='Second', severity=NotificationSeverity.WARNING, is_read=True))
    db.session.commit()

    _login(client)

    all_response = client.get('/auth/notifications')
    assert all_response.status_code == 200
    assert len(all_response.get_json()['notifications']) == 2
    assert all_response.get_json()['unread_count'] == 1

    unread_response = client.get('/auth/notifications?unread_only=true')
    assert unread_response.status_code == 200
    assert len(unread_response.get_json()['notifications']) == 1
    assert unread_response.get_json()['unread_count'] == 1


def test_notifications_limit_clamping(client):
    user = _create_user()
    for i in range(30):
        db.session.add(UserNotification(user_id=user.id, type='system', title=f'N{i}', message=f'Msg {i}', severity=NotificationSeverity.INFO))
    db.session.commit()

    _login(client)

    # Default limit is 25
    default_response = client.get('/auth/notifications')
    assert default_response.status_code == 200
    assert len(default_response.get_json()['notifications']) == 25

    # Requesting limit > 100 gets clamped to 100, so returns all 30
    unlimited = client.get('/auth/notifications?limit=1000')
    assert unlimited.status_code == 200
    assert len(unlimited.get_json()['notifications']) == 30

    # Requesting limit = 0 gets clamped to minimum of 1
    low_limit = client.get('/auth/notifications?limit=0')
    assert low_limit.status_code == 200
    assert len(low_limit.get_json()['notifications']) == 1


def test_mark_notification_as_read_success(client):
    user = _create_user()
    notif = UserNotification(user_id=user.id, type='system', title='Unread', message='Test', severity=NotificationSeverity.INFO, is_read=False)
    db.session.add(notif)
    db.session.commit()

    _login(client)

    response = client.patch(f'/auth/notifications/{notif.id}/read')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['notification']['is_read'] is True
    assert payload['unread_count'] == 0


def test_mark_notification_as_read_not_found(client):
    _create_user()
    _login(client)

    response = client.patch('/auth/notifications/9999/read')
    assert response.status_code == 404


def test_mark_notification_as_read_cross_user_access_denied(client):
    user1 = _create_user(email='user1@example.com')
    user2 = _create_user(email='user2@example.com')

    notif = UserNotification(user_id=user2.id, type='system', title='Other', message='Test', severity=NotificationSeverity.INFO)
    db.session.add(notif)
    db.session.commit()

    _login(client, email='user1@example.com')
    response = client.patch(f'/auth/notifications/{notif.id}/read')
    assert response.status_code == 404


def test_mark_all_notifications_as_read(client):
    user = _create_user()
    for i in range(3):
        db.session.add(UserNotification(user_id=user.id, type='system', title=f'N{i}', message=f'Msg {i}', severity=NotificationSeverity.INFO, is_read=False))
    db.session.commit()

    _login(client)

    pre_response = client.get('/auth/notifications')
    assert pre_response.get_json()['unread_count'] == 3

    mark_response = client.post('/auth/notifications/read_all')
    assert mark_response.status_code == 200
    assert mark_response.get_json()['unread_count'] == 0

    post_response = client.get('/auth/notifications')
    assert post_response.get_json()['unread_count'] == 0


def test_transactions_aggregation(client):
    user = _create_user()
    db.session.add(AnalysisTransaction(user_id=user.id, source_type='file', input_ref='abc123'))
    db.session.add(UserActivityEvent(user_id=user.id, event_type='test_event', description='Test event'))
    db.session.add(BillingTransaction(user_id=user.id, amount_minor=9999, currency='USD', status=BillingStatus.SUCCEEDED))
    db.session.commit()

    _login(client)

    response = client.get('/auth/transactions')
    assert response.status_code == 200
    payload = response.get_json()
    assert 'analysis_transactions' in payload
    assert 'activity_events' in payload
    assert 'billing_transactions' in payload
    assert len(payload['analysis_transactions']) == 1
    assert len(payload['activity_events']) == 1
    assert len(payload['billing_transactions']) == 1


def test_transactions_limit_clamping(client):
    user = _create_user()
    for i in range(50):
        db.session.add(BillingTransaction(user_id=user.id, amount_minor=i * 100, currency='USD', status=BillingStatus.SUCCEEDED))
    db.session.commit()

    _login(client)

    # Default limit is 20
    default_response = client.get('/auth/transactions')
    assert default_response.status_code == 200
    assert len(default_response.get_json()['billing_transactions']) == 20

    # Requesting limit > 100 gets clamped to 100, so returns all 50
    unlimited = client.get('/auth/transactions?limit=1000')
    assert unlimited.status_code == 200
    assert len(unlimited.get_json()['billing_transactions']) == 50

    # Requesting custom limit
    custom_limit = client.get('/auth/transactions?limit=10')
    assert custom_limit.status_code == 200
    assert len(custom_limit.get_json()['billing_transactions']) == 10


def test_billing_receipt_not_found(client):
    user = _create_user()
    with client.session_transaction() as session:
        session['_user_id'] = str(user.id)
        session['_fresh'] = True

    response = client.get('/auth/billing/9999/receipt')
    assert response.status_code == 404


def test_billing_receipt_html_generation(client):
    user = _create_user()
    now = datetime.utcnow()
    txn = BillingTransaction(
        user_id=user.id,
        amount_minor=9999,
        currency='USD',
        status=BillingStatus.SUCCEEDED,
        created_at=now,
        period_start=now,
        period_end=now + timedelta(days=30),
    )
    db.session.add(txn)
    db.session.commit()

    _login(client)

    response = client.get(f'/auth/billing/{txn.id}/receipt')
    assert response.status_code == 200
    assert response.headers['Content-Type'].startswith('text/html')
    html_content = response.get_data(as_text=True)
    assert 'Receipt' in html_content
    assert '99.99' in html_content


def test_billing_receipt_cross_user_access_denied(client):
    user1 = _create_user(email='user1@example.com')
    user2 = _create_user(email='user2@example.com')

    txn = BillingTransaction(user_id=user2.id, amount_minor=5000, currency='USD', status=BillingStatus.SUCCEEDED)
    db.session.add(txn)
    db.session.commit()

    _login(client, email='user1@example.com')
    response = client.get(f'/auth/billing/{txn.id}/receipt')
    assert response.status_code == 404


def test_subscription_upgrade_validation(client):
    user = _create_user()
    _login(client)

    invalid_plan = client.post('/auth/subscription/upgrade', json={'plan': 'nonexistent_plan'})
    assert invalid_plan.status_code == 400
    assert 'Invalid plan' in invalid_plan.get_json()['error']


def test_subscription_upgrade_success(client):
    user = _create_user()
    _login(client)

    response = client.post('/auth/subscription/upgrade', json={'plan': 'premium_individual'})
    assert response.status_code == 200
    assert response.get_json()['message'] == 'Subscription created'

    subscription = Subscription.query.filter_by(user_id=user.id).first()
    assert subscription is not None
    assert subscription.plan == 'premium_individual'


def test_subscription_upgrade_already_on_plan(client):
    user = _create_user()
    now = datetime.utcnow()
    active_subscription = Subscription(
        user_id=user.id,
        plan='premium_individual',
        start_date=now,
        end_date=now + timedelta(days=30),
    )
    db.session.add(active_subscription)
    db.session.commit()

    _login(client)

    response = client.post('/auth/subscription/upgrade', json={'plan': 'premium_individual'})
    assert response.status_code == 400
    assert 'already on this active plan' in response.get_json()['error']


def test_billing_receipt_raw_not_found(client):
    _create_user()
    _login(client)

    response = client.get('/auth/billing/receipt/raw/9999')
    assert response.status_code == 404


def test_billing_receipt_raw_html_generation(client):
    user = _create_user()
    now = datetime.utcnow()
    txn = BillingTransaction(
        user_id=user.id,
        amount_minor=5000,
        currency='USD',
        status=BillingStatus.SUCCEEDED,
        created_at=now,
        period_start=now,
        period_end=now + timedelta(days=30),
    )
    db.session.add(txn)
    db.session.commit()

    _login(client)

    response = client.get(f'/auth/billing/receipt/raw/{txn.id}')
    assert response.status_code == 200
    assert response.headers['Content-Type'].startswith('text/html')
    html_content = response.get_data(as_text=True)
    assert 'Receipt' in html_content
    assert '50.00' in html_content


def test_subscription_upgrade_with_plan_aliases(client):
    _create_user()
    _login(client)

    aliases = ['starter', 'growth', 'scale', 'premium']
    for alias in aliases:
        response = client.post('/auth/subscription/upgrade', json={'plan': alias})
        assert response.status_code == 200
        assert response.get_json()['message'] == 'Subscription created'


def test_subscription_upgrade_nonprod_stripe_error_falls_back(client, monkeypatch):
    import stripe

    def _raise_stripe_error(*args, **kwargs):
        raise Exception('Invalid API Key provided: sk_test_invalid')

    monkeypatch.setattr(stripe.Customer, 'create', _raise_stripe_error)

    user = _create_user(email='nonprod-fallback@example.com')
    _login(client, email='nonprod-fallback@example.com')

    client.application.config.update(
        TESTING=False,
        IS_PRODUCTION=False,
        ALLOW_NONPROD_BILLING_FALLBACK=True,
        STRIPE_SECRET_KEY='sk_test_invalid',
    )

    response = client.post('/auth/subscription/upgrade', json={'plan': 'premium_individual'})
    assert response.status_code == 200
    assert response.get_json()['message'] == 'Subscription created'

    subscription = Subscription.query.filter_by(user_id=user.id).order_by(Subscription.end_date.desc()).first()
    assert subscription is not None
    assert subscription.plan in {'premium_individual', 'compliance_pro'}


def test_subscription_upgrade_production_stripe_error_is_strict(client, monkeypatch):
    import stripe

    def _raise_stripe_error(*args, **kwargs):
        raise Exception('Invalid API Key provided: sk_test_invalid')

    monkeypatch.setattr(stripe.Customer, 'create', _raise_stripe_error)

    _create_user(email='prod-strict@example.com')
    _login(client, email='prod-strict@example.com')

    client.application.config.update(
        TESTING=False,
        IS_PRODUCTION=True,
        ALLOW_NONPROD_BILLING_FALLBACK=False,
        STRIPE_SECRET_KEY='sk_test_invalid',
    )

    response = client.post('/auth/subscription/upgrade', json={'plan': 'premium_individual'})
    assert response.status_code == 500
    assert 'Failed to initiate checkout' in response.get_json()['error']
