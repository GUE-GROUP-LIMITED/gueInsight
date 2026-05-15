
import os
from datetime import datetime, timezone
from flask import Blueprint, request, redirect, url_for, flash, abort
from flask_login import login_required, current_user, login_user, logout_user
from werkzeug.security import generate_password_hash
from sqlalchemy import true
from app import db
from app.models import User, Logs, FileUpload, UserRole, Alert, AlertRule, Subscription, SupportTicket, SupportTicketStatus, DataDeletionRequest, SecurityEvent, NIS2IncidentReport
from app.forms import AdminLoginForm, AdminSignupForm, AlertRuleForm
from app.utils.utils import check_admin_role  
from app.admin_services import some_condition_for_critical_alert
from app.utils.decorators import admin_required

# Blueprint for admin routes
admin_bp = Blueprint('admin', __name__)


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _is_admin(user):
    role = getattr(user, 'role', None)
    role_value = getattr(role, 'value', role)
    return role_value == 'admin'


def _is_super_admin(user):
    if not user:
        return False

    configured_email = (os.getenv('SUPER_ADMIN_EMAIL') or '').strip().lower()
    user_email = (getattr(user, 'email', None) or '').strip().lower()

    if configured_email:
        return user_email == configured_email

    # Fallback: if SUPER_ADMIN_EMAIL is not configured, treat the earliest admin
    # account as super admin so existing environments still work.
    first_admin = (
        User.query
        .filter(User.role == UserRole.ADMIN)
        .order_by(User.created_at.asc())
        .first()
    )
    return bool(first_admin and first_admin.id == user.id)


def _serialize_admin_user(user):
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
        'is_active': bool(getattr(user, 'is_active', True)),
        'created_at': user.created_at.isoformat() if getattr(user, 'created_at', None) else None,
        'current_plan': current_plan,
        'plan_expires_at': latest_subscription.end_date.isoformat() if latest_subscription and latest_subscription.end_date else None,
    }


def _serialize_file_upload(upload):
    return {
        'id': upload.id,
        'user_id': upload.user_id,
        'file_path': upload.file_path,
        'upload_date': upload.upload_date.isoformat() if upload.upload_date else None,
    }


def _serialize_subscription(subscription):
    if not subscription:
        return None
    return {
        'id': subscription.id,
        'plan': subscription.plan,
        'start_date': subscription.start_date.isoformat() if subscription.start_date else None,
        'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
    }


def _serialize_support_ticket(ticket):
    return {
        'id': ticket.id,
        'user_id': ticket.user_id,
        'user_email': ticket.user.email if ticket.user else None,
        'user_name': f"{ticket.user.first_name} {ticket.user.last_name}".strip() if ticket.user else None,
        'subject': ticket.subject,
        'description': ticket.description,
        'category': ticket.category,
        'priority': ticket.priority,
        'status': ticket.status.value if hasattr(ticket.status, 'value') else ticket.status,
        'assigned_admin_id': ticket.assigned_admin_id,
        'assigned_admin_email': ticket.assigned_admin.email if ticket.assigned_admin else None,
        'attended_by_id': ticket.attended_by_id,
        'attended_by_email': ticket.attended_by.email if ticket.attended_by else None,
        'resolution_summary': ticket.resolution_summary,
        'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
        'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None,
        'attended_at': ticket.attended_at.isoformat() if ticket.attended_at else None,
        'resolved_at': ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        'closed_at': ticket.closed_at.isoformat() if ticket.closed_at else None,
    }


def _serialize_deletion_request(item):
    return {
        'id': item.id,
        'user_id': item.user_id,
        'user_email': item.user.email if item.user else None,
        'reason': item.reason,
        'status': item.status,
        'requested_at': item.requested_at.isoformat() if item.requested_at else None,
        'processed_at': item.processed_at.isoformat() if item.processed_at else None,
        'processed_by_user_id': item.processed_by_user_id,
    }


def _serialize_security_event(event):
    return {
        'id': event.id,
        'user_id': event.user_id,
        'user_email': event.user.email if event.user else None,
        'event_type': event.event_type,
        'severity': event.severity,
        'ip_address': event.ip_address,
        'user_agent': event.user_agent,
        'details': event.details,
        'created_at': event.created_at.isoformat() if event.created_at else None,
    }


