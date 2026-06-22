import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, send_file, Response
from flask_login import login_required, current_user, login_user, logout_user
import stripe
from datetime import datetime, timedelta
from app.models import (
    User,
    Subscription,
    UserRole,
    SupportTicket,
    SupportTicketStatus,
    UserPreference,
    UserNotification,
    NotificationSeverity,
    AnalysisTransaction,
    AnalysisStatus,
    UserActivityEvent,
    BillingTransaction,
    BillingStatus,
    DataExportRequest,
    DataDeletionRequest,
    SecurityEvent,
    db,
    Alert,
    AlertRule,
)
from app.forms import LoginForm, ResetPasswordForm, SignupForm, SubmitCloudLinkForm, SubmitTextForm, UploadFileForm, LogoutForm, ProfileForm, AlertRuleForm
from app.subscription_service import SubscriptionService
try:
    from app.src.analysis.file_analysis import analyze_text_for_security, analyze_cloud_link
except Exception:
    analyze_text_for_security = None
    analyze_cloud_link = None

try:
    from app.src.preprocessing.preprocess import preprocess_text
except Exception:
    preprocess_text = None

try:
    from app.integrations.supabase_auth import (
        sign_in_with_password,
        sync_local_user_from_supabase,
        supabase_auth_enabled,
    )
except Exception:
    sign_in_with_password = None
    sync_local_user_from_supabase = None
    supabase_auth_enabled = lambda: False
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Message
from app import mail
from app.subscription_service import get_subscription_status, get_subscription_duration
from flask import jsonify
import os
from werkzeug.utils import secure_filename
import datetime
from app.config import Config
from app.utils.utils import generate_report, OutputHandler, get_serializer
from sqlalchemy import inspect, text
from app.routes.users_auth_privacy_routes import register_auth_privacy_routes
from app.routes.users_billing_routes import register_billing_routes
from app.routes.users_support_routes import register_support_routes
from app.routes.users_analysis_routes import register_analysis_routes
from app.routes.users_enterprise_routes import register_enterprise_routes

from app.subscription_service import COMPLIANCE_TIERS

# Create blueprint for user routes
users_bp = Blueprint('users', __name__)

_USER_SCHEMA_SYNCED = False
_LOGIN_RATE_CACHE = {}
LOGIN_MAX_ATTEMPTS = 8
LOGIN_WINDOW_SECONDS = 300


def _utc_now():
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)


PLAN_ANALYSIS_LIMITS = {
    'starter': {
        'max_file_size_mb': 2,
        'max_text_chars': 10000,
        'max_items_per_analysis': 5,
        'max_url_length': 300,
        'description': 'Basic threat detection for individuals',
    },
    'compliance_pro': {
        'max_file_size_mb': 8,
        'max_text_chars': 50000,
        'max_items_per_analysis': 30,
        'max_url_length': 1200,
        'description': 'GDPR-compliant threat detection with audit trails',
    },
    'enterprise_risk': {
        'max_file_size_mb': 16,
        'max_text_chars': 150000,
        'max_items_per_analysis': 150,
        'max_url_length': 2500,
        'description': 'NIS2 + ISO27001 critical infrastructure risk management',
    },
    'enterprise_elite': {
        'max_file_size_mb': 500,  # Effectively unlimited
        'max_text_chars': 5000000,
        'max_items_per_analysis': 5000,
        'max_url_length': 8000,
        'description': 'White-glove SOC2 + EU residency enforcement',
    },
    # Legacy tier names for backward compatibility
    'free': {
        'max_file_size_mb': 2,
        'max_text_chars': 10000,
        'max_items_per_analysis': 5,
        'max_url_length': 300,
        'description': 'Starter tier',
    },
    'premium_individual': {
        'max_file_size_mb': 8,
        'max_text_chars': 50000,
        'max_items_per_analysis': 30,
        'max_url_length': 1200,
        'description': 'Compliance Pro tier',
    },
    'premium_small_business': {
        'max_file_size_mb': 16,
        'max_text_chars': 150000,
        'max_items_per_analysis': 150,
        'max_url_length': 2500,
        'description': 'Enterprise Risk tier',
    },
    'premium_large_business': {
        'max_file_size_mb': 500,
        'max_text_chars': 5000000,
        'max_items_per_analysis': 5000,
        'max_url_length': 8000,
        'description': 'Enterprise Elite tier',
    },
}


