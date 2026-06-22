"""
Stripe recurring billing handlers for automatic subscription renewals and invoice processing.
Handles:
- Automatic billing on subscription cycle completion
- Payment retry on failure
- Invoice tracking and logging
- Subscription status syncing
"""

from flask import Blueprint, request, current_app, jsonify
import stripe
from datetime import datetime, timedelta
from app.models import Subscription, User, BillingTransaction, BillingStatus, db, SecurityEvent
import logging

logger = logging.getLogger(__name__)

stripe_recurring_bp = Blueprint('stripe_recurring', __name__)


@stripe_recurring_bp.route('/webhook/stripe/invoice', methods=['POST'])
def stripe_invoice_webhook():
    """
    Handle Stripe invoice events for recurring billing.
    
    Events handled:
    - customer.invoice.created: Invoice generated for billing cycle
    - customer.invoice.finalized: Invoice is ready to pay
    - invoice.payment_succeeded: Payment successful on renewal
    - invoice.payment_failed: Payment failed (retry will happen via Stripe)
    - customer.subscription.updated: Subscription status changed
    - customer.subscription.deleted: Subscription cancelled
    """
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET')

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        else:
            event = request.get_json()
    except Exception as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        return jsonify({'error': 'invalid signature'}), 400

    event_type = event.get('type')
    logger.info(f"Processing Stripe event: {event_type}")

    try:
        # Handle successful payment on renewal
        if event_type == 'invoice.payment_succeeded':
            _handle_invoice_payment_succeeded(event)

        # Handle failed payment (retry will be automatic via Stripe)
        elif event_type == 'invoice.payment_failed':
            _handle_invoice_payment_failed(event)

        # Handle subscription updates
        elif event_type == 'customer.subscription.updated':
            _handle_subscription_updated(event)

        # Handle subscription cancellation
        elif event_type == 'customer.subscription.deleted':
            _handle_subscription_deleted(event)

        # Handle invoice finalized (ready to pay)
        elif event_type == 'invoice.finalized':
            _handle_invoice_finalized(event)

    except Exception as e:
        logger.exception(f"Error processing Stripe event {event_type}: {e}")

    return jsonify({'status': 'received'}), 200


def _handle_invoice_payment_succeeded(event):
    """
    Invoice payment successful - log the transaction and extend subscription.
    
    This is called when:
    1. Recurring subscription renews automatically
    2. Failed payment is retried successfully
    3. Manual payment is made
    """
    invoice = event.get('data', {}).get('object', {})
    invoice_id = invoice.get('id')
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    amount_paid = invoice.get('amount_paid', 0)
    currency = invoice.get('currency', 'eur').upper()
    
    logger.info(f"Processing successful invoice {invoice_id} for customer {customer_id}, amount: {amount_paid / 100:.2f} {currency}")

    # Find user by Stripe customer ID (stored in User model if available)
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if not user:
        logger.warning(f"User not found for Stripe customer {customer_id}")
        return

    # Check for duplicate processing
    existing_txn = BillingTransaction.query.filter_by(
        provider='stripe',
        provider_txn_id=invoice_id
    ).first()

    if existing_txn:
        logger.info(f"Invoice {invoice_id} already processed, skipping duplicate")
        return

    # Get current subscription
    subscription = Subscription.query.filter_by(
        user_id=user.id,
        plan=subscription_id  # Note: may need to store Stripe subscription ID
    ).order_by(Subscription.end_date.desc()).first()

    # Create billing transaction for the payment
    period_start = datetime.utcfromtimestamp(invoice.get('period_start', 0)) if invoice.get('period_start') else None
    period_end = datetime.utcfromtimestamp(invoice.get('period_end', 0)) if invoice.get('period_end') else None

    txn = BillingTransaction(
        user_id=user.id,
        subscription_id=subscription.id if subscription else None,
        provider='stripe',
        provider_txn_id=invoice_id,
        amount_minor=amount_paid,
        currency=currency.lower(),
        status=BillingStatus.SUCCEEDED,
        period_start=period_start,
        period_end=period_end
    )
    db.session.add(txn)

    # Extend subscription end_date if this is a renewal
    if subscription:
        if period_end and period_end > subscription.end_date:
            logger.info(f"Extending subscription for user {user.id} from {subscription.end_date} to {period_end}")
            subscription.end_date = period_end
            db.session.add(subscription)

    # Log security event
    se = SecurityEvent(
        user_id=user.id,
        event_type='subscription_renewal_succeeded',
        severity='info',
        details=f"Subscription renewal payment of {amount_paid / 100:.2f} {currency} succeeded. Invoice: {invoice_id}"
    )
    db.session.add(se)

    db.session.commit()
    
    # Send confirmation email to user
    _send_payment_confirmation_email(user, amount_paid, currency)
    
    logger.info(f"Successfully processed invoice {invoice_id} for user {user.id}")


