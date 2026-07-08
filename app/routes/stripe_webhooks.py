from flask import Blueprint, request, current_app, jsonify
import stripe
from app.models import Subscription, User, BillingTransaction, BillingStatus, db, SecurityEvent
from datetime import datetime, timedelta
from collections import deque
from time import time

from app.notifications.production_alerts import alerts_enabled, emit_operational_alert

stripe_bp = Blueprint('stripe', __name__)
_webhook_failures = deque(maxlen=2048)


def _record_webhook_failure(reason, details=None):
    now = int(time())
    window_seconds = 600
    min_allowed = now - window_seconds

    while _webhook_failures and _webhook_failures[0] < min_allowed:
        _webhook_failures.popleft()
    _webhook_failures.append(now)

    threshold = int(current_app.config.get('WEBHOOK_FAILURE_ALERT_THRESHOLD', 2))
    if len(_webhook_failures) >= threshold and alerts_enabled(current_app):
        emit_operational_alert(
            category='stripe_webhook_failure',
            message=f"{len(_webhook_failures)} Stripe webhook failures in {window_seconds // 60} minutes.",
            details={'reason': reason, 'details': details, 'threshold': threshold},
            min_interval_seconds=300,
        )

@stripe_bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET')

    if endpoint_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except Exception as e:
            current_app.logger.exception('Stripe webhook signature verification failed')
            _record_webhook_failure('invalid_signature', {'error': str(e)})
            return jsonify({'error': 'invalid signature'}), 400
    else:
        try:
            event = request.get_json()
        except Exception:
            _record_webhook_failure('invalid_payload')
            return jsonify({'error': 'invalid payload'}), 400

    # Handle checkout.session.completed
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata') or {}
        user_id = metadata.get('user_id')
        tier = metadata.get('tier')
        trial_days = int(metadata.get('trial_days') or 14)

        # Create subscription record and billing transaction
        try:
            # create or update subscription
            user = User.query.get(user_id)
            if user:
                stripe_subscription = None
                if session.get('subscription'):
                    try:
                        stripe_subscription = stripe.Subscription.retrieve(session.get('subscription'))
                    except Exception:
                        current_app.logger.exception('Failed to retrieve Stripe subscription for trial checkout')
                
                # Store customer ID on user for future transactions
                customer_id = session.get('customer')
                if customer_id and not user.stripe_customer_id:
                    user.stripe_customer_id = customer_id
                    db.session.add(user)
                    db.session.commit()
                    current_app.logger.info(f"Stored Stripe customer ID for user {user.id}: {customer_id}")
                
                # Idempotency: skip if we already processed this payment or session
                session_id = session.get('id')
                payment_intent = session.get('payment_intent')
                existing_txn = None
                if payment_intent:
                    existing_txn = BillingTransaction.query.filter_by(provider='stripe', provider_txn_id=payment_intent).first()
                if not existing_txn and session_id:
                    existing_txn = BillingTransaction.query.filter_by(provider='stripe', provider_txn_id=session_id).first()

                if existing_txn:
                    current_app.logger.info(f"Skipping duplicate webhook processing for session {session_id}")
                else:
                    start = datetime.utcnow()
                    active_subscriptions = (
                        Subscription.query
                        .filter(
                            Subscription.user_id == user.id,
                            Subscription.end_date != None,
                            Subscription.end_date > start,
                        )
                        .all()
                    )
                    for active_subscription in active_subscriptions:
                        active_subscription.end_date = start
                        db.session.add(active_subscription)

                    end = None
                    if stripe_subscription and stripe_subscription.get('current_period_end'):
                        end = datetime.utcfromtimestamp(stripe_subscription['current_period_end'])
                    elif stripe_subscription and stripe_subscription.get('trial_end'):
                        end = datetime.utcfromtimestamp(stripe_subscription['trial_end']) + timedelta(days=30)
                    else:
                        end = start + timedelta(days=trial_days + 30)

                    subscription = Subscription(user_id=user.id, plan=tier, start_date=start, end_date=end)
                    try:
                        subscription.is_trial = (trial_days and int(trial_days) > 0)
                    except Exception:
                        subscription.is_trial = False
                    
                    # Store Stripe subscription info for recurring billing
                    if stripe_subscription:
                        subscription.stripe_subscription_id = stripe_subscription.get('id')
                        subscription.stripe_customer_id = customer_id
                        current_app.logger.info(f"Stored Stripe subscription ID for user {user.id}: {stripe_subscription.get('id')}")
                    
                    db.session.add(subscription)

                    # Billing transaction: save session id or payment_intent as provider_txn_id to help idempotency
                    provider_txn_id = payment_intent or session_id
                    txn = BillingTransaction(user_id=user.id, subscription=subscription, provider='stripe', provider_txn_id=provider_txn_id, amount_minor=session.get('amount_total', 0), currency=session.get('currency', 'eur'), status=BillingStatus.SUCCEEDED)
                    db.session.add(txn)
                    db.session.commit()

                    receipt_url = f'/auth/billing/{txn.id}/receipt'

                    try:
                        from app.routes import users_routes as ur
                        ur._create_user_notification(
                            user.id,
                            'billing',
                            'Subscription confirmed',
                            f'Your {tier} subscription is active. Receipt #{txn.id:06d} is available in billing.',
                            severity='info',
                            action_url=receipt_url,
                        )
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
                        current_app.logger.exception('Failed to create billing notification after Stripe checkout')

                    try:
                        from app.routes.users_billing_routes import _send_upgrade_receipt_email
                        from app.subscription_service import COMPLIANCE_TIERS
                        tier_config = COMPLIANCE_TIERS.get(tier, {'name': tier})
                        _send_upgrade_receipt_email(
                            user,
                            txn,
                            tier,
                            tier_config,
                            user.current_plan or 'free',
                        )
                    except Exception:
                        current_app.logger.exception('Failed to send billing receipt email after Stripe checkout')

                    # log security event
                    se = SecurityEvent(user_id=user.id, event_type='subscription_created', severity='info', details=f"Subscription to {tier} created via Stripe checkout session {session.get('id')}")
                    db.session.add(se)
                    db.session.commit()
        except Exception:
            current_app.logger.exception('Failed to persist stripe checkout subscription')
            _record_webhook_failure('subscription_persistence_failed', {'event_type': event.get('type')})

    return jsonify({'status': 'received'}), 200