def _normalize_plan_key(plan_like):
    """Normalize plan names to canonical tier keys, handling legacy names."""
    value = str(plan_like or 'starter').strip().lower()
    
    # Map legacy names to new compliance-focused tiers
    legacy_mapping = {
        'free': 'starter',
        'freemium': 'starter',
        'premium': 'compliance_pro',
        'premium_individual': 'compliance_pro',
        'starter': 'starter',
        'growth': 'enterprise_risk',
        'premium_small_business': 'enterprise_risk',
        'scale': 'enterprise_elite',
        'premium_large_business': 'enterprise_elite',
        'compliance_pro': 'compliance_pro',
        'enterprise_risk': 'enterprise_risk',
        'enterprise_elite': 'enterprise_elite',
    }
    
    normalized = legacy_mapping.get(value, 'starter')
    if normalized not in PLAN_ANALYSIS_LIMITS:
        return 'starter'
    return normalized


def _get_latest_subscription(user_id):
    return (
        Subscription.query
        .filter_by(user_id=user_id)
        .order_by(Subscription.end_date.desc())
        .first()
    )


def _get_active_plan_key(user_id):
    latest_subscription = _get_latest_subscription(user_id)
    if not latest_subscription:
        return 'free'

    now = _utc_now()
    if latest_subscription.end_date and latest_subscription.end_date < now:
        return 'free'
    return _normalize_plan_key(getattr(latest_subscription, 'plan', None))


def _get_analysis_limits_for_plan(plan_key):
    normalized = _normalize_plan_key(plan_key)
    return PLAN_ANALYSIS_LIMITS.get(normalized, PLAN_ANALYSIS_LIMITS['free'])


def _count_analysis_items(input_data):
    separators = ['\n', ',', ';', '\t']
    normalized = str(input_data or '')
    for separator in separators:
        normalized = normalized.replace(separator, ' ')
    return len([chunk for chunk in normalized.split(' ') if chunk.strip()])


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value or '').strip().lower()
    return text in {'1', 'true', 'yes', 'on'}

def _get_or_create_user_preference(user_id):
    preference = UserPreference.query.filter_by(user_id=user_id).first()
    if preference:
        return preference

    preference = UserPreference(user_id=user_id)
    db.session.add(preference)
    db.session.commit()
    return preference

def _create_user_notification(user_id, notification_type, title, message, severity='info', action_url=None):
    severity_lookup = {
        'info': NotificationSeverity.INFO,
        'warning': NotificationSeverity.WARNING,
        'critical': NotificationSeverity.CRITICAL,
    }
    notification = UserNotification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        severity=severity_lookup.get(str(severity).lower(), NotificationSeverity.INFO),
        action_url=action_url,
    )
    db.session.add(notification)
    return notification

def _log_user_activity(user_id, event_type, description, entity_type=None, entity_id=None, metadata=None):
    activity = UserActivityEvent(
        user_id=user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        event_metadata=json.dumps(metadata) if metadata else None,
    )
    db.session.add(activity)
    return activity


