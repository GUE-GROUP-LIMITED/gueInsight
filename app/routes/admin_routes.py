
from flask import Blueprint, request, redirect, url_for, flash
from flask_login import login_required, current_user, login_user, logout_user
from werkzeug.security import generate_password_hash
from app import db
from app.models import User, Logs, FileUpload, UserRole, Alert, AlertRule
from app.forms import AdminLoginForm, AdminSignupForm, AlertRuleForm
from app.utils.utils import check_admin_role  
from app.admin_services import some_condition_for_critical_alert
from app.utils.decorators import admin_required

# Blueprint for admin routes
admin_bp = Blueprint('admin', __name__)

# View all triggered alerts (admin)
@admin_bp.route('/alerts')
@login_required
def admin_alerts():
    check_admin_role(current_user)
    alerts = Alert.query.join(Alert.event).filter_by(source='analysis').all()
    # API endpoint: return alerts as JSON
    return {"alerts": [a.to_dict() for a in alerts]}

# List, create, edit, enable/disable, and delete global alert rules (admin)
@admin_bp.route('/alert_rules', methods=['GET', 'POST'])
@login_required
def admin_alert_rules():
    check_admin_role(current_user)
    form = AlertRuleForm()
    global_rules = AlertRule.query.filter_by(user_id=None).all()
    if form.validate_on_submit():
        new_rule = AlertRule(
            user_id=None,
            rule_type=form.rule_type.data,
            value=form.value.data,
            severity=form.severity.data,
            enabled=form.enabled.data
        )
        db.session.add(new_rule)
        db.session.commit()
        flash('Global alert rule created successfully.', 'success')
        return redirect(url_for('admin.admin_alert_rules'))
    # API endpoint: return alert rules as JSON
    return {"alert_rules": [r.to_dict() for r in global_rules]}

@admin_bp.route('/alert_rules/edit/<int:rule_id>', methods=['GET', 'POST'])
@login_required
def edit_admin_alert_rule(rule_id):
    check_admin_role(current_user)
    rule = AlertRule.query.get_or_404(rule_id)
    if rule.user_id is not None:
        flash('Not a global rule.', 'danger')
        return redirect(url_for('admin.admin_alert_rules'))
    form = AlertRuleForm(obj=rule)
    if form.validate_on_submit():
        rule.rule_type = form.rule_type.data
        rule.value = form.value.data
        rule.severity = form.severity.data
        rule.enabled = form.enabled.data
        db.session.commit()
        flash('Global alert rule updated.', 'success')
        return redirect(url_for('admin.admin_alert_rules'))
    # API endpoint: return rule as JSON
    return {"rule": rule.to_dict()}

@admin_bp.route('/alert_rules/delete/<int:rule_id>', methods=['POST'])
@login_required
def delete_admin_alert_rule(rule_id):
    check_admin_role(current_user)
    rule = AlertRule.query.get_or_404(rule_id)
    if rule.user_id is not None:
        flash('Not a global rule.', 'danger')
        return redirect(url_for('admin.admin_alert_rules'))
    db.session.delete(rule)
    db.session.commit()
    flash('Global alert rule deleted.', 'success')
    return redirect(url_for('admin.admin_alert_rules'))

@admin_bp.route('/alert_rules/toggle/<int:rule_id>', methods=['POST'])
@login_required
def toggle_admin_alert_rule(rule_id):
    check_admin_role(current_user)
    rule = AlertRule.query.get_or_404(rule_id)
    if rule.user_id is not None:
        flash('Not a global rule.', 'danger')
        return redirect(url_for('admin.admin_alert_rules'))
    rule.enabled = not rule.enabled
    db.session.commit()
    flash('Global alert rule status updated.', 'success')
    return redirect(url_for('admin.admin_alert_rules'))


@admin_bp.route('/admin_login', methods=['GET', 'POST'])
def admin_login():
    # Redirect to admin dashboard if already logged in
    if current_user.is_authenticated:
        return redirect(url_for('admin.admin_dashboard'))

    form = AdminLoginForm()

    if form.validate_on_submit():
        email = form.email.data
        password = form.password.data

        # Query user by email
        user = User.query.filter_by(email=email).first()

        if user and user.role == 'admin' and user.check_password(password):
            login_user(user)
            flash('Login successful!', 'success')
            return redirect(url_for('admin.admin_dashboard'))  # Redirect after successful login

        flash('Invalid credentials or insufficient permissions.', 'danger')

    # API endpoint: login form not rendered
    return {"message": "Login required"}, 401



@admin_bp.route('/admin_signup', methods=['GET', 'POST'])
def admin_signup():
    form = AdminSignupForm()

    if form.validate_on_submit():
        email = form.email.data
        password = form.password.data
        confirm_password = form.confirm_password.data
        first_name = form.first_name.data
        last_name = form.last_name.data
        phone_number = form.phone_number.data
        country_of_residence = form.country_of_residence.data

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return {"error": "Passwords do not match."}, 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('An account with this email already exists.', 'danger')
            return {"error": "Account exists."}, 400

        # Use a different method if scrypt is not available
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')


        # Create a new user
        new_user = User(
            email=email,
            password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            role=UserRole.ADMIN
        )
        db.session.add(new_user)
        db.session.commit()

     
        flash('Account created successfully. Please log in.', 'success')
        return redirect(url_for('admin.aadmin_login'))

    return {"message": "Signup required"}, 401

