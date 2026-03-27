import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required, current_user, login_user
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

# Create blueprint for user routes
users_bp = Blueprint('users', __name__)










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