def _normalize_user_role(role_like):
    if role_like is None:
        return None
    if isinstance(role_like, UserRole):
        return role_like
    role_text = str(role_like).strip().lower()
    if role_text in {'admin', 'user'}:
        return UserRole(role_text)
    return None

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

    if request.method != 'POST':
        return {"message": "Login required"}, 401

    payload = request.get_json(silent=True) or request.form
    email = (payload.get('email') or payload.get('username') or '').strip()
    password = payload.get('password') or ''

    if not email or not password:
        return {"error": "Email and password are required."}, 400

    user = User.query.filter_by(email=email).first()

    if user and _is_admin(user) and user.check_password(password):
        login_user(user)
        flash('Login successful!', 'success')
        if request.is_json:
            return {"message": "Login successful."}, 200
        return redirect(url_for('admin.admin_dashboard'))

    flash('Invalid credentials or insufficient permissions.', 'danger')
    return {"error": "Invalid credentials or insufficient permissions."}, 401



@admin_bp.route('/admin_signup', methods=['GET', 'POST'])
def admin_signup():
    bootstrap_token = os.getenv('ADMIN_BOOTSTRAP_TOKEN')
    provided_token = request.form.get('bootstrap_token') or request.headers.get('X-Admin-Bootstrap-Token')
    has_existing_admin = User.query.filter_by(role=UserRole.ADMIN).first() is not None

    # Bootstrap path: only available before the first admin exists.
    if not has_existing_admin:
        if bootstrap_token and provided_token != bootstrap_token:
            abort(403)
    else:
        # After bootstrap, only authenticated admins can create other admins.
        if not (current_user.is_authenticated and _is_admin(current_user)):
            abort(403)

    if request.method != 'POST':
        return {"message": "Signup required"}, 401

    payload = request.get_json(silent=True) or request.form
    email = (payload.get('email') or '').strip()
    password = payload.get('password') or ''
    confirm_password = payload.get('confirm_password') or ''
    first_name = (payload.get('first_name') or '').strip()
    last_name = (payload.get('last_name') or '').strip()
    phone_number = (payload.get('phone_number') or '').strip()
    country_of_residence = (payload.get('country_of_residence') or '').strip()

    required_fields = {
        'email': email,
        'password': password,
        'confirm_password': confirm_password,
        'first_name': first_name,
        'last_name': last_name,
        'phone_number': phone_number,
    }
    missing = [key for key, value in required_fields.items() if not value]
    if missing:
        return {"error": f"Missing required fields: {', '.join(missing)}"}, 400

    if password != confirm_password:
        flash('Passwords do not match.', 'danger')
        return {"error": "Passwords do not match."}, 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        flash('An account with this email already exists.', 'danger')
        return {"error": "Account exists."}, 400

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

    flash('Account created successfully. Please log in.', 'success')
    return {"message": "Admin account created."}, 201

@admin_bp.route('/admin_dashboard', methods=['GET', 'POST'])
@login_required
def admin_dashboard():
    check_admin_role(current_user)  # Ensure current user is an admin
    is_super_admin = _is_super_admin(current_user)

    # Handle Search and Filter for Users
    search_query = (request.args.get('search') or '').strip()
    role_filter = (request.args.get('role') or '').strip().lower()

    filters = []
    if search_query:
        filters.append(User.email.ilike(f'%{search_query}%'))

    if role_filter:
        role_lookup = {
            'user': UserRole.USER,
            'admin': UserRole.ADMIN,
        }
        selected_role = role_lookup.get(role_filter)
        if selected_role:
            filters.append(User.role == selected_role)

    # Non-super admins should never see other staff accounts.
    if not is_super_admin:
        filters.append(User.role == UserRole.USER)

    users = User.query.filter(*filters) if filters else User.query.filter(true())
    users = users.order_by(User.created_at.desc()).all()

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
    return {
        "users": [_serialize_admin_user(u) for u in users],
        "file_uploads": [_serialize_file_upload(f) for f in file_uploads],
        "critical_alert": critical_alert,
    }