@admin_bp.route('/admin_dashboard', methods=['GET', 'POST'])
@login_required
def admin_dashboard():
    check_admin_role(current_user)  # Ensure current user is an admin

    # Handle Search and Filter for Users
    search_query = request.args.get('search', '')
    role_filter = request.args.get('role', '')
    users = User.query.filter(
        User.email.contains(search_query),
        User.role.contains(role_filter)
    ).all()

    # Handle Adding a New User
    if request.method == 'POST':
        # Define the function to handle new user addition
        def handle_new_user_addition(form_data):
            email = form_data.get('email')
            password = form_data.get('password')
            confirm_password = form_data.get('confirm_password')
            first_name = form_data.get('first_name')
            last_name = form_data.get('last_name')
            phone_number = form_data.get('phone_number')
            country_of_residence = form_data.get('country_of_residence')

            if password != confirm_password:
                flash('Passwords do not match.', 'danger')
                return

            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                flash('An account with this email already exists.', 'danger')
                return

            hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

            new_user = User(
                email=email,
                password=hashed_password,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number,
                role=UserRole.ADMIN
            )
            db.session.add(new_user)
            db.session.commit()

            flash('Account created successfully.', 'success')

        handle_new_user_addition(request.form)

    # Fetch File Uploads and Reports for the Dashboard
    file_uploads = FileUpload.query.all()

    # Check if there is a critical alert
    critical_alert = some_condition_for_critical_alert()

    # API endpoint: return dashboard data as JSON
    return {"users": [u.to_dict() for u in users], "file_uploads": [f.to_dict() for f in file_uploads], "critical_alert": critical_alert}


# View logs (Only accessible to admins)
@admin_bp.route('/view_logs')
@login_required
def view_logs():
    check_admin_role(current_user)  # Ensure current user is an admin

    logs = Logs.query.all()
    # API endpoint: return logs as JSON
    return {"logs": [l.to_dict() for l in logs]}


# View user activity logs (Only accessible to admins)
@admin_bp.route('/view_user_activity/<int:user_id>')
@login_required
def view_user_activity(user_id):
    check_admin_role(current_user)  # Ensure current user is an admin

    logs = Logs.query.filter_by(user_id=user_id).all()
    user = User.query.get_or_404(user_id)
    # API endpoint: return user activity as JSON
    return {"logs": [l.to_dict() for l in logs], "user": user.to_dict()}


# Delete user (Only accessible to admins)
@admin_bp.route('/delete_user/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    check_admin_role(current_user)  # Ensure current user is an admin

    user_to_delete = User.query.get_or_404(user_id)
    db.session.delete(user_to_delete)
    db.session.commit()
    flash('User deleted successfully!', 'success')
    return redirect(url_for('admin.admin_dashboard'))


# Edit user (Only accessible to admins)
@admin_bp.route('/edit_user/<int:user_id>', methods=['GET', 'POST'])
@login_required
def edit_user(user_id):
    check_admin_role(current_user)  # Ensure current user is an admin

    user = User.query.get_or_404(user_id)

    if request.method == 'POST':
        user.email = request.form.get('email', user.email)
        user.first_name = request.form.get('first_name', user.first_name)
        user.last_name = request.form.get('last_name', user.last_name)
        user.role = request.form.get('role', user.role)

        new_password = request.form.get('password')
        if new_password:
            user.password = generate_password_hash(new_password)

        db.session.commit()
        flash('User updated successfully!', 'success')
        return redirect(url_for('admin.admin_dashboard'))

    # API endpoint: return user as JSON
    return {"user": user.to_dict()}

# Logout
@admin_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))





admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@login_required
@admin_required
def admin_dashboard():
    user_count = User.query.count()
    recent_users = User.query.order_by(User.id.desc()).limit(5).all()
    # API endpoint: return dashboard summary as JSON
    return {"user_count": user_count, "recent_users": [u.to_dict() for u in recent_users]}

@admin_bp.route('/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        admin = User.query.filter_by(email=email, role='admin').first()
        if admin and admin.check_password(password):
            login_user(admin)
            return redirect(url_for('admin.admin_dashboard'))
        flash('Invalid credentials', 'error')
    return {"message": "Login required"}, 401

@admin_bp.route('/logout', methods=['GET'])
@login_required
def admin_logout():
    logout_user()
    return redirect(url_for('admin.admin_login'))

@admin_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def manage_users():
    users = User.query.all()
    return {"users": [u.to_dict() for u in users]}

@admin_bp.route('/logs', methods=['GET'])
@login_required
@admin_required
def view_logs():
    with open('logs/app.log', 'r') as log_file:
        logs = log_file.readlines()
    return {"logs": logs}

@admin_bp.route('/settings', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_settings():
    if request.method == 'POST':
        # Update settings logic
        flash('Settings updated!', 'success')
    return {"message": "Settings endpoint"}