@users_bp.route('/checkout/create-session', methods=['POST', 'OPTIONS'])
def create_checkout_session():
    """Create a Stripe Checkout session for the selected compliance tier trial."""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    
    # Require login for POST
    if not current_user.is_authenticated:
        return jsonify({'error': 'Authentication required'}), 401
    
    payload = request.get_json(silent=True) or {}
    tier_id = payload.get('tier_id')
    trial_days = int(payload.get('trial_days') or 14)
    if not tier_id:
        return jsonify({'error': 'tier_id is required'}), 400

    # Normalize and validate
    tier_key = _normalize_plan_key(tier_id)
    tier_config = COMPLIANCE_TIERS.get(tier_key)
    if not tier_config or tier_config.get('price_monthly_eur', 0) == 0:
        return jsonify({'error': 'Invalid or free tier selected'}), 400

    # Prevent duplicate active subscriptions/trials
    now = datetime.datetime.utcnow()
    existing = (
        Subscription.query
        .filter_by(user_id=current_user.id)
        .order_by(Subscription.end_date.desc())
        .first()
    )
    if existing and existing.end_date and existing.end_date >= now:
        return jsonify({'error': 'You already have an active subscription or trial.'}), 400

    # Initialize Stripe
    stripe.api_key = current_app.config.get('STRIPE_API_KEY')
    
    # If Stripe is not configured, use local mock mode for development/testing
    if not stripe.api_key:
        # Create or update subscription directly for local testing
        try:
            start_date = now
            end_date = now + datetime.timedelta(days=trial_days) if trial_days > 0 else now + datetime.timedelta(days=30)
            
            # Remove or expire existing subscription
            if existing:
                existing.end_date = now
                db.session.add(existing)
            
            # Create new subscription
            new_sub = Subscription(
                user_id=current_user.id,
                plan=tier_key,
                start_date=start_date,
                end_date=end_date,
                is_trial=trial_days > 0
            )
            db.session.add(new_sub)
            
            # Update user's current_plan
            current_user.current_plan = tier_key
            current_user.plan_expires_at = end_date
            db.session.add(current_user)
            
            db.session.commit()
            current_app.logger.info(f'Subscription upgraded (local mode) for user {current_user.id} to plan {tier_key}')
            # Return success with redirect to dashboard
            return jsonify({'checkout_url': '/dashboard?checkout=success'})
        except Exception as e:
            db.session.rollback()
            current_app.logger.exception('Local subscription upgrade failed')
            return jsonify({'error': 'Failed to upgrade subscription'}), 500

    # Build checkout session with inline price data
    try:
        base_url = request.host_url.rstrip('/')
        # Use an existing Stripe Price ID if configured; otherwise fall back to inline price_data
        price_id = tier_config.get('stripe_price_id')
        if price_id:
            line_items = [{'price': price_id, 'quantity': 1}]
        else:
            line_items = [{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {'name': f"gueInsight - {tier_config.get('name')}"},
                    'unit_amount': int(tier_config.get('price_monthly_eur', 0)),
                    'recurring': {'interval': 'month'},
                },
                'quantity': 1,
            }]

        # Build subscription_data: include trial_period_days only when > 0
        subscription_data = {'metadata': {'user_id': str(current_user.id), 'tier': tier_key, 'trial_days': str(trial_days)}}
        if trial_days and int(trial_days) > 0:
            subscription_data['trial_period_days'] = int(trial_days)

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            payment_method_collection='always',
            mode='subscription',
            line_items=line_items,
            subscription_data=subscription_data,
            success_url=f"{base_url}/dashboard?checkout=success",
            cancel_url=f"{base_url}/subscription?checkout=cancel",
            metadata={'user_id': str(current_user.id), 'tier': tier_key, 'trial_days': str(trial_days)},
        )
    except Exception as e:
        current_app.logger.exception('Stripe checkout session creation failed')
        return jsonify({'error': 'Failed to create checkout session'}), 500

    return jsonify({'checkout_url': session.url})


def _log_security_event(event_type, severity='info', user_id=None, details=None):
    event = SecurityEvent(
        user_id=user_id,
        event_type=event_type,
        severity=severity,
        ip_address=request.remote_addr,
        user_agent=(request.headers.get('User-Agent') or '')[:500],
        details=(json.dumps(details) if details else None),
    )
    db.session.add(event)
    return event


def _is_login_rate_limited(identifier):
    now = int(_utc_now().timestamp())
    window = now // LOGIN_WINDOW_SECONDS
    key = f"{identifier}:{window}"
    attempts = _LOGIN_RATE_CACHE.get(key, 0)
    if attempts >= LOGIN_MAX_ATTEMPTS:
        return True
    _LOGIN_RATE_CACHE[key] = attempts + 1
    return False


def _sync_user_profile_columns():
    """Add newly introduced optional profile columns for legacy databases."""
    global _USER_SCHEMA_SYNCED
    if _USER_SCHEMA_SYNCED:
        return

    columns_to_add = {
        'company': 'VARCHAR(255)',
        'job_title': 'VARCHAR(255)',
        'team_size': 'VARCHAR(50)',
        'primary_use_case': 'VARCHAR(255)',
        'newsletter_opt_in': 'BOOLEAN DEFAULT FALSE',
        'gdpr_consent_at': 'TIMESTAMP NULL',
        'gdpr_consent_version': 'VARCHAR(50) NULL',
        'privacy_policy_version': 'VARCHAR(50) NULL',
        'terms_accepted_at': 'TIMESTAMP NULL',
        'marketing_consent_at': 'TIMESTAMP NULL',
        'last_login_at': 'TIMESTAMP NULL',
    }

    inspector = inspect(db.engine)
    existing_columns = {column['name'] for column in inspector.get_columns('user')}
    missing_columns = {name: ddl for name, ddl in columns_to_add.items() if name not in existing_columns}

    if not missing_columns:
        _USER_SCHEMA_SYNCED = True
        return

    with db.engine.begin() as connection:
        for column_name, column_ddl in missing_columns.items():
            connection.execute(text(f'ALTER TABLE "user" ADD COLUMN {column_name} {column_ddl}'))

    _USER_SCHEMA_SYNCED = True


