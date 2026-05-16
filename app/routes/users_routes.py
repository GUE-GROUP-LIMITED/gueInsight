import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, send_file
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


@users_bp.route('/checkout/create-session', methods=['POST'])
@login_required
def create_checkout_session():
    """Create a Stripe Checkout session for the selected compliance tier trial."""
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
    now = datetime.utcnow()
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
    if not stripe.api_key:
        return jsonify({'error': 'Stripe API key not configured'}), 500

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







@users_bp.route('/user_dashboard', methods=['GET', 'POST'])
@login_required
def user_dashboard():
    
    # Initialize the forms
    file_upload_form = UploadFileForm()
    url_submission_form = SubmitCloudLinkForm()
    text_submission_form = SubmitTextForm()
   
    # Get the user's subscription
    subscription = Subscription.query.filter_by(user_id=current_user.id).first()
    logout_form = LogoutForm()

    # Determine subscription status
    subscription_status = 'Freemium'  # Default status

    if subscription:
        if getattr(subscription, 'is_trial', False):
            subscription_status = 'Trial'
        elif getattr(subscription, 'is_active', False):
            subscription_status = 'Premium'

    # Render the dashboard template with the necessary data
    return render_template(
        'users/userbase.html',
        upload_form=file_upload_form,
        cloud_form=url_submission_form,
        text_form=text_submission_form,
        subscription_status=subscription_status,
        logout_form=logout_form
    )


# Logout
@users_bp.route('/logout', methods=['POST']) 
@login_required
def logout():
    flash('You have been logged out.', 'success')
    return redirect(url_for('index'))