@admin_bp.route('/admin_subscribers', methods=['GET'])
@login_required
def admin_subscribers():
    check_admin_role(current_user)
    is_super_admin = _is_super_admin(current_user)

    subscribers = (
        User.query
        .filter(User.role == UserRole.USER)
        .order_by(User.created_at.desc())
        .all()
    )

    admins = []
    if is_super_admin:
        admins = (
            User.query
            .filter(User.role == UserRole.ADMIN)
            .order_by(User.created_at.desc())
            .all()
        )

    return {
        "subscribers": [_serialize_admin_user(user) for user in subscribers],
        "admins": [_serialize_admin_user(user) for user in admins],
        "users": [_serialize_admin_user(user) for user in subscribers + admins],
    }


@admin_bp.route('/admin_users/<int:user_id>', methods=['GET', 'PATCH', 'DELETE'])
@login_required
def admin_user_detail(user_id):
    check_admin_role(current_user)
    user = User.query.get_or_404(user_id)
    is_super_admin = _is_super_admin(current_user)
    is_target_admin = _is_admin(user)

    if is_target_admin and current_user.id != user.id and not is_super_admin:
        return {"error": "Only super admin can view other admin accounts."}, 403

    if request.method == 'GET':
        now = _utc_now()
        recent_logs = (
            Logs.query
            .filter_by(user_id=user.id)
            .order_by(Logs.timestamp.desc())
            .limit(10)
            .all()
        )
        subscriptions = (
            Subscription.query
            .filter_by(user_id=user.id)
            .order_by(Subscription.end_date.desc())
            .all()
        )
        latest_subscription = subscriptions[0] if subscriptions else None
        subscription_status = 'none'
        if latest_subscription and latest_subscription.end_date and latest_subscription.end_date >= now:
            subscription_status = 'active'
        elif latest_subscription:
            subscription_status = 'expired'

        uploads_count = FileUpload.query.filter_by(user_id=user.id).count()

        can_manage_target = current_user.id != user.id and (not is_target_admin or is_super_admin)
        can_change_role = is_super_admin and current_user.id != user.id

        return {
            "user": _serialize_admin_user(user),
            "recent_logs": [log.to_dict() for log in recent_logs],
            "uploads_count": uploads_count,
            "subscription_summary": {
                "status": subscription_status,
                "current_plan": getattr(latest_subscription, 'plan', None) or 'Free',
                "current_start_date": latest_subscription.start_date.isoformat() if latest_subscription and latest_subscription.start_date else None,
                "current_end_date": latest_subscription.end_date.isoformat() if latest_subscription and latest_subscription.end_date else None,
                "total_subscriptions": len(subscriptions),
            },
            "subscription_history": [_serialize_subscription(subscription) for subscription in subscriptions[:5]],
            "actions": {
                "can_delete": can_manage_target,
                "can_toggle_active": can_manage_target,
                "can_change_role": can_change_role,
            },
        }

    if request.method == 'PATCH':
        payload = request.get_json(silent=True) or {}

        requested_role = _normalize_user_role(payload.get('role')) if 'role' in payload else None
        if 'role' in payload and requested_role is None:
            return {"error": "Role must be either 'user' or 'admin'."}, 400

        if 'role' in payload and not is_super_admin:
            return {"error": "Only super admin can change account roles."}, 403

        if is_target_admin and current_user.id != user.id and not is_super_admin:
            return {"error": "Only super admin can modify other admin accounts."}, 403

        if requested_role and current_user.id == user.id and requested_role != UserRole.ADMIN:
            return {"error": "You cannot remove your own admin role."}, 400

        if 'is_active' in payload:
            requested_active = bool(payload.get('is_active'))
            if current_user.id == user.id and not requested_active:
                return {"error": "You cannot deactivate your own account."}, 400
            user.is_active = requested_active

        if requested_role:
            user.role = requested_role

        editable_fields = [
            'first_name',
            'last_name',
            'phone_number',
            'company',
            'job_title',
            'team_size',
            'primary_use_case',
            'newsletter_opt_in',
        ]
        for field_name in editable_fields:
            if field_name in payload:
                setattr(user, field_name, payload.get(field_name))

        db.session.commit()
        Logs.log_action(current_user, f"Updated account settings for user #{user.id} ({user.email})")
        return {"message": "User updated.", "user": _serialize_admin_user(user)}

    if current_user.id == user.id:
        return {"error": "You cannot delete your own account."}, 400

    if is_target_admin and not is_super_admin:
        return {"error": "Only super admin can delete admin accounts."}, 403

    deleted_email = user.email
    db.session.delete(user)
    db.session.commit()
    Logs.log_action(current_user, f"Deleted user #{user.id} ({deleted_email})")
    return {"message": "User deleted."}


