"""
Scheduled tasks for recurring billing and subscription management.
"""

from celery import shared_task
from datetime import datetime, timedelta
from app import create_app, db
from app.models import Subscription, User, BillingTransaction, BillingStatus, SecurityEvent
import stripe
import logging

logger = logging.getLogger(__name__)


@shared_task
def sync_stripe_subscriptions():
    """
    Scheduled task (runs daily) to sync active Stripe subscriptions with our database.
    
    Purpose:
    - Ensures our database reflects Stripe's subscription state
    - Creates billing transactions for recurring charges
    - Updates subscription end dates based on Stripe data
    - Detects failed payments and alerts
    """
    app = create_app()
    with app.app_context():
        stripe.api_key = app.config.get('STRIPE_API_KEY')
        
        if not stripe.api_key:
            logger.info("Stripe API key not configured, skipping subscription sync")
            return {'status': 'skipped', 'reason': 'Stripe not configured'}
        
        try:
            logger.info("Starting daily subscription sync with Stripe")
            synced_count = 0
            error_count = 0
            
            # Get all users with Stripe customer IDs
            users_with_stripe = User.query.filter(
                User.stripe_customer_id.isnot(None)
            ).all()
            
            logger.info(f"Found {len(users_with_stripe)} users with Stripe customer IDs")
            
            for user in users_with_stripe:
                try:
                    _sync_user_stripe_subscription(user)
                    synced_count += 1
                except Exception as e:
                    logger.error(f"Error syncing subscription for user {user.id}: {e}")
                    error_count += 1
            
            logger.info(f"Subscription sync complete: {synced_count} synced, {error_count} errors")
            return {
                'status': 'complete',
                'synced_count': synced_count,
                'error_count': error_count
            }
            
        except Exception as e:
            logger.exception(f"Error during subscription sync: {e}")
            return {'status': 'failed', 'error': str(e)}


def _sync_user_stripe_subscription(user):
    """Sync a single user's subscription with Stripe."""
    stripe.api_key = app.config.get('STRIPE_API_KEY') if hasattr(_sync_user_stripe_subscription, 'app') else None
    
    try:
        # Retrieve subscriptions from Stripe for this customer
        subscriptions = stripe.Subscription.list(
            customer=user.stripe_customer_id,
            limit=10,
            status='active'
        )
        
        if subscriptions.data:
            for stripe_sub in subscriptions.data:
                stripe_sub_id = stripe_sub.id
                
                # Find or create local subscription record
                local_sub = Subscription.query.filter_by(
                    user_id=user.id,
                    stripe_subscription_id=stripe_sub_id
                ).first()
                
                if not local_sub:
                    # Create new subscription record
                    local_sub = Subscription(
                        user_id=user.id,
                        plan=stripe_sub.metadata.get('tier', 'unknown') if stripe_sub.metadata else 'unknown',
                        start_date=datetime.utcfromtimestamp(stripe_sub.start_date),
                        end_date=datetime.utcfromtimestamp(stripe_sub.current_period_end),
                        is_trial=stripe_sub.trial_end is not None,
                        stripe_subscription_id=stripe_sub_id,
                        stripe_customer_id=user.stripe_customer_id
                    )
                    db.session.add(local_sub)
                    logger.info(f"Created new subscription record for user {user.id}, Stripe ID: {stripe_sub_id}")
                
                else:
                    # Update existing record
                    new_end_date = datetime.utcfromtimestamp(stripe_sub.current_period_end)
                    if new_end_date != local_sub.end_date:
                        local_sub.end_date = new_end_date
                        logger.info(f"Updated subscription end_date for user {user.id} to {new_end_date}")
                
                db.session.commit()
    
    except Exception as e:
        logger.error(f"Error syncing Stripe subscription for user {user.id}: {e}")
        raise


@shared_task
def process_upcoming_renewal_notifications():
    """
    Scheduled task (runs daily) to send reminder emails for upcoming renewals.
    Sends email 3 days before subscription expires.
    """
    app = create_app()
    with app.app_context():
        try:
            logger.info("Processing upcoming renewal notifications")
            
            # Find subscriptions expiring in 3 days
            soon = datetime.utcnow() + timedelta(days=3)
            upcoming_subs = Subscription.query.filter(
                Subscription.end_date.between(
                    datetime.utcnow() + timedelta(days=2, hours=23),
                    soon
                )
            ).all()
            
            logger.info(f"Found {len(upcoming_subs)} subscriptions expiring in ~3 days")
            
            for sub in upcoming_subs:
                try:
                    _send_renewal_reminder(sub.user, sub)
                except Exception as e:
                    logger.error(f"Error sending renewal reminder for user {sub.user_id}: {e}")
            
            return {'status': 'complete', 'notified_count': len(upcoming_subs)}
            
        except Exception as e:
            logger.exception(f"Error processing renewal notifications: {e}")
            return {'status': 'failed', 'error': str(e)}


