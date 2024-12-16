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
from app.utils import generate_report
from utils.utils import OutputHandler


# Create blueprint for user routes
users_bp = Blueprint('users', __name__)



@users_bp.route('/profile', methods=['GET'])
@login_required
def user_profile():
    form = ProfileForm()  # Initialize the form here
    return render_template('user_profile.html', form=form)


# Subscription creation and payment
@users_bp.route('/subscribe', methods=['GET', 'POST'])
@login_required
def subscribe():
    """Handle subscription creation and payment."""
    if request.method == 'POST':
        plan_type = request.form.get('plan_type')
        plans = {
            'premium_individual': 100,
            'premium_small_business': 200,
            'premium_large_business': 300,
        }
        amount = plans.get(plan_type)

        if not amount:
            flash("Invalid plan type selected.", "danger")
            return redirect(url_for('users.subscribe'))

        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=amount,
                currency='eur',
                metadata={'plan_type': plan_type, 'user_id': current_user.id}
            )
            client_secret = payment_intent.client_secret
            return render_template('payment.html', client_secret=client_secret, plan_type=plan_type)

        except stripe.error.StripeError as e:
            flash(f"Stripe Error: {e.user_message}", "danger")
            return redirect(url_for('users.subscribe'))

    return render_template('subscribe.html')


# Confirm subscription after successful payment
@users_bp.route('/confirm_subscription', methods=['POST'])
@login_required
def confirm_subscription():
    payment_intent_id = request.form.get('payment_intent_id')
    payment_method_id = request.form.get('payment_method_id')
    plan_type = request.form.get('plan_type')

    if not payment_intent_id or not payment_method_id or not plan_type:
        flash("Missing payment information.", "danger")
        return redirect(url_for('users.subscribe'))

    try:
        subscription_service = SubscriptionService(current_user.id)
        success = subscription_service.confirm_payment(payment_intent_id, payment_method_id)

        if success:
            flash(f"Subscription to {plan_type} plan successfully activated.", "success")
            return redirect(url_for('users.user_dashboard'))

        flash("Payment failed. Please try again.", "danger")
        return redirect(url_for('users.subscribe'))

    except Exception as e:
        flash(f"Error processing payment: {str(e)}", "danger")
        return redirect(url_for('users.subscribe'))


# Process payment and activate subscription
@users_bp.route('/process_payment', methods=['POST'])
@login_required
def process_payment():
    plan_type = request.form.get('plan_type')
    payment_intent_id = request.form.get('payment_intent_id')

    try:
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        if payment_intent.status != 'succeeded':
            flash("Payment not successful. Please try again.", "danger")
            return redirect(url_for('users.subscribe'))

        current_user.subscription_plan = plan_type
        current_user.subscription_start = datetime.utcnow()
        current_user.subscription_end = datetime.utcnow() + timedelta(days=30)
        db.session.commit()

        flash("Subscription activated successfully!", "success")
        return redirect(url_for('users.user_dashboard'))

    except stripe.error.StripeError as e:
        flash(f"Stripe Error: {e.user_message}", "danger")
        return redirect(url_for('users.subscribe'))

    except Exception as e:
        flash(f"Error processing payment: {str(e)}", "danger")
        return redirect(url_for('users.subscribe'))


# Handle login
@users_bp.route('/user_login', methods=['GET', 'POST'])
def user_login():
    form = LoginForm()

    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()

        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            flash('Login successful.', 'success')
            return redirect(next_page or url_for('users.user_dashboard'))

        flash('Login failed. Please check your credentials and try again.', 'danger')

    return render_template('user_login.html', form=form)