def _handle_invoice_payment_failed(event):
    """
    Invoice payment failed - log the failed transaction and alert user.
    
    Stripe will automatically retry the payment according to retry schedule.
    We should:
    1. Log the failed transaction
    2. Alert the user
    3. Not immediately mark subscription as expired
    """
    invoice = event.get('data', {}).get('object', {})
    invoice_id = invoice.get('id')
    customer_id = invoice.get('customer')
    amount_due = invoice.get('amount_due', 0)
    currency = invoice.get('currency', 'eur').upper()
    next_payment_attempt = invoice.get('next_payment_attempt')
    
    logger.warning(f"Invoice payment failed: {invoice_id} for customer {customer_id}, amount: {amount_due / 100:.2f} {currency}")

    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if not user:
        logger.warning(f"User not found for Stripe customer {customer_id}")
        return

    # Check for duplicate
    existing_txn = BillingTransaction.query.filter_by(
        provider='stripe',
        provider_txn_id=invoice_id
    ).first()

    if existing_txn:
        logger.info(f"Failed invoice {invoice_id} already logged, skipping duplicate")
        return

    subscription = Subscription.query.filter_by(user_id=user.id).order_by(
        Subscription.end_date.desc()
    ).first()

    # Create transaction record for failed payment
    period_start = datetime.utcfromtimestamp(invoice.get('period_start', 0)) if invoice.get('period_start') else None
    period_end = datetime.utcfromtimestamp(invoice.get('period_end', 0)) if invoice.get('period_end') else None

    txn = BillingTransaction(
        user_id=user.id,
        subscription_id=subscription.id if subscription else None,
        provider='stripe',
        provider_txn_id=invoice_id,
        amount_minor=amount_due,
        currency=currency.lower(),
        status=BillingStatus.FAILED,
        period_start=period_start,
        period_end=period_end
    )
    db.session.add(txn)

    # Log security event
    retry_text = f" Stripe will retry on {datetime.utcfromtimestamp(next_payment_attempt)}" if next_payment_attempt else ""
    se = SecurityEvent(
        user_id=user.id,
        event_type='subscription_renewal_failed',
        severity='warning',
        details=f"Subscription renewal payment of {amount_due / 100:.2f} {currency} failed. Invoice: {invoice_id}.{retry_text}"
    )
    db.session.add(se)

    db.session.commit()

    # Send alert email to user
    _send_payment_failed_alert_email(user, amount_due, currency, next_payment_attempt)
    
    logger.warning(f"Logged failed invoice {invoice_id} for user {user.id}")


def _handle_subscription_updated(event):
    """
    Subscription was updated (e.g., plan change, status change).
    """
    subscription_data = event.get('data', {}).get('object', {})
    stripe_subscription_id = subscription_data.get('id')
    customer_id = subscription_data.get('customer')
    status = subscription_data.get('status')  # active, past_due, canceled, etc.
    
    logger.info(f"Subscription {stripe_subscription_id} updated: status={status}")

    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if not user:
        logger.warning(f"User not found for Stripe customer {customer_id}")
        return

    # Find subscription by user
    subscription = Subscription.query.filter_by(user_id=user.id).order_by(
        Subscription.end_date.desc()
    ).first()

    if subscription:
        # Update end date based on Stripe's current_period_end
        if subscription_data.get('current_period_end'):
            new_end_date = datetime.utcfromtimestamp(subscription_data['current_period_end'])
            if new_end_date > subscription.end_date:
                logger.info(f"Updating subscription end_date for user {user.id} to {new_end_date}")
                subscription.end_date = new_end_date
                db.session.add(subscription)
                db.session.commit()

    # Log security event for status changes
    if status == 'past_due':
        se = SecurityEvent(
            user_id=user.id,
            event_type='subscription_past_due',
            severity='warning',
            details=f"Subscription {stripe_subscription_id} is past due. Payment retry in progress."
        )
        db.session.add(se)
        _send_payment_reminder_email(user)
    
    elif status == 'canceled':
        se = SecurityEvent(
            user_id=user.id,
            event_type='subscription_canceled',
            severity='info',
            details=f"Subscription {stripe_subscription_id} was canceled."
        )
        db.session.add(se)

    db.session.commit()


