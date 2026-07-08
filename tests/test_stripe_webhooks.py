from datetime import datetime, timedelta

import app.routes.stripe_webhooks as stripe_webhooks
from app import create_app, db
from app.config import Config
from app.models import BillingTransaction, Subscription, User, UserRole
from werkzeug.security import generate_password_hash


def _create_user(email='stripe.user@example.com'):
    user = User(
        email=email,
        password=generate_password_hash('Password123!', method='pbkdf2:sha256'),
        first_name='Stripe',
        last_name='User',
        phone_number='0000000000',
        role=UserRole.USER,
        is_active=True,
        email_verified_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()
    return user


def test_stripe_webhook_invalid_signature_triggers_alert(monkeypatch):
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(
        TESTING=True,
        MAIL_SUPPRESS_SEND=True,
        STRIPE_WEBHOOK_SECRET='whsec_test',
        ENABLE_PRODUCTION_ALERTS=True,
        WEBHOOK_FAILURE_ALERT_THRESHOLD=1,
    )

    with app.app_context():
        db.drop_all()
        db.create_all()

    alerts = []
    monkeypatch.setattr(stripe_webhooks, 'emit_operational_alert', lambda **kwargs: alerts.append(kwargs))
    monkeypatch.setattr(stripe_webhooks, 'alerts_enabled', lambda _app: True)
    monkeypatch.setattr(stripe_webhooks.stripe.Webhook, 'construct_event', lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError('bad signature')))
    stripe_webhooks._webhook_failures.clear()

    with app.test_client() as client:
        response = client.post('/webhook/stripe', data=b'{}', headers={'Stripe-Signature': 'invalid'})

    assert response.status_code == 400
    assert alerts
    assert alerts[-1]['category'] == 'stripe_webhook_failure'



def test_checkout_completed_webhook_is_idempotent(monkeypatch):
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(TESTING=True, MAIL_SUPPRESS_SEND=True, STRIPE_WEBHOOK_SECRET='whsec_test')

    with app.app_context():
        db.drop_all()
        db.create_all()
        user = _create_user()
        user_id = user.id

    period_end = int((datetime.utcnow() + timedelta(days=30)).timestamp())

    event = {
        'type': 'checkout.session.completed',
        'data': {
            'object': {
                'id': 'cs_test_123',
                'metadata': {'user_id': str(user_id), 'tier': 'premium_individual', 'trial_days': '14'},
                'amount_total': 9900,
                'currency': 'eur',
                'payment_intent': 'pi_test_123',
                'subscription': 'sub_test_123',
                'customer': 'cus_test_123',
            }
        },
    }

    monkeypatch.setattr(stripe_webhooks.stripe.Webhook, 'construct_event', lambda *_args, **_kwargs: event)
    monkeypatch.setattr(stripe_webhooks.stripe.Subscription, 'retrieve', lambda *_args, **_kwargs: {'id': 'sub_test_123', 'current_period_end': period_end})

    with app.test_client() as client:
        first = client.post('/webhook/stripe', data=b'{}', headers={'Stripe-Signature': 'valid'})
        second = client.post('/webhook/stripe', data=b'{}', headers={'Stripe-Signature': 'valid'})

    assert first.status_code == 200
    assert second.status_code == 200

    with app.app_context():
        subscriptions = Subscription.query.filter_by(user_id=user_id).all()
        transactions = BillingTransaction.query.filter_by(user_id=user_id).all()
        assert len(subscriptions) == 1
        assert len(transactions) == 1
        assert transactions[0].provider_txn_id == 'pi_test_123'