@users_bp.route('/user_signup', methods=['GET', 'POST'])
def user_signup():
    form = SignupForm()

    if form.validate_on_submit():
        email = form.email.data
        password = form.password.data
        confirm_password = form.confirm_password.data
        first_name = form.first_name.data
        last_name = form.last_name.data
        phone_number = form.phone_number.data
        country_of_residence = form.country_of_residence.data
        subscription_plan = form.subscription_plan.data

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('user_signup.html', form=form)

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('An account with this email already exists.', 'danger')
            return render_template('user_signup.html', form=form)

        # Use a different method if scrypt is not available
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')


        # Create a new user
        new_user = User(
            email=email,
            password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            role=UserRole.USER
        )
        db.session.add(new_user)
        db.session.commit()

        # Set subscription start and end dates
        start_date = datetime.utcnow()
        if subscription_plan == 'freemium':
            end_date = start_date + timedelta(days=30)  # Free for 30 days
        else:
            end_date = start_date + timedelta(days=30)  # Premium also starts with 30 days

        # Create a new subscription
        subscription = Subscription(
            user_id=new_user.id,
            plan=subscription_plan,
            start_date=start_date,
            end_date=end_date
        )
        db.session.add(subscription)
        db.session.commit()

        flash('Account created successfully. Please log in.', 'success')
        return redirect(url_for('users.user_login'))

    return render_template('user_signup.html', form=form)




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
            # Process the cloud link
            analysis_results = analyze_cloud_link(cloud_link)
            return jsonify({
                'status': 'success',
                'message': 'Cloud link processed successfully.',
                'results': analysis_results
            })

        except Exception as e:
            flash(f"Error processing cloud link: {str(e)}", "danger")
            return redirect(url_for('users.user_dashboard'))

    # Handle Text/Hash Submission
    elif text_submission_form.validate_on_submit() and text_submission_form.pasted_input.data:
        input_data = text_submission_form.pasted_input.data
        try:
            # Process the text/hash input
            analysis_results = analyze_text_for_security(input_data)
            return jsonify({
                'status': 'success',
                'message': 'Text processed successfully.',
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
        if user:
            s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
            token = s.dumps(email, salt=current_app.config['SECURITY_PASSWORD_SALT'])
            reset_url = url_for('reset_password', token=token, _external=True)
            send_reset_email(email, reset_url)
            flash("A reset link has been sent to your email.", "info")
            return redirect(url_for('login'))
        flash("No user found with that email.", "danger")

    return render_template('forgot_password.html')



@users_bp.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('user_dashboard'))

    try:
        # Verify the reset token
        email = verify_reset_token(token)
    except ValueError:
        flash('The reset token is invalid or has expired.', 'danger')
        return redirect(url_for('reset_request'))

    # Use a form to validate the password
    form = ResetPasswordForm()
    if form.validate_on_submit():
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
    if request.method == 'POST':
        current_user.role = 'premium'
        current_user.subscription_active = True
        current_user.subscription_start_date = datetime.now()
        current_user.subscription_end_date = datetime.now() + timedelta(days=30)  # Example duration
        db.session.commit()
        flash('Successfully upgraded to Premium.', 'success')
        return redirect(url_for('users.user_dashboard'))
    
    # Determine subscription status
    subscription_status = get_subscription_status(current_user)
    return render_template(
        'upgrade_subscription.html',
        subscription_status=subscription_status
    )



@users_bp.route('/downgrade_subscription', methods=['GET', 'POST'])
@login_required
def downgrade_subscription():
    if request.method == 'POST':
        current_user.role = 'free'
        current_user.subscription_active = False
        current_user.subscription_end_date = None
        db.session.commit()
        flash('Successfully downgraded to Free Plan.', 'success')
        return redirect(url_for('users.user_dashboard'))
    
    # Determine subscription status
    subscription_status = get_subscription_status(current_user)
    return render_template(
        'downgrade_subscription.html',
        subscription_status=subscription_status
    )

@users_bp.route('/cancel_subscription', methods=['GET', 'POST'])
@login_required
def cancel_subscription():
    if request.method == 'POST':
        current_user.subscription_active = False
        current_user.subscription_end_date = None
        current_user.role = 'free'
        db.session.commit()
        flash('Your subscription has been canceled.', 'info')
        return redirect(url_for('users.user_dashboard'))
    
    # Determine subscription status
    subscription_status = get_subscription_status(current_user)
    return render_template(
        'cancel_subscription.html',
        subscription_status=subscription_status
    )


@users_bp.route('/get_analysis_data', methods=['GET'])
def get_analysis_data():
    """
    Fetch analysis results for the current user to display on the dashboard chart.
    """
    try:
        # Replace this with the actual method to fetch user-specific data
        user_id = current_user.id  # Assuming Flask-Login for user authentication
        
        # Example: Query the database or analysis results directory
        analysis_results_path = os.path.join(
            current_app.config['UPLOAD_FOLDER'], f"user_{user_id}_results"
        )
        
        # Aggregate results (example for structured JSON file-based results)
        categories = ['Malware', 'Phishing', 'Ransomware']
        values = [0, 0, 0]
        
        if os.path.exists(analysis_results_path):
            for file_name in os.listdir(analysis_results_path):
                file_path = os.path.join(analysis_results_path, file_name)
                
                # Assume results are stored in JSON format per file
                with open(file_path, 'r') as file:
                    analysis_data = json.load(file)
                    
                    # Increment category counts based on analysis_data
                    for i, category in enumerate(categories):
                        values[i] += analysis_data.get(category, 0)

        # Return the aggregated data as JSON
        return jsonify({"categories": categories, "values": values})

    except Exception as e:
        current_app.logger.error(f"Error fetching analysis data: {str(e)}")
        return jsonify({"error": "Failed to fetch analysis data"}), 500