def _handle_subscription_deleted(event):
    """
    Subscription was deleted/canceled in Stripe.
    """
    subscription_data = event.get('data', {}).get('object', {})
    stripe_subscription_id = subscription_data.get('id')
    customer_id = subscription_data.get('customer')
    
    logger.info(f"Subscription {stripe_subscription_id} deleted for customer {customer_id}")

    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if not user:
        logger.warning(f"User not found for Stripe customer {customer_id}")
        return

    # Find and expire subscription
    subscription = Subscription.query.filter_by(user_id=user.id).order_by(
        Subscription.end_date.desc()
    ).first()

    if subscription:
        now = datetime.utcnow()
        if subscription.end_date > now:
            logger.info(f"Expiring subscription for user {user.id}")
            subscription.end_date = now
            db.session.add(subscription)

    # Log security event
    se = SecurityEvent(
        user_id=user.id,
        event_type='subscription_deleted',
        severity='warning',
        details=f"Subscription {stripe_subscription_id} was deleted in Stripe."
    )
    db.session.add(se)
    db.session.commit()

    _send_subscription_canceled_email(user)


def _handle_invoice_finalized(event):
    """
    Invoice was finalized and is ready to pay.
    This is informational - actual payment attempt happens after this.
    """
    invoice = event.get('data', {}).get('object', {})
    invoice_id = invoice.get('id')
    customer_id = invoice.get('customer')
    amount_due = invoice.get('amount_due', 0)
    
    logger.info(f"Invoice finalized: {invoice_id} for customer {customer_id}, amount due: {amount_due / 100:.2f}")
    
    # Could send a "upcoming charge" email here if desired
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if user:
        logger.info(f"Upcoming invoice for user {user.id}: {amount_due / 100:.2f}")


# Email notification functions
def _send_payment_confirmation_email(user, amount_minor, currency):
    """Send confirmation email when payment succeeds."""
    try:
        from app.notifications.alerts import send_email
        
        subject = f"✓ Payment Received - {amount_minor / 100:.2f} {currency}"
        body = f"""
Hello {user.first_name or 'User'},

Your subscription payment has been processed successfully.

Amount: {amount_minor / 100:.2f} {currency}
Date: {datetime.utcnow().isoformat()}

Thank you for using gueInsight!

Best regards,
The gueInsight Team
        """
        send_email(user.email, subject, body)
    except Exception as e:
        logger.error(f"Failed to send payment confirmation email to {user.email}: {e}")


def _send_payment_failed_alert_email(user, amount_due, currency, next_attempt_timestamp):
    """Send alert email when payment fails."""
    try:
        from app.notifications.alerts import send_email
        
        retry_date = datetime.utcfromtimestamp(next_attempt_timestamp) if next_attempt_timestamp else "shortly"
        
        subject = "⚠ Payment Failed - Action Required"
        body = f"""
Hello {user.first_name or 'User'},

Your recent subscription payment failed, but don't worry - we'll retry it automatically.

Failed Amount: {amount_due / 100:.2f} {currency}
Next Retry: {retry_date}

If you'd like to update your payment method, please visit:
https://app.gueinsight.com/settings/billing

If the problem persists, please contact support@gueinsight.com

Best regards,
The gueInsight Team
        """
        send_email(user.email, subject, body)
    except Exception as e:
        logger.error(f"Failed to send payment failed alert to {user.email}: {e}")


def _send_payment_reminder_email(user):
    """Send reminder when subscription is past due."""
    try:
        from app.notifications.alerts import send_email
        
        subject = "Payment Reminder - Subscription Past Due"
        body = f"""
Hello {user.first_name or 'User'},

Your subscription is currently past due. We're attempting to process the payment automatically.

Please update your payment method to avoid service interruption:
https://app.gueinsight.com/settings/billing

If you have questions, please contact support@gueinsight.com

Best regards,
The gueInsight Team
        """
        send_email(user.email, subject, body)
    except Exception as e:
        logger.error(f"Failed to send payment reminder to {user.email}: {e}")


def _send_subscription_canceled_email(user):
    """Send confirmation when subscription is canceled."""
    try:
        from app.notifications.alerts import send_email
        
        subject = "Subscription Canceled"
        body = f"""
Hello {user.first_name or 'User'},

Your gueInsight subscription has been canceled.

You can resubscribe at any time:
https://app.gueinsight.com/subscription

If you need help or have feedback, please let us know:
support@gueinsight.com

Best regards,
The gueInsight Team
        """
        send_email(user.email, subject, body)
    except Exception as e:
        logger.error(f"Failed to send subscription canceled email to {user.email}: {e}")
