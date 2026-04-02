import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required, current_user, login_user, logout_user
import stripe
from datetime import datetime, timedelta
from app.models import User, Subscription, UserRole, db, Alert, AlertRule
from app.forms import LoginForm, ResetPasswordForm, SignupForm, SubmitCloudLinkForm, SubmitTextForm, UploadFileForm, LogoutForm, ProfileForm, AlertRuleForm
from app.subscription_service import SubscriptionService
from app.src.analysis.file_analysis import analyze_text_for_security, analyze_cloud_link
from app.src.preprocessing.preprocess import preprocess_text
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
from app.utils.utils import generate_report, OutputHandler
from sqlalchemy import inspect, text

# Create blueprint for user routes
users_bp = Blueprint('users', __name__)

_USER_SCHEMA_SYNCED = False


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

        # Check the file type
        allowed_extensions = Config.ALLOWED_EXTENSIONS  # Get allowed file types from config
        file_extension = secure_filename(uploaded_file.filename).split('.')[-1].lower()

        if file_extension not in allowed_extensions:
            flash("Invalid file type. Please upload a valid file.", "danger")
            return redirect(url_for('users.user_dashboard'))

        # Check if the file size is within the allowed limit
        if len(uploaded_file.read()) > Config.MAX_CONTENT_LENGTH:
            flash("File size exceeds the 16MB limit. Please upload a smaller file.", "danger")
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

            # Render the results page
            return render_template('results.html', 
                                   results=analysis_results, 
                                   visualization=visualization_result,
                                   report_link='/Users/gabrielaloho/gueInsight/app/user_reports')  # Replace with actual path
        except Exception as e:
            flash(f"Error processing file: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))


    # Handle URL Submission

    elif url_submission_form.validate_on_submit() and url_submission_form.cloud_link.data:
        cloud_link = url_submission_form.cloud_link.data
        try:
            # Threat intelligence enrichment
            from app.integrations.rapidapi import enrich_url
            enrichment = enrich_url(cloud_link)
            # Process the cloud link (analysis)
            analysis_results = analyze_cloud_link(cloud_link)
            return jsonify({
                'status': 'success',
                'message': 'Cloud link processed successfully.',
                'enrichment': enrichment,
                'results': analysis_results
            })

        except Exception as e:
            flash(f"Error processing cloud link: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))

    # Handle Text/Hash Submission

    elif text_submission_form.validate_on_submit() and text_submission_form.pasted_input.data:
        input_data = text_submission_form.pasted_input.data
        try:
            # Threat intelligence enrichment (try as hash, IP, or URL)
            from app.integrations.rapidapi import enrich_event
            enrichment = enrich_event({'hash': input_data, 'ip': input_data, 'url': input_data})
            # Process the text/hash input (analysis)
            analysis_results = analyze_text_for_security(input_data)
            return jsonify({
                'status': 'success',
                'message': 'Text processed successfully.',
                'enrichment': enrichment,
                'results': analysis_results
            })

        except Exception as e:
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
    latest_subscription = (
        Subscription.query
        .filter_by(user_id=user.id)
        .order_by(Subscription.end_date.desc())
        .first()
    )
    current_plan = getattr(latest_subscription, 'plan', None) or 'Free'
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
        'role': role_value,
        'current_plan': current_plan,
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

    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return {'error': 'Invalid credentials.'}, 401

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
    newsletter_opt_in = bool(payload.get('newsletter') or payload.get('newsletter_opt_in'))

    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    if len(password) < 6:
        return {'error': 'Password must be at least 6 characters.'}, 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return {'error': 'An account with this email already exists.'}, 400

    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
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
        role=UserRole.USER,
    )
    db.session.add(new_user)
    db.session.commit()

    login_user(new_user)
    return {'message': 'Signup successful.', 'user': _serialize_auth_user(new_user)}, 201


@users_bp.route('/auth/logout', methods=['POST'])
def auth_logout():
    if current_user.is_authenticated:
        logout_user()
    return {'message': 'Logged out.'}, 200


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

    return {'message': 'Profile updated.', 'user': _serialize_auth_user(current_user)}, 200