def _privacy_export_serializer():
    return get_serializer(current_app.config['SECRET_KEY'], current_app.config['SECURITY_PASSWORD_SALT'])


def _privacy_export_dir():
    export_dir = os.path.join(current_app.instance_path, 'privacy_exports')
    os.makedirs(export_dir, exist_ok=True)
    return export_dir


def _build_privacy_export_payload(user):
    return {
        'exported_at': _utc_now().isoformat(),
        'user': _serialize_auth_user(user),
        'preferences': user.preference.to_dict() if user.preference else None,
        'subscriptions': [
            {
                'id': sub.id,
                'plan': sub.plan,
                'start_date': sub.start_date.isoformat() if sub.start_date else None,
                'end_date': sub.end_date.isoformat() if sub.end_date else None,
            }
            for sub in user.subscriptions
        ],
        'billing_transactions': [tx.to_dict() for tx in user.billing_transactions],
        'analysis_transactions': [tx.to_dict() for tx in user.analysis_transactions],
        'support_tickets': [ticket.to_dict() for ticket in user.support_tickets],
        'activity_events': [event.to_dict() for event in user.activity_events],
        'security_events': [event.to_dict() for event in getattr(user, 'security_events', [])],
        'data_export_requests': [request_item.to_dict() for request_item in user.data_export_requests],
        'data_deletion_requests': [request_item.to_dict() for request_item in user.data_deletion_requests],
    }


def _write_privacy_export(user_id, request_id, payload):
    export_path = os.path.join(_privacy_export_dir(), f'user_{user_id}_export_{request_id}.json')
    with open(export_path, 'w', encoding='utf-8') as export_file:
        json.dump(payload, export_file, indent=2, ensure_ascii=False)
    return export_path










import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required, current_user, login_user
import stripe
from datetime import datetime, timedelta
from app.models import User, Subscription, UserRole, db
from app.forms import LoginForm, ResetPasswordForm, SignupForm, SubmitCloudLinkForm, SubmitTextForm, UploadFileForm, LogoutForm
from app.subscription_service import SubscriptionService
from app.src.analysis.file_analysis import analyze_text_for_security, analyze_cloud_link
from app.src.preprocessing.preprocess import preprocess_text
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Message
from app import mail
from app.subscription_service import get_subscription_status, get_subscription_duration
from app.forms import ProfileForm
from flask import request, flash, redirect, url_for, render_template
from flask import jsonify
import os
from werkzeug.utils import secure_filename
import datetime
from app.config import Config
from app.subscription_service import SubscriptionService
from app.utils.utils import generate_report
from app.utils.utils import OutputHandler


# Create blueprint for user routes
users_bp = Blueprint('users', __name__)






# Subscription creation and payment



# Confirm subscription after successful payment



# Process payment and activate subscription



# Handle login






@users_bp.route('/success')
@login_required
def success():
    # You can add logic here to update the user's subscription status in the database
    return render_template('success.html')  # Success page that informs the user their payment was successful


# Password reset routes
@users_bp.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()
        import json
        import logging
        from flask import Blueprint, render_template, request, jsonify, current_app, redirect, url_for, flash
        import stripe
        from datetime import datetime, timedelta
        from app.models import User, Subscription, UserRole, db, Alert, AlertRule
        from app.subscription_service import SubscriptionService, get_subscription_status, get_subscription_duration
        from app.src.analysis.file_analysis import analyze_text_for_security, analyze_cloud_link
        from app.src.preprocessing.preprocess import preprocess_text
        from werkzeug.exceptions import RequestEntityTooLarge
        from werkzeug.security import generate_password_hash
        import os
        from werkzeug.utils import secure_filename
        from app.config import Config
        from app.utils.utils import generate_report, OutputHandler

        # Create blueprint for user routes
        users_bp = Blueprint('users', __name__)
        user = User.query.filter_by(email=email).first()
        if user:
            # Update the password securely
            user.set_password(form.password.data)
            db.session.commit()
            flash('Your password has been reset!', 'success')
            return redirect(url_for('login'))
        else:
            flash('User not found. Please try again.', 'danger')
            return redirect(url_for('reset_request'))

    return render_template('reset_password.html', form=form)