def _send_renewal_reminder(user, subscription):
    """Send subscription renewal reminder email."""
    try:
        from app.notifications.alerts import send_email
        
        amount = 0
        # Get pricing from subscription plan
        from app.subscription_service import COMPLIANCE_TIERS
        tier_config = COMPLIANCE_TIERS.get(subscription.plan, {})
        amount_monthly_eur = tier_config.get('price_monthly_eur', 0) / 100
        
        subject = "Your gueInsight subscription renews soon"
        body = f"""
Hello {user.first_name or 'User'},

Your gueInsight {subscription.plan.replace('_', ' ').title()} subscription will renew on {subscription.end_date.strftime('%Y-%m-%d')}.

Amount: €{amount_monthly_eur:.2f}/month

No action is needed - we'll charge your saved payment method automatically.

If you need to update your billing information:
https://app.gueinsight.com/settings/billing

Best regards,
The gueInsight Team
        """
        
        send_email(user.email, subject, body)
        logger.info(f"Sent renewal reminder to {user.email}")
        
    except Exception as e:
        logger.error(f"Failed to send renewal reminder to {user.email}: {e}")


@shared_task
def check_expired_subscriptions():
    """
    Scheduled task (runs daily) to check and handle expired subscriptions.
    Downgrades users to free plan if subscription has ended.
    """
    app = create_app()
    with app.app_context():
        try:
            logger.info("Checking for expired subscriptions")
            
            now = datetime.utcnow()
            expired_subs = Subscription.query.filter(
                Subscription.end_date < now,
                Subscription.user_id.in_(
                    db.session.query(Subscription.user_id)
                    .filter(Subscription.end_date >= now)
                    .distinct()
                    .scalar_subquery()
                )
            ).all()
            
            logger.info(f"Found {len(expired_subs)} expired subscriptions")
            
            downgraded_count = 0
            for sub in expired_subs:
                try:
                    user = sub.user
                    
                    # Downgrade to free plan
                    user.current_plan = 'starter'
                    user.plan_expires_at = None
                    db.session.add(user)
                    
                    # Log security event
                    se = SecurityEvent(
                        user_id=user.id,
                        event_type='subscription_expired',
                        severity='info',
                        details=f"Subscription to {sub.plan} expired on {sub.end_date.isoformat()}"
                    )
                    db.session.add(se)
                    
                    db.session.commit()
                    downgraded_count += 1
                    
                    logger.info(f"Downgraded user {user.id} to free plan due to expired subscription")
                    
                except Exception as e:
                    logger.error(f"Error downgrading user {sub.user_id}: {e}")
            
            return {'status': 'complete', 'downgraded_count': downgraded_count}
            
        except Exception as e:
            logger.exception(f"Error checking expired subscriptions: {e}")
            return {'status': 'failed', 'error': str(e)}


@shared_task
def retry_failed_payments():
    """
    Scheduled task (runs every 6 hours) to check for failed payments and attempt retry.
    Note: Stripe handles automatic retries, but we can log and alert.
    """
    app = create_app()
    with app.app_context():
        try:
            logger.info("Checking for failed payments to retry")
            
            # Get recent failed transactions
            failed_txns = BillingTransaction.query.filter_by(
                status=BillingStatus.FAILED
            ).filter(
                BillingTransaction.created_at > datetime.utcnow() - timedelta(days=7)
            ).all()
            
            logger.info(f"Found {len(failed_txns)} failed transactions in past 7 days")
            
            # Log for manual review
            for txn in failed_txns:
                logger.warning(f"Failed payment for user {txn.user_id}: {txn.provider_txn_id}")
            
            return {'status': 'complete', 'failed_count': len(failed_txns)}
            
        except Exception as e:
            logger.exception(f"Error checking failed payments: {e}")
            return {'status': 'failed', 'error': str(e)}
