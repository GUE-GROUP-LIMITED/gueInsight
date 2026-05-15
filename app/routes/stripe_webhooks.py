from flask import Blueprint, request, current_app, jsonify
import stripe
from app.models import Subscription, User, BillingTransaction, BillingStatus, db, SecurityEvent
from datetime import datetime, timedelta

stripe_bp = Blueprint('stripe', __name__)

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
            return jsonify({'error': 'invalid signature'}), 400
    else:
        try:
            event = request.get_json()
        except Exception:
            return jsonify({'error': 'invalid payload'}), 400

    # Handle checkout.session.completed
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata') or {}
        user_id = metadata.get('user_id')
        tier = metadata.get('tier')

        # Create subscription record and billing transaction
        try:
            # create or update subscription
            user = User.query.get(user_id)
            if user:
                # Create subscription with 30-day period (example)
                start = datetime.utcnow()
                end = start + timedelta(days=30)
                subscription = Subscription(user_id=user.id, plan=tier, start_date=start, end_date=end)
                db.session.add(subscription)
                # Billing transaction
                txn = BillingTransaction(user_id=user.id, subscription=subscription, provider='stripe', provider_txn_id=session.get('payment_intent'), amount_minor=session.get('amount_total', 0), currency=session.get('currency', 'eur'), status=BillingStatus.SUCCEEDED)
                db.session.add(txn)
                db.session.commit()

                # log security event
                se = SecurityEvent(user_id=user.id, event_type='subscription_created', severity='info', details=f"Subscription to {tier} created via Stripe checkout session {session.get('id')}")
                db.session.add(se)
                db.session.commit()
        except Exception:
            current_app.logger.exception('Failed to persist stripe checkout subscription')

    return jsonify({'status': 'received'}), 200