@users_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    # Get the form data already passed from the dashboard
    file_upload_form = UploadFileForm()
    url_submission_form = SubmitCloudLinkForm()
    text_submission_form = SubmitTextForm()

    # Initialize the SubscriptionService to get subscription details
    subscription_service = SubscriptionService(current_user.id)
    subscription_status = subscription_service.get_subscription_status(current_user)
    subscription = subscription_service.subscription
    plan_key = _get_active_plan_key(current_user.id)
    analysis_limits = _get_analysis_limits_for_plan(plan_key)

    # Check the subscription status and upload limits
    if subscription_status == "Inactive" or subscription_status == "Expired":
        flash("Your subscription is inactive or expired. Please renew your subscription.", "danger")
        return redirect(url_for('users.user_dashboard'))

    if subscription_status == "Freemium":
        upload_limit = 1  # Freemium users can upload only once per month
    elif subscription_status == "Premium":
        # Determine upload limit based on the user's subscription plan
        if subscription.plan == 'premium_individual':
            upload_limit = 4
        elif subscription.plan == 'premium_small_business':
            upload_limit = 6
        elif subscription.plan == 'premium_large_business':
            upload_limit = 10
        else:
            upload_limit = 4
    else:
        flash("Invalid subscription status.", "danger")
        return redirect(url_for('users.user_dashboard'))

    # Count the user's uploads in the current month
    current_month = datetime.datetime.now().month
    upload_count = OutputHandler.count_uploads_in_month(current_user.id, current_month)

    # Check if the user has exceeded the allowed number of uploads
    if upload_count >= upload_limit:
        flash(f"You've exceeded your upload limit of {upload_limit} uploads for this month.", "danger")
        return redirect(url_for('users.user_dashboard'))

    # Handle File Upload
    if file_upload_form.validate_on_submit() and file_upload_form.file.data:
        uploaded_file = file_upload_form.file.data
        file_analysis_started_at = _utc_now()

        # Check the file type
        allowed_extensions = Config.ALLOWED_EXTENSIONS  # Get allowed file types from config
        file_extension = secure_filename(uploaded_file.filename).split('.')[-1].lower()

        if file_extension not in allowed_extensions:
            file_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='file',
                input_ref=uploaded_file.filename,
                status=AnalysisStatus.FAILED,
                plan_at_time=plan_key,
                items_count=1,
                error_message='Invalid file type.',
                created_at=file_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(file_tx)
            db.session.commit()
            flash("Invalid file type. Please upload a valid file.", "danger")
            return redirect(url_for('users.user_dashboard'))

        # Check if the file size is within both global and plan-specific limits.
        file_size_bytes = len(uploaded_file.read())
        max_plan_file_size_bytes = analysis_limits['max_file_size_mb'] * 1024 * 1024
        max_allowed_bytes = min(Config.MAX_CONTENT_LENGTH, max_plan_file_size_bytes)
        if file_size_bytes > max_allowed_bytes:
            file_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='file',
                input_ref=uploaded_file.filename,
                status=AnalysisStatus.BLOCKED_BY_PLAN,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=file_size_bytes,
                error_message='File exceeds plan limit.',
                created_at=file_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(file_tx)
            db.session.commit()
            flash(
                f"File exceeds your plan limit of {analysis_limits['max_file_size_mb']}MB per analysis.",
                "danger",
            )
            return redirect(url_for('users.user_dashboard'))

        # Reset the file pointer after checking the size
        uploaded_file.seek(0)


        try:
            # Process the file
            from app.src.ingestion.file_ingestion import FileIngestion
            file_ingestion = FileIngestion(uploaded_file)
            file_path, file_hash = file_ingestion.save_and_ingest()

            # Preprocess the file
            from app.src.preprocessing.preprocess import Preprocessor
            preprocessor = Preprocessor(file_path)
            processed_data = preprocessor.process()

            # Analyze the file
            from app.src.analysis.file_analysis import Analyzer
            analyzer = Analyzer(processed_data)
            analysis_results = analyzer.analyze()

            # Generate visualization (if any)
            from app.src.visualization.visualization import Visualization
            visualization = Visualization(analysis_results)
            visualization_result = visualization.generate()

            report_generator = generate_report()
            report_file = report_generator.generate_report(analysis_results, visualization_result)

            # Save the report to the user's dashboard
           
            OutputHandler.save_to_user_dashboard(current_user.id, report_file, file_path)

            completed_at = _utc_now()
            file_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='file',
                input_ref=file_path,
                status=AnalysisStatus.SUCCESS,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=file_size_bytes,
                processing_ms=max(1, int((completed_at - file_analysis_started_at).total_seconds() * 1000)),
                result_summary='File analysis completed successfully.',
                created_at=file_analysis_started_at,
                completed_at=completed_at,
            )
            db.session.add(file_tx)
            _log_user_activity(
                current_user.id,
                event_type='analysis.file.success',
                description='Completed a file analysis.',
                entity_type='analysis_transaction',
                metadata={'source_type': 'file', 'status': 'success'},
            )
            db.session.commit()

            # Render the results page
            return render_template('results.html', 
                                   results=analysis_results, 
                                   visualization=visualization_result,
                                   report_link='/Users/gabrielaloho/gueInsight/app/user_reports')  # Replace with actual path
        except Exception as e:
            file_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='file',
                input_ref=uploaded_file.filename,
                status=AnalysisStatus.FAILED,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=file_size_bytes,
                error_message=str(e),
                created_at=file_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(file_tx)
            db.session.commit()
            flash(f"Error processing file: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))


    # Handle URL Submission

    elif url_submission_form.validate_on_submit() and url_submission_form.cloud_link.data:
        cloud_link = url_submission_form.cloud_link.data
        url_analysis_started_at = _utc_now()
        if len(cloud_link) > analysis_limits['max_url_length']:
            url_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='url',
                input_ref=cloud_link[:500],
                status=AnalysisStatus.BLOCKED_BY_PLAN,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=len(cloud_link.encode('utf-8')),
                error_message='URL exceeds plan input length limit.',
                created_at=url_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(url_tx)
            db.session.commit()
            return jsonify({
                'status': 'error',
                'message': (
                    f"URL input exceeds your plan limit of {analysis_limits['max_url_length']} characters per analysis."
                )
            }), 400
        try:
            # Threat intelligence enrichment
            from app.integrations.rapidapi import enrich_url
            enrichment = enrich_url(cloud_link)
            # Process the cloud link (analysis)
            analysis_results = analyze_cloud_link(cloud_link)

            completed_at = _utc_now()
            url_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='url',
                input_ref=cloud_link[:500],
                status=AnalysisStatus.SUCCESS,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=len(cloud_link.encode('utf-8')),
                processing_ms=max(1, int((completed_at - url_analysis_started_at).total_seconds() * 1000)),
                result_summary='URL analysis completed successfully.',
                created_at=url_analysis_started_at,
                completed_at=completed_at,
            )
            db.session.add(url_tx)
            _log_user_activity(
                current_user.id,
                event_type='analysis.url.success',
                description='Completed a URL analysis.',
                entity_type='analysis_transaction',
                metadata={'source_type': 'url', 'status': 'success'},
            )
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': 'Cloud link processed successfully.',
                'enrichment': enrichment,
                'results': analysis_results
            })

        except Exception as e:
            url_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='url',
                input_ref=cloud_link[:500],
                status=AnalysisStatus.FAILED,
                plan_at_time=plan_key,
                items_count=1,
                input_size_bytes=len(cloud_link.encode('utf-8')),
                error_message=str(e),
                created_at=url_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(url_tx)
            db.session.commit()
            flash(f"Error processing cloud link: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))

    # Handle Text/Hash Submission

    elif text_submission_form.validate_on_submit() and text_submission_form.pasted_input.data:
        input_data = text_submission_form.pasted_input.data
        text_analysis_started_at = _utc_now()
        input_length = len(input_data)
        analysis_item_count = _count_analysis_items(input_data)

        if input_length > analysis_limits['max_text_chars']:
            text_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='text',
                input_ref=input_data[:500],
                status=AnalysisStatus.BLOCKED_BY_PLAN,
                plan_at_time=plan_key,
                items_count=analysis_item_count,
                input_size_bytes=len(input_data.encode('utf-8')),
                error_message='Text exceeds plan input length limit.',
                created_at=text_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(text_tx)
            db.session.commit()
            return jsonify({
                'status': 'error',
                'message': (
                    f"Text input exceeds your plan limit of {analysis_limits['max_text_chars']} characters per analysis."
                )
            }), 400

        if analysis_item_count > analysis_limits['max_items_per_analysis']:
            text_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='text',
                input_ref=input_data[:500],
                status=AnalysisStatus.BLOCKED_BY_PLAN,
                plan_at_time=plan_key,
                items_count=analysis_item_count,
                input_size_bytes=len(input_data.encode('utf-8')),
                error_message='Input item count exceeds plan limit.',
                created_at=text_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(text_tx)
            db.session.commit()
            return jsonify({
                'status': 'error',
                'message': (
                    f"This request has {analysis_item_count} items, but your plan allows "
                    f"up to {analysis_limits['max_items_per_analysis']} items per analysis."
                )
            }), 400
        try:
            # Threat intelligence enrichment (try as hash, IP, or URL)
            from app.integrations.rapidapi import enrich_event
            enrichment = enrich_event({'hash': input_data, 'ip': input_data, 'url': input_data})
            # Process the text/hash input (analysis)
            analysis_results = analyze_text_for_security(input_data)

            completed_at = _utc_now()
            text_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='text',
                input_ref=input_data[:500],
                status=AnalysisStatus.SUCCESS,
                plan_at_time=plan_key,
                items_count=analysis_item_count,
                input_size_bytes=len(input_data.encode('utf-8')),
                processing_ms=max(1, int((completed_at - text_analysis_started_at).total_seconds() * 1000)),
                result_summary='Text analysis completed successfully.',
                created_at=text_analysis_started_at,
                completed_at=completed_at,
            )
            db.session.add(text_tx)
            _log_user_activity(
                current_user.id,
                event_type='analysis.text.success',
                description='Completed a text analysis.',
                entity_type='analysis_transaction',
                metadata={'source_type': 'text', 'status': 'success'},
            )
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': 'Text processed successfully.',
                'enrichment': enrichment,
                'results': analysis_results
            })

        except Exception as e:
            text_tx = AnalysisTransaction(
                user_id=current_user.id,
                source_type='text',
                input_ref=input_data[:500],
                status=AnalysisStatus.FAILED,
                plan_at_time=plan_key,
                items_count=analysis_item_count,
                input_size_bytes=len(input_data.encode('utf-8')),
                error_message=str(e),
                created_at=text_analysis_started_at,
                completed_at=_utc_now(),
            )
            db.session.add(text_tx)
            db.session.commit()
            flash(f"Error processing text input: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))

    # If no valid form submission, return an error message
    flash("Please submit a valid file, text, or URL.", "danger")
    return redirect(url_for('users.user_dashboard'))




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


@users_bp.route('/auth/session', methods=['GET'])
def auth_session():
    if not current_user.is_authenticated:
        return {'authenticated': False, 'user': None}, 200
    return {'authenticated': True, 'user': _serialize_auth_user(current_user)}, 200


@users_bp.route('/auth/login', methods=['POST'])
def auth_login():
    payload = request.get_json(silent=True) or request.form
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    ip_address = request.remote_addr or 'unknown'
    rate_key = f"{email}:{ip_address}"

    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    if _is_login_rate_limited(rate_key):
        _log_security_event(
            event_type='auth.login.rate_limited',
            severity='warning',
            details={'email': email},
        )
        db.session.commit()
        return {'error': 'Too many login attempts. Please try again later.'}, 429

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        _log_security_event(
            event_type='auth.login.failed',
            severity='warning',
            user_id=getattr(user, 'id', None),
            details={'email': email},
        )
        db.session.commit()
        return {'error': 'Invalid credentials.'}, 401

    if not bool(getattr(user, 'is_active', True)):
        _log_security_event(
            event_type='auth.login.deactivated_account',
            severity='warning',
            user_id=user.id,
            details={'email': email},
        )
        db.session.commit()
        return {'error': 'This account is deactivated.'}, 403

    user.last_login_at = _utc_now()
    _log_security_event(
        event_type='auth.login.success',
        severity='info',
        user_id=user.id,
        details={'email': email},
    )
    db.session.commit()
    login_user(user)
    return {'message': 'Login successful.', 'user': _serialize_auth_user(user)}, 200


@users_bp.route('/auth/signup', methods=['POST'])
def auth_signup():
    _sync_user_profile_columns()
    payload = request.get_json(silent=True) or request.form
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    first_name = (payload.get('first_name') or '').strip() or 'New'
    last_name = (payload.get('last_name') or '').strip() or 'User'
    phone_number = (payload.get('phone_number') or '').strip() or '0000000000'
    company = (payload.get('company') or '').strip() or None
    job_title = (payload.get('job_title') or '').strip() or None
    team_size = (payload.get('team_size') or '').strip() or None
    primary_use_case = (payload.get('primary_use_case') or '').strip() or None
    newsletter_opt_in = _parse_bool(payload.get('newsletter') or payload.get('newsletter_opt_in'))
    agreed_to_terms = _parse_bool(payload.get('agree_to_terms') or payload.get('agreed_to_terms'))
    gdpr_consent = _parse_bool(payload.get('gdpr_consent'))

    if not agreed_to_terms or not gdpr_consent:
        return {'error': 'You must accept the Terms and Privacy Policy and provide GDPR consent.'}, 400

    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    if len(password) < 6:
        return {'error': 'Password must be at least 6 characters.'}, 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return {'error': 'An account with this email already exists.'}, 400

    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    now = _utc_now()
    policy_version = current_app.config.get('GDPR_POLICY_VERSION', '2026-04')
    terms_version = current_app.config.get('TERMS_VERSION', policy_version)
    new_user = User(
        email=email,
        password=hashed_password,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        company=company,
        job_title=job_title,
        team_size=team_size,
        primary_use_case=primary_use_case,
        newsletter_opt_in=newsletter_opt_in,
        gdpr_consent_at=now,
        gdpr_consent_version=policy_version,
        privacy_policy_version=policy_version,
        terms_accepted_at=now,
        marketing_consent_at=now if newsletter_opt_in else None,
        role=UserRole.USER,
    )
    db.session.add(new_user)
    db.session.commit()

    _get_or_create_user_preference(new_user.id)
    _log_user_activity(
        new_user.id,
        event_type='account.created',
        description='Created account.',
        entity_type='user',
        entity_id=new_user.id,
    )
    _create_user_notification(
        new_user.id,
        notification_type='system',
        title='Welcome to GueInsight',
        message='Your account is ready. Complete your profile preferences to personalize your dashboard.',
        severity='info',
        action_url='/profile',
    )
    _log_security_event(
        event_type='auth.account.created',
        severity='info',
        user_id=new_user.id,
        details={'policy_version': policy_version, 'terms_version': terms_version},
    )
    db.session.commit()

    login_user(new_user)
    return {'message': 'Signup successful.', 'user': _serialize_auth_user(new_user)}, 201


@users_bp.route('/auth/logout', methods=['POST'])
def auth_logout():
    if current_user.is_authenticated:
        _log_security_event(
            event_type='auth.logout',
            severity='info',
            user_id=current_user.id,
        )
        db.session.commit()
        logout_user()
    return {'message': 'Logged out.'}, 200


@users_bp.route('/auth/privacy/consent', methods=['GET', 'PATCH'])
@login_required
def auth_privacy_consent():
    if request.method == 'GET':
        return {
            'consent': {
                'newsletter_opt_in': bool(current_user.newsletter_opt_in),
                'gdpr_consent_at': current_user.gdpr_consent_at.isoformat() if current_user.gdpr_consent_at else None,
                'gdpr_consent_version': current_user.gdpr_consent_version,
                'privacy_policy_version': current_user.privacy_policy_version,
                'terms_accepted_at': current_user.terms_accepted_at.isoformat() if current_user.terms_accepted_at else None,
                'marketing_consent_at': current_user.marketing_consent_at.isoformat() if current_user.marketing_consent_at else None,
            }
        }, 200

    payload = request.get_json(silent=True) or {}
    now = _utc_now()

    if 'newsletter_opt_in' in payload:
        newsletter_opt_in = _parse_bool(payload.get('newsletter_opt_in'))
        current_user.newsletter_opt_in = newsletter_opt_in
        current_user.marketing_consent_at = now if newsletter_opt_in else None

    if _parse_bool(payload.get('refresh_legal_consent')):
        policy_version = current_app.config.get('GDPR_POLICY_VERSION', '2026-04')
        current_user.gdpr_consent_at = now
        current_user.gdpr_consent_version = policy_version
        current_user.privacy_policy_version = policy_version
        current_user.terms_accepted_at = now

    _log_user_activity(
        current_user.id,
        event_type='privacy.consent.updated',
        description='Updated privacy consent settings.',
        entity_type='privacy',
    )
    _log_security_event(
        event_type='privacy.consent.updated',
        severity='info',
        user_id=current_user.id,
    )
    db.session.commit()

    return {
        'message': 'Consent settings updated.',
        'user': _serialize_auth_user(current_user),
    }, 200


@users_bp.route('/auth/privacy/export', methods=['POST'])
@login_required
def auth_privacy_export():
    export_request = DataExportRequest(user_id=current_user.id, status='processing', requested_at=_utc_now())
    db.session.add(export_request)
    db.session.flush()

    export_payload = _build_privacy_export_payload(current_user)
    export_path = _write_privacy_export(current_user.id, export_request.id, export_payload)
    download_token = _privacy_export_serializer().dumps({
        'request_id': export_request.id,
        'user_id': current_user.id,
    })

    export_request.status = 'completed'
    export_request.completed_at = _utc_now()
    export_request.download_token = download_token

    _log_user_activity(
        current_user.id,
        event_type='privacy.data_exported',
        description='Exported personal account data.',
        entity_type='privacy',
        metadata={'export_request_id': export_request.id, 'export_path': export_path},
    )
    _log_security_event(
        event_type='privacy.data_exported',
        severity='info',
        user_id=current_user.id,
        details={'export_request_id': export_request.id},
    )
    db.session.commit()

    return {
        'message': 'Data export generated.',
        'download_url': url_for('users.auth_privacy_export_download', token=download_token, _external=False),
        'export': export_payload,
        'request': export_request.to_dict(),
    }, 200


@users_bp.route('/auth/privacy/export/download/<token>', methods=['GET'])
@login_required
def auth_privacy_export_download(token):
    try:
        token_payload = _privacy_export_serializer().loads(token, max_age=86400)
    except Exception:
        return {'error': 'Invalid or expired export token.'}, 400

    if int(token_payload.get('user_id') or 0) != current_user.id:
        return {'error': 'Forbidden.'}, 403

    export_request = DataExportRequest.query.filter_by(
        id=token_payload.get('request_id'),
        user_id=current_user.id,
        download_token=token,
        status='completed',
    ).first()
    if not export_request:
        return {'error': 'Export request not found.'}, 404

    export_path = os.path.join(_privacy_export_dir(), f'user_{current_user.id}_export_{export_request.id}.json')
    if not os.path.exists(export_path):
        return {'error': 'Export file not found.'}, 404

    _log_user_activity(
        current_user.id,
        event_type='privacy.data_export_downloaded',
        description='Downloaded exported personal account data.',
        entity_type='privacy',
        metadata={'export_request_id': export_request.id},
    )
    _log_security_event(
        event_type='privacy.data_export_downloaded',
        severity='info',
        user_id=current_user.id,
        details={'export_request_id': export_request.id},
    )
    db.session.commit()

    return send_file(
        export_path,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'gueinsight-data-export-{current_user.id}-{export_request.id}.json',
    )


@users_bp.route('/auth/privacy/delete-request', methods=['POST'])
@login_required
def auth_privacy_delete_request():
    payload = request.get_json(silent=True) or {}
    reason = (payload.get('reason') or '').strip() or None

    existing_pending = (
        DataDeletionRequest.query
        .filter_by(user_id=current_user.id, status='pending')
        .order_by(DataDeletionRequest.requested_at.desc())
        .first()
    )
    if existing_pending:
        return {
            'error': 'A deletion request is already pending for this account.',
            'request': existing_pending.to_dict(),
        }, 409

    deletion_request = DataDeletionRequest(
        user_id=current_user.id,
        reason=reason,
        status='pending',
        requested_at=_utc_now(),
    )
    current_user.is_active = False
    db.session.add(deletion_request)

    _log_user_activity(
        current_user.id,
        event_type='privacy.deletion_requested',
        description='Submitted account deletion request.',
        entity_type='privacy',
    )
    _log_security_event(
        event_type='privacy.deletion_requested',
        severity='warning',
        user_id=current_user.id,
        details={'reason': reason},
    )
    db.session.commit()

    logout_user()
    return {
        'message': 'Deletion request submitted. Account has been deactivated pending review.',
        'request': deletion_request.to_dict(),
    }, 202


@users_bp.route('/auth/profile', methods=['PATCH'])
@login_required
def auth_update_profile():
    _sync_user_profile_columns()
    payload = request.get_json(silent=True) or {}

    editable_fields = {
        'first_name': (payload.get('first_name') or '').strip(),
        'last_name': (payload.get('last_name') or '').strip(),
        'phone_number': (payload.get('phone_number') or '').strip(),
        'company': (payload.get('company') or '').strip() or None,
        'job_title': (payload.get('job_title') or '').strip() or None,
        'primary_use_case': (payload.get('primary_use_case') or '').strip() or None,
        'newsletter_opt_in': bool(payload.get('newsletter_opt_in')),
    }

    if not editable_fields['first_name'] or not editable_fields['last_name']:
        return {'error': 'First name and last name are required.'}, 400

    if not editable_fields['phone_number']:
        return {'error': 'Phone number is required.'}, 400

    current_user.first_name = editable_fields['first_name']
    current_user.last_name = editable_fields['last_name']
    current_user.phone_number = editable_fields['phone_number']
    current_user.company = editable_fields['company']
    current_user.job_title = editable_fields['job_title']
    current_user.primary_use_case = editable_fields['primary_use_case']
    current_user.newsletter_opt_in = editable_fields['newsletter_opt_in']
    db.session.commit()

    _log_user_activity(
        current_user.id,
        event_type='profile.updated',
        description='Updated profile details.',
        entity_type='profile',
    )
    db.session.commit()

    return {'message': 'Profile updated.', 'user': _serialize_auth_user(current_user)}, 200


@users_bp.route('/auth/preferences', methods=['GET', 'PATCH'])
@login_required
def auth_preferences():
    preference = _get_or_create_user_preference(current_user.id)

    if request.method == 'GET':
        return {'preferences': preference.to_dict()}, 200

    payload = request.get_json(silent=True) or {}
    allowed_fields = {
        'avatar_url',
        'theme',
        'timezone',
        'language',
        'notification_email_enabled',
        'notification_inapp_enabled',
        'dashboard_layout',
    }

    for field_name in allowed_fields:
        if field_name in payload:
            setattr(preference, field_name, payload.get(field_name))

    db.session.commit()
    _log_user_activity(
        current_user.id,
        event_type='preferences.updated',
        description='Updated profile preferences.',
        entity_type='profile',
    )
    db.session.commit()

    return {'message': 'Preferences updated.', 'preferences': preference.to_dict(), 'user': _serialize_auth_user(current_user)}, 200


@users_bp.route('/auth/notifications', methods=['GET'])
@login_required
def auth_notifications():
    unread_only = str(request.args.get('unread_only') or '').lower() in {'1', 'true', 'yes'}
    limit = request.args.get('limit', default=25, type=int)
    limit = max(1, min(limit, 100))

    query = UserNotification.query.filter_by(user_id=current_user.id)
    if unread_only:
        query = query.filter_by(is_read=False)

    notifications = query.order_by(UserNotification.created_at.desc()).limit(limit).all()
    unread_count = UserNotification.query.filter_by(user_id=current_user.id, is_read=False).count()

    return {
        'notifications': [notification.to_dict() for notification in notifications],
        'unread_count': unread_count,
    }, 200


@users_bp.route('/auth/notifications/<int:notification_id>/read', methods=['PATCH'])
@login_required
def auth_notifications_mark_read(notification_id):
    notification = UserNotification.query.filter_by(id=notification_id, user_id=current_user.id).first()
    if not notification:
        return {'error': 'Notification not found.'}, 404

    notification.is_read = True
    notification.read_at = _utc_now()
    db.session.commit()

    unread_count = UserNotification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return {'message': 'Notification marked as read.', 'notification': notification.to_dict(), 'unread_count': unread_count}, 200


@users_bp.route('/auth/notifications/read_all', methods=['POST'])
@login_required
def auth_notifications_mark_all_read():
    now = _utc_now()
    notifications = UserNotification.query.filter_by(user_id=current_user.id, is_read=False).all()
    for notification in notifications:
        notification.is_read = True
        notification.read_at = now
    db.session.commit()

    return {'message': 'All notifications marked as read.', 'unread_count': 0}, 200


@users_bp.route('/auth/transactions', methods=['GET'])
@login_required
def auth_transactions():
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 100))

    analysis_rows = (
        AnalysisTransaction.query
        .filter_by(user_id=current_user.id)
        .order_by(AnalysisTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    activity_rows = (
        UserActivityEvent.query
        .filter_by(user_id=current_user.id)
        .order_by(UserActivityEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    billing_rows = (
        BillingTransaction.query
        .filter_by(user_id=current_user.id)
        .order_by(BillingTransaction.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        'analysis_transactions': [row.to_dict() for row in analysis_rows],
        'activity_events': [row.to_dict() for row in activity_rows],
        'billing_transactions': [row.to_dict() for row in billing_rows],
    }, 200


@users_bp.route('/auth/subscription/upgrade', methods=['POST'])
@login_required
def auth_upgrade_subscription():
    payload = request.get_json(silent=True) or request.form
    requested_plan = str(payload.get('plan') or '').strip().lower()

    plan_aliases = {
        'starter': 'premium_individual',
        'growth': 'premium_small_business',
        'scale': 'premium_large_business',
        'premium': 'premium_individual',
    }
    normalized_plan = plan_aliases.get(requested_plan, requested_plan)
    allowed_plans = {'premium_individual', 'premium_small_business', 'premium_large_business'}

    if normalized_plan not in allowed_plans:
        return {
            'error': 'Invalid plan. Use premium_individual, premium_small_business, or premium_large_business.'
        }, 400

    now = _utc_now()
    current_subscription = (
        Subscription.query
        .filter_by(user_id=current_user.id)
        .order_by(Subscription.end_date.desc())
        .first()
    )

    current_plan = str(getattr(current_subscription, 'plan', '') or '').lower()
    if current_subscription and current_plan == normalized_plan and current_subscription.end_date and current_subscription.end_date >= now:
        return {'error': 'You are already on this active plan.'}, 400

    start_date = now
    if current_subscription and current_subscription.end_date and current_subscription.end_date > now:
        start_date = current_subscription.end_date

    new_subscription = Subscription(
        user_id=current_user.id,
        plan=normalized_plan,
        start_date=start_date,
        end_date=start_date + timedelta(days=30),
    )
    db.session.add(new_subscription)

    plan_amount_minor = {
        'premium_individual': 1900,
        'premium_small_business': 5900,
        'premium_large_business': 14900,
    }
    billing_transaction = BillingTransaction(
        user_id=current_user.id,
        subscription=new_subscription,
        provider='internal',
        provider_txn_id=f"local-{current_user.id}-{int(now.timestamp())}",
        amount_minor=plan_amount_minor.get(normalized_plan, 0),
        currency='usd',
        status=BillingStatus.SUCCEEDED,
        period_start=start_date,
        period_end=start_date + timedelta(days=30),
    )
    db.session.add(billing_transaction)

    _log_user_activity(
        current_user.id,
        event_type='subscription.upgraded',
        description=f'Upgraded to {normalized_plan}.',
        entity_type='subscription',
        metadata={'plan': normalized_plan},
    )
    _create_user_notification(
        current_user.id,
        notification_type='plan',
        title='Plan upgrade successful',
        message=f'Your plan is now {normalized_plan}.',
        severity='info',
        action_url='/profile',
    )
    db.session.commit()

    return {
        'message': 'Plan upgraded successfully.',
        'subscription': {
            'id': new_subscription.id,
            'plan': new_subscription.plan,
            'start_date': new_subscription.start_date.isoformat() if new_subscription.start_date else None,
            'end_date': new_subscription.end_date.isoformat() if new_subscription.end_date else None,
        },
        'user': _serialize_auth_user(current_user),
    }, 200


@users_bp.route('/support_tickets', methods=['GET', 'POST'])
@login_required
def support_tickets():
    if request.method == 'GET':
        tickets = (
            SupportTicket.query
            .filter_by(user_id=current_user.id)
            .order_by(SupportTicket.created_at.desc())
            .all()
        )
        return {
            'tickets': [ticket.to_dict() for ticket in tickets],
        }, 200

    payload = request.get_json(silent=True) or request.form
    subject = (payload.get('subject') or '').strip()
    description = (payload.get('description') or '').strip()
    category = (payload.get('category') or '').strip() or None
    priority = (payload.get('priority') or 'medium').strip().lower()

    if not subject or not description:
        return {'error': 'Subject and description are required.'}, 400

    if priority not in {'low', 'medium', 'high', 'urgent'}:
        return {'error': 'Priority must be low, medium, high, or urgent.'}, 400

    ticket = SupportTicket(
        user_id=current_user.id,
        subject=subject,
        description=description,
        category=category,
        priority=priority,
        status=SupportTicketStatus.OPEN,
    )
    db.session.add(ticket)
    db.session.commit()

    return {'message': 'Support ticket created.', 'ticket': ticket.to_dict()}, 201