def verify_reset_token(token):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt=current_app.config['SECURITY_PASSWORD_SALT'], max_age=3600)
    except Exception as e:
        raise ValueError('Token expired or invalid') from e
    return email


 #Password reset routes
@users_bp.route('/reset_request', methods=['GET', 'POST'])
def reset_request():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
            token = s.dumps(user.email, salt=current_app.config['SECURITY_PASSWORD_SALT'])
            send_reset_email(user, token)
            flash('Check your email for the password reset link.', 'info')
            return redirect(url_for('login'))
        else:
            flash('Email not found.', 'danger')
    return render_template('reset_request.html', form=form)

# Helper function to send reset email
def send_reset_email(to_email, reset_url):
    msg = Message("Password Reset Request", recipients=[to_email])
    msg.body = f"Click the link to reset your password: {reset_url}"
    mail.send(msg)


@users_bp.errorhandler(RequestEntityTooLarge)
def handle_large_file_error(e):
    flash("File size exceeds the maximum limit of 16MB.", "danger")
    return redirect(url_for('user_dashboard'))

@users_bp.route('/subscription_management', methods=['GET'])
@login_required
def subscription():
    """Render the subscription page with user details."""
    # Calculate dynamic subscription details
    subscription_status = get_subscription_status(current_user)
    remaining_days = get_subscription_duration(current_user)
    
    # Render the subscription management page
    return render_template(
        'subscription_management.html',
        user=current_user,
        subscription_status=subscription_status,
        remaining_days=remaining_days
    )

@users_bp.route('/subscription', methods=['GET'])
@login_required
def subscription_page():
    """Render a page where users can select a subscription plan."""
    return render_template('subscription.html')




@users_bp.route('/upgrade_subscription', methods=['GET', 'POST'])
@login_required
def upgrade_subscription():

    # All Flask-Login, Flask-Mail, and user/password management logic removed for Supabase Auth migration.
    return render_template('subscription.html')


def _serialize_auth_user(user):
    _sync_user_profile_columns()
    role = getattr(user, 'role', None)
    role_value = getattr(role, 'value', role)
    latest_subscription = _get_latest_subscription(user.id)
    active_plan_key = _get_active_plan_key(user.id)
    current_plan = active_plan_key if active_plan_key != 'free' else 'Free'
    analysis_limits = _get_analysis_limits_for_plan(active_plan_key)
    preference = UserPreference.query.filter_by(user_id=user.id).first()
    unread_notification_count = UserNotification.query.filter_by(user_id=user.id, is_read=False).count()
    return {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone_number': user.phone_number,
        'company': getattr(user, 'company', None),
        'job_title': getattr(user, 'job_title', None),
        'team_size': getattr(user, 'team_size', None),
        'primary_use_case': getattr(user, 'primary_use_case', None),
        'newsletter_opt_in': bool(getattr(user, 'newsletter_opt_in', False)),
        'gdpr_consent_at': user.gdpr_consent_at.isoformat() if getattr(user, 'gdpr_consent_at', None) else None,
        'gdpr_consent_version': getattr(user, 'gdpr_consent_version', None),
        'privacy_policy_version': getattr(user, 'privacy_policy_version', None),
        'terms_accepted_at': user.terms_accepted_at.isoformat() if getattr(user, 'terms_accepted_at', None) else None,
        'marketing_consent_at': user.marketing_consent_at.isoformat() if getattr(user, 'marketing_consent_at', None) else None,
        'role': role_value,
        'current_plan': current_plan,
        'analysis_limits': analysis_limits,
        'avatar_url': getattr(preference, 'avatar_url', None),
        'preferences': preference.to_dict() if preference else None,
        'unread_notifications': unread_notification_count,
        'plan_expires_at': latest_subscription.end_date.isoformat() if latest_subscription and latest_subscription.end_date else None,
    }


register_auth_privacy_routes(users_bp)
register_billing_routes(users_bp)
register_support_routes(users_bp)
register_analysis_routes(users_bp)
register_enterprise_routes(users_bp)