@admin_bp.route('/support_tickets', methods=['GET'])
@login_required
def admin_support_tickets():
    check_admin_role(current_user)
    tickets = (
        SupportTicket.query
        .join(User, SupportTicket.user_id == User.id)
        .filter(User.role == UserRole.USER)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return {
        'tickets': [_serialize_support_ticket(ticket) for ticket in tickets],
    }


@admin_bp.route('/support_tickets/<int:ticket_id>', methods=['GET', 'PATCH'])
@login_required
def admin_support_ticket_detail(ticket_id):
    check_admin_role(current_user)
    ticket = SupportTicket.query.get_or_404(ticket_id)

    if ticket.user and _is_admin(ticket.user):
        return {"error": "Support tickets are only exposed for subscriber accounts."}, 403

    if request.method == 'GET':
        return {'ticket': _serialize_support_ticket(ticket)}

    payload = request.get_json(silent=True) or {}
    updates_made = False

    if 'assigned_admin_id' in payload:
        assigned_admin_id = payload.get('assigned_admin_id')
        if assigned_admin_id is not None:
            assigned_admin = User.query.get(int(assigned_admin_id))
            if not assigned_admin or not _is_admin(assigned_admin):
                return {'error': 'Assigned admin must be a valid staff account.'}, 400
            ticket.assigned_admin_id = assigned_admin.id
        else:
            ticket.assigned_admin_id = None
        updates_made = True

    if 'status' in payload:
        status_value = str(payload.get('status') or '').strip().lower()
        status_lookup = {item.value: item for item in SupportTicketStatus}
        if status_value not in status_lookup:
            return {'error': 'Invalid ticket status.'}, 400

        ticket.status = status_lookup[status_value]
        if ticket.attended_by_id is None and status_lookup[status_value] != SupportTicketStatus.OPEN:
            ticket.attended_by_id = current_user.id
            ticket.attended_at = ticket.attended_at or _utc_now()
        if status_lookup[status_value] in {SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED}:
            ticket.attended_by_id = ticket.attended_by_id or current_user.id
            ticket.attended_at = ticket.attended_at or _utc_now()
            ticket.resolved_at = _utc_now()
            if status_lookup[status_value] == SupportTicketStatus.CLOSED:
                ticket.closed_at = _utc_now()
        updates_made = True

    if 'resolution_summary' in payload:
        ticket.resolution_summary = (payload.get('resolution_summary') or '').strip() or None
        if ticket.resolution_summary:
            ticket.attended_by_id = ticket.attended_by_id or current_user.id
            ticket.attended_at = ticket.attended_at or _utc_now()
        updates_made = True

    if not updates_made:
        return {'error': 'No updates provided.'}, 400

    db.session.commit()
    Logs.log_action(current_user, f"Updated support ticket #{ticket.id} for user #{ticket.user_id}")
    return {'message': 'Ticket updated.', 'ticket': _serialize_support_ticket(ticket)}


@admin_bp.route('/admin/security_events', methods=['GET'])
@login_required
def admin_security_events():
    check_admin_role(current_user)

    severity_filter = (request.args.get('severity') or '').strip().lower()
    limit = request.args.get('limit', default=100, type=int)
    limit = max(1, min(limit, 500))

    query = SecurityEvent.query
    if severity_filter:
        query = query.filter(SecurityEvent.severity == severity_filter)

    events = query.order_by(SecurityEvent.created_at.desc()).limit(limit).all()
    return {'security_events': [_serialize_security_event(event) for event in events]}, 200


@admin_bp.route('/admin/deletion_requests', methods=['GET'])
@login_required
def admin_deletion_requests():
    check_admin_role(current_user)
    status_filter = (request.args.get('status') or '').strip().lower()

    query = DataDeletionRequest.query
    if status_filter:
        query = query.filter(DataDeletionRequest.status == status_filter)

    rows = query.order_by(DataDeletionRequest.requested_at.desc()).all()
    return {'deletion_requests': [_serialize_deletion_request(row) for row in rows]}, 200


@admin_bp.route('/admin/deletion_requests/<int:request_id>', methods=['PATCH'])
@login_required
def admin_update_deletion_request(request_id):
    check_admin_role(current_user)
    payload = request.get_json(silent=True) or {}
    new_status = (payload.get('status') or '').strip().lower()
    allowed_statuses = {'pending', 'in_review', 'rejected', 'processed'}

    if new_status not in allowed_statuses:
        return {'error': 'Invalid status.'}, 400

    deletion_request = DataDeletionRequest.query.get_or_404(request_id)
    deletion_request.status = new_status
    if new_status == 'processed':
        deletion_request.processed_at = _utc_now()
        deletion_request.processed_by_user_id = current_user.id

    db.session.commit()
    Logs.log_action(current_user, f"Updated deletion request #{deletion_request.id} to {new_status}")
    return {'message': 'Deletion request updated.', 'request': _serialize_deletion_request(deletion_request)}, 200


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


# ==== NIS2 Compliance Incident Reporting ====

@admin_bp.route('/api/incidents/report-nis2', methods=['POST'])
@login_required
@admin_required
def report_nis2_incident():
    """
    Report a critical infrastructure incident for NIS2 compliance.
    Required fields: incident_type, severity, affected_systems, initial_detection_at, description
    """
    data = request.get_json() or {}

    try:
        incident = NIS2IncidentReport(
            user_id=current_user.id,
            incident_type=data.get('incident_type', ''),
            severity=data.get('severity', 'medium'),
            affected_systems=data.get('affected_systems', ''),
            initial_detection_at=datetime.fromisoformat(data.get('initial_detection_at', _utc_now().isoformat())),
            description=data.get('description', ''),
            actions_taken=data.get('actions_taken', ''),
            notification_recipient=data.get('notification_recipient', ''),
            status='draft'  # Admin can mark as 'reported' after review
        )
        db.session.add(incident)
        db.session.commit()

        # Log the incident report in security events
        security_event = SecurityEvent(
            user_id=current_user.id,
            event_type='nis2_incident_report_created',
            severity=data.get('severity', 'medium'),
            details=f"NIS2 incident: {data.get('incident_type', 'unknown')} - {data.get('affected_systems', 'n/a')}"
        )
        db.session.add(security_event)
        db.session.commit()

        return {
            'status': 'success',
            'message': 'NIS2 incident report created successfully',
            'incident_id': incident.id
        }, 201
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 400


@admin_bp.route('/api/incidents/nis2', methods=['GET'])
@login_required
@admin_required
def list_nis2_incidents():
    """List all NIS2 incident reports (admin dashboard)."""
    status_filter = request.args.get('status', None)
    severity_filter = request.args.get('severity', None)
    limit = request.args.get('limit', 50, type=int)

    query = NIS2IncidentReport.query

    if status_filter:
        query = query.filter_by(status=status_filter)
    if severity_filter:
        query = query.filter_by(severity=severity_filter)

    incidents = query.order_by(NIS2IncidentReport.created_at.desc()).limit(limit).all()

    return {
        'incidents': [incident.to_dict() for incident in incidents],
        'total': len(incidents)
    }, 200


@admin_bp.route('/api/incidents/nis2/<int:incident_id>', methods=['GET', 'PATCH'])
@login_required
@admin_required
def manage_nis2_incident(incident_id):
    """Get or update a specific NIS2 incident report."""
    incident = NIS2IncidentReport.query.get_or_404(incident_id)

    if request.method == 'GET':
        return incident.to_dict(), 200

    if request.method == 'PATCH':
        data = request.get_json() or {}

        # Update allowed fields
        if 'status' in data:
            incident.status = data['status']
        if 'actions_taken' in data:
            incident.actions_taken = data['actions_taken']
        if 'notification_sent_at' in data and data['notification_sent_at']:
            incident.notification_sent_at = datetime.fromisoformat(data['notification_sent_at'])
        if 'notification_recipient' in data:
            incident.notification_recipient = data['notification_recipient']

        incident.updated_at = _utc_now()
        db.session.commit()

        # Log the update
        security_event = SecurityEvent(
            user_id=current_user.id,
            event_type='nis2_incident_updated',
            severity=incident.severity,
            details=f"NIS2 incident {incident_id} updated to status: {incident.status}"
        )
        db.session.add(security_event)
        db.session.commit()

        return {
            'status': 'success',
            'message': 'NIS2 incident report updated',
            'incident': incident.to_dict()
        }, 200


@admin_bp.route('/api/compliance/readiness', methods=['GET'])
@login_required
@admin_required
def get_compliance_readiness():
    """
    Return compliance readiness summary for admin dashboard.
    Includes GDPR, NIS2, ISO27001 status based on current deployments.
    """
    from app.subscription_service import get_tier_info

    active_subscriptions = Subscription.query.filter(
        Subscription.end_date > _utc_now()
    ).all()

    @admin_bp.route('/api/incidents/nis2/<int:incident_id>/pdf', methods=['GET'])
    @login_required
    @admin_required
    def download_nis2_incident_pdf(incident_id):
        """Download NIS2 incident report as PDF for regulator submission."""
        from flask import send_file
        from app.utils.nis2_report_generator import NIS2ReportGenerator
        from app.utils.evidence_gatherer import EvidenceGatherer
        from app.models import EvidenceArtifact
        from app.utils.access_control import generate_access_control_matrix
        import io
        import zipfile
        from flask import send_file

        incident = NIS2IncidentReport.query.get_or_404(incident_id)

        # Prepare incident data with user info
        incident_data = incident.to_dict()
        incident_data['user'] = {
            'email': incident.user.email,
            'company': incident.user.company or 'N/A',
            'first_name': incident.user.first_name,
            'last_name': incident.user.last_name,
        }

        # Generate PDF
        try:
            generator = NIS2ReportGenerator(incident_data)
            pdf_buffer = generator.generate_pdf()

            # Log the PDF download
            security_event = SecurityEvent(
                user_id=current_user.id,
                event_type='nis2_incident_pdf_downloaded',
                severity=incident.severity,
                details=f"NIS2 incident {incident_id} PDF downloaded for submission"
            )
            db.session.add(security_event)
            db.session.commit()

            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'NIS2_Incident_{incident_id}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.pdf'
            )
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Failed to generate PDF: {str(e)}'
            }, 500


    @admin_bp.route('/api/compliance/readiness', methods=['GET'])
    @login_required
    @admin_required
    def get_compliance_readiness():
        """
        Return compliance readiness summary for admin dashboard.
        Includes GDPR, NIS2, ISO27001 status based on current deployments.
        """
        from app.subscription_service import get_tier_info

        active_subscriptions = Subscription.query.filter(
            Subscription.end_date > _utc_now()
        ).all()

        nis2_incidents = NIS2IncidentReport.query.filter_by(status='reported').all()
        security_events_count = SecurityEvent.query.count()
        data_exports = DataDeletionRequest.query.count()

        # Assess tier distribution
        tier_distribution = {}
        for sub in active_subscriptions:
            tier = sub.plan
            tier_distribution[tier] = tier_distribution.get(tier, 0) + 1

        tier_compliance = {}
        for tier in tier_distribution.keys():
            tier_info = get_tier_info(tier)
            if tier_info:
                tier_compliance[tier] = {
                    'users': tier_distribution[tier],
                    'gdpr_ready': tier_info.get('gdpr_ready', False),
                    'nis2_ready': tier_info.get('nis2_ready', False)
                }

        return {
            'status': 'ok',
            'compliance_overview': {
                'gdpr': {
                    'status': 'compliant' if security_events_count > 0 else 'configured',
                    'export_requests': DataDeletionRequest.query.count(),
                    'deletion_requests': DataDeletionRequest.query.count(),
                    'audit_events': security_events_count
                },
                'nis2': {
                    'status': 'active' if nis2_incidents else 'configured',
                    'incident_reports': len(nis2_incidents),
                    'critical_incidents': len([i for i in nis2_incidents if i.severity == 'critical']),
                    'high_incidents': len([i for i in nis2_incidents if i.severity == 'high'])
                },
                'iso27001': {
                    'status': 'in_progress',
                    'audit_trail_events': security_events_count,
                    'access_logs': len(active_subscriptions)
                }
            },
            'tier_distribution': tier_compliance,
            'deployment_info': {
                'eu_residency_enforced': os.getenv('EU_ONLY_DATA_RESIDENCY', 'false').lower() in {'1', 'true', 'yes'},
                'preferred_region': os.getenv('PREFERRED_DATA_REGION', 'eu-west-1')
            }
        }, 200



    # Evidence gatherer endpoint for ISO27001 automation
    @admin_bp.route('/admin/evidence/gather', methods=['POST'])
    @login_required
    @admin_required
    def trigger_evidence_gather():
        """Trigger a one-off evidence collection run (M365/GWS) and persist artifacts."""
        gatherer = EvidenceGatherer(current_user=current_user)
        summary = gatherer.gather_once()

        # Log a security event for traceability
        event = SecurityEvent(
            user_id=current_user.id,
            event_type='evidence_gather_run',
            severity='info',
            details=f"Evidence gather run: m365_artifacts={summary['m365']['artifacts']}, gws_artifacts={summary['gws']['artifacts']}"
        )
        db.session.add(event)
        db.session.commit()

        return {'status': 'ok', 'summary': summary}, 200



    @admin_bp.route('/admin/evidence/generate-access-matrix', methods=['POST'])
    @login_required
    @admin_required
    def generate_access_matrix():
        """Generate access control matrix and persist as EvidenceArtifact."""
        try:
            result = generate_access_control_matrix()
            # Log event
            event = SecurityEvent(
                user_id=current_user.id,
                event_type='access_matrix_generated',
                severity='info',
                details=f"Access control matrix generated: artifact_id={result.get('artifact_id')}, rows={result.get('rows')}"
            )
            db.session.add(event)
            db.session.commit()
            return {'status': 'ok', 'result': result}, 200
        except Exception as e:
            current_app.logger.exception('Failed to generate access control matrix')
            return {'status': 'error', 'message': str(e)}, 500


    @admin_bp.route('/admin/export/evidence', methods=['GET'])
    @login_required
    @admin_required
    def export_evidence():
        """Export evidence artifacts as a ZIP. Query params: since (ISO8601), type (artifact_type)"""
        since = request.args.get('since')
        artifact_type = request.args.get('type')

        query = EvidenceArtifact.query
        if since:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(since)
                query = query.filter(EvidenceArtifact.collected_at >= dt)
            except Exception:
                pass
        if artifact_type:
            query = query.filter_by(artifact_type=artifact_type)

        artifacts = query.order_by(EvidenceArtifact.collected_at.desc()).all()

        mem = io.BytesIO()
        with zipfile.ZipFile(mem, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            for art in artifacts:
                filename = f"artifact_{art.id}_{art.source}_{art.artifact_type}"
                # choose extension
                ext = '.json'
                content = art.raw_payload or ''
                try:
                    json.loads(content)
                    ext = '.json'
                except Exception:
                    # not JSON, might be CSV
                    if any(x in art.artifact_type for x in ['csv', 'matrix', 'access_control']):
                        ext = '.csv'
                    else:
                        ext = '.txt'

                zf.writestr(filename + ext, content)

        mem.seek(0)
        return send_file(mem, mimetype='application/zip', as_attachment=True, download_name='evidence_export.zip')

# Logout
@admin_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))
