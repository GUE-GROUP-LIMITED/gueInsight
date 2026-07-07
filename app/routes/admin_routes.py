
import hashlib
import json
import os
import secrets
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, redirect, url_for, flash, abort, current_app
from flask_login import login_required, current_user, login_user, logout_user
from flask_mail import Message
from werkzeug.security import generate_password_hash
from sqlalchemy import true, inspect, text
from app import db, mail
from app.models import User, Logs, FileUpload, UserRole, Alert, AlertRule, Subscription, SupportTicket, SupportTicketStatus, DataDeletionRequest, SecurityEvent, NIS2IncidentReport, VcisoUpdate
from app.forms import AdminLoginForm, AdminSignupForm, AlertRuleForm
from app.utils.utils import check_admin_role, get_serializer
from app.admin_services import some_condition_for_critical_alert
from app.utils.decorators import admin_required
from app.routes.admin_security_routes import register_admin_security_routes
from app.routes.admin_alerts_routes import register_admin_alerts_routes
from app.routes.admin_operations_routes import register_operations_routes

# Blueprint for admin routes
admin_bp = Blueprint('admin', __name__)

_ADMIN_SCHEMA_SYNCED = False

ADMIN_PERMISSION_CATALOG = {
    'users:invite': 'Invite new staff users.',
    'users:activate': 'Activate invited staff users.',
    'users:disable': 'Deactivate staff accounts.',
    'users:role_assign': 'Assign staff roles and privileges.',
    'roles:manage': 'Manage role templates and privilege sets.',
    'security:policy_manage': 'Manage security and compliance policies.',
    'security:incident_manage': 'Manage incidents and security events.',
    'billing:manage': 'Manage billing and subscription settings.',
    'integrations:manage': 'Manage enterprise integrations.',
    'reports:view_all': 'View all enterprise reports.',
    'audit:read': 'View audit trail and security logs.',
    'org:settings_manage': 'Manage organization-level settings.',
}

ADMIN_ROLE_TEMPLATES = {
    'owner': sorted(ADMIN_PERMISSION_CATALOG.keys()),
    'super_admin': sorted(ADMIN_PERMISSION_CATALOG.keys()),
    'admin': sorted(ADMIN_PERMISSION_CATALOG.keys()),
    'security_admin': [
        'audit:read',
        'reports:view_all',
        'security:incident_manage',
        'security:policy_manage',
        'users:invite',
        'users:activate',
        'users:role_assign',
    ],
    'billing_admin': [
        'audit:read',
        'billing:manage',
        'reports:view_all',
        'users:invite',
        'users:activate',
    ],
    'auditor': [
        'audit:read',
        'reports:view_all',
    ],
}


def _sync_admin_access_columns():
    global _ADMIN_SCHEMA_SYNCED
    if _ADMIN_SCHEMA_SYNCED:
        return

    inspector = inspect(db.engine)
    existing_columns = {column['name'] for column in inspector.get_columns('user')}
    missing_columns = {
        'admin_role': 'VARCHAR(50) NULL',
        'admin_permissions': 'VARCHAR(4000) NULL',
        'invited_by_user_id': 'INTEGER NULL',
        'invited_at': 'TIMESTAMP NULL',
        'invitation_expires_at': 'TIMESTAMP NULL',
        'invitation_token_hash': 'VARCHAR(128) NULL',
        'invitation_accepted_at': 'TIMESTAMP NULL',
    }

    with db.engine.begin() as connection:
        for column_name, ddl in missing_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(f'ALTER TABLE "user" ADD COLUMN {column_name} {ddl}'))

    _ADMIN_SCHEMA_SYNCED = True


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


def _normalize_admin_role(role_like, default='admin'):
    role_text = str(role_like or default).strip().lower().replace(' ', '_')
    if role_text not in ADMIN_ROLE_TEMPLATES:
        return None
    return role_text


def _normalize_permissions(permissions_like):
    if permissions_like is None:
        return None

    if isinstance(permissions_like, str):
        raw_text = permissions_like.strip()
        if not raw_text:
            return []
        try:
            parsed = json.loads(raw_text)
            if isinstance(parsed, list):
                permissions_like = parsed
            else:
                permissions_like = [item.strip() for item in raw_text.split(',') if item.strip()]
        except Exception:
            permissions_like = [item.strip() for item in raw_text.split(',') if item.strip()]

    if not isinstance(permissions_like, list):
        return None

    normalized = sorted({str(item).strip().lower() for item in permissions_like if str(item).strip()})
    if any(item not in ADMIN_PERMISSION_CATALOG for item in normalized):
        return None
    return normalized


def _effective_permissions(user):
    if not user or not _is_admin(user):
        return []

    if _is_super_admin(user):
        return sorted(ADMIN_PERMISSION_CATALOG.keys())

    custom_permissions = _normalize_permissions(getattr(user, 'admin_permissions', None))
    if custom_permissions is not None:
        return custom_permissions

    admin_role = _normalize_admin_role(getattr(user, 'admin_role', None), default='admin') or 'admin'
    return sorted(ADMIN_ROLE_TEMPLATES.get(admin_role, ADMIN_ROLE_TEMPLATES['admin']))


def _has_permission(user, permission):
    return permission in _effective_permissions(user)


def _safe_admin_role_for_user(user):
    if not _is_admin(user):
        return None
    return _normalize_admin_role(getattr(user, 'admin_role', None), default='admin') or 'admin'


def _hash_token(token):
    return hashlib.sha256(str(token).encode('utf-8')).hexdigest()


def _invite_serializer():
    return get_serializer(current_app.config['SECRET_KEY'], current_app.config['SECURITY_PASSWORD_SALT'])


def _build_admin_invite_link(token):
    frontend_url = (current_app.config.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/')
    return f'{frontend_url}/activate-admin?token={token}'


def _send_admin_invite_email(user, activation_link, invited_by_user):
    message = Message(
        'You have been invited to GueInsight Admin',
        recipients=[user.email],
    )
    inviter_name = f"{invited_by_user.first_name} {invited_by_user.last_name}".strip()
    message.body = (
        f"Hello {user.first_name or 'there'},\n\n"
        f"{inviter_name or invited_by_user.email} invited you to join GueInsight administration.\n\n"
        f"Activate your account: {activation_link}\n\n"
        "This invitation link is single-use and expires automatically.\n"
        "If you were not expecting this invitation, you can ignore this email."
    )

    if current_app.config.get('TESTING') or current_app.config.get('MAIL_SUPPRESS_SEND'):
        return

    mail.send(message)


def _can_grant_role_or_permissions(actor, target_role, target_permissions):
    if _is_super_admin(actor):
        return True, None

    actor_permissions = set(_effective_permissions(actor))
    requested_permissions = set(target_permissions or [])

    if target_role in {'owner', 'super_admin'}:
        return False, 'Only super admin can assign owner or super_admin roles.'

    if not requested_permissions.issubset(actor_permissions):
        return False, 'You can only grant permissions that you already have.'

    return True, None


def _serialize_admin_user(user):
    _sync_admin_access_columns()
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
        'admin_role': _safe_admin_role_for_user(user),
        'admin_permissions': _effective_permissions(user) if _is_admin(user) else [],
        'is_active': bool(getattr(user, 'is_active', True)),
        'invited_at': user.invited_at.isoformat() if getattr(user, 'invited_at', None) else None,
        'invitation_expires_at': user.invitation_expires_at.isoformat() if getattr(user, 'invitation_expires_at', None) else None,
        'invitation_accepted_at': user.invitation_accepted_at.isoformat() if getattr(user, 'invitation_accepted_at', None) else None,
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


def _normalize_plan(plan_like):
    value = str(plan_like or 'free').strip().lower()
    legacy_map = {
        'premium_individual': 'compliance_pro',
        'premium_small_business': 'enterprise_risk',
        'premium_large_business': 'enterprise_elite',
        'premium': 'compliance_pro',
        'freemium': 'free',
    }
    return legacy_map.get(value, value)


def _is_enterprise_plan(plan_like):
    plan = _normalize_plan(plan_like)
    return plan in {'enterprise_professional', 'enterprise_risk', 'enterprise_elite'}


def _serialize_vciso_update(update):
    target_user = update.user
    latest_subscription = None
    if target_user:
        latest_subscription = (
            Subscription.query
            .filter_by(user_id=target_user.id)
            .order_by(Subscription.end_date.desc())
            .first()
        )

    payload = update.to_dict()
    payload['target_user_email'] = target_user.email if target_user else None
    payload['target_user_name'] = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else None
    payload['target_plan'] = getattr(latest_subscription, 'plan', None) if latest_subscription else None
    payload['scope'] = 'all_enterprise' if update.user_id is None else 'single_client'
    return payload


register_admin_alerts_routes(admin_bp)
register_admin_security_routes(admin_bp)
register_operations_routes(admin_bp)


@admin_bp.route('/admin_login', methods=['GET', 'POST'])
def admin_login():
    _sync_admin_access_columns()
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
    _sync_admin_access_columns()
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
        role=UserRole.ADMIN,
        admin_role='super_admin' if not has_existing_admin else 'admin',
        invitation_accepted_at=_utc_now(),
        email_verified_at=_utc_now(),
        is_active=True,
    )
    db.session.add(new_user)
    db.session.commit()

    flash('Account created successfully. Please log in.', 'success')
    return {"message": "Admin account created."}, 201


@admin_bp.route('/api/admin/access/metadata', methods=['GET'])
@login_required
def admin_access_metadata():
    _sync_admin_access_columns()
    check_admin_role(current_user)
    return {
        'roles': {
            role_key: {
                'permissions': sorted(permissions),
            }
            for role_key, permissions in ADMIN_ROLE_TEMPLATES.items()
        },
        'permissions': ADMIN_PERMISSION_CATALOG,
        'current_user': {
            'id': current_user.id,
            'email': current_user.email,
            'role': _safe_admin_role_for_user(current_user),
            'permissions': _effective_permissions(current_user),
            'is_super_admin': _is_super_admin(current_user),
        },
    }, 200


@admin_bp.route('/api/admin/invitations', methods=['POST'])
@login_required
def admin_create_invitation():
    _sync_admin_access_columns()
    check_admin_role(current_user)

    if not _has_permission(current_user, 'users:invite'):
        return {'error': 'Missing permission: users:invite'}, 403

    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    first_name = (payload.get('first_name') or '').strip() or 'Invited'
    last_name = (payload.get('last_name') or '').strip() or 'Admin'
    phone_number = (payload.get('phone_number') or '').strip() or '0000000000'
    admin_role = _normalize_admin_role(payload.get('admin_role'), default='admin')
    custom_permissions = _normalize_permissions(payload.get('permissions'))

    if not email:
        return {'error': 'email is required.'}, 400
    if admin_role is None:
        return {'error': f"admin_role must be one of: {', '.join(sorted(ADMIN_ROLE_TEMPLATES.keys()))}"}, 400

    assigned_permissions = custom_permissions
    if assigned_permissions is None:
        assigned_permissions = sorted(ADMIN_ROLE_TEMPLATES[admin_role])

    grant_allowed, grant_error = _can_grant_role_or_permissions(current_user, admin_role, assigned_permissions)
    if not grant_allowed:
        return {'error': grant_error}, 403

    existing_user = User.query.filter_by(email=email).first()
    if existing_user and getattr(existing_user, 'role', None) == UserRole.USER:
        return {'error': 'A non-admin user with this email already exists. Promote that account instead.'}, 409

    now = _utc_now()
    expiry_hours = int(current_app.config.get('ADMIN_INVITE_EXPIRY_HOURS', 72))
    expires_at = now + timedelta(hours=expiry_hours)

    if not existing_user:
        random_password = secrets.token_urlsafe(24)
        existing_user = User(
            email=email,
            password=generate_password_hash(random_password, method='pbkdf2:sha256'),
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            role=UserRole.ADMIN,
            admin_role=admin_role,
            admin_permissions=json.dumps(assigned_permissions),
            invited_by_user_id=current_user.id,
            invited_at=now,
            invitation_expires_at=expires_at,
            is_active=False,
            email_verified_at=None,
            invitation_accepted_at=None,
        )
        db.session.add(existing_user)
        db.session.flush()
    else:
        if _is_admin(existing_user) and bool(getattr(existing_user, 'invitation_accepted_at', None)) and bool(getattr(existing_user, 'is_active', True)):
            return {'error': 'An active admin account with this email already exists.'}, 409
        existing_user.first_name = first_name
        existing_user.last_name = last_name
        existing_user.phone_number = phone_number
        existing_user.role = UserRole.ADMIN
        existing_user.admin_role = admin_role
        existing_user.admin_permissions = json.dumps(assigned_permissions)
        existing_user.invited_by_user_id = current_user.id
        existing_user.invited_at = now
        existing_user.invitation_expires_at = expires_at
        existing_user.invitation_accepted_at = None
        existing_user.email_verified_at = None
        existing_user.is_active = False

    invite_payload = {
        'purpose': 'admin_invite_activation',
        'email': existing_user.email,
        'user_id': existing_user.id,
        'nonce': secrets.token_urlsafe(12),
    }
    token = _invite_serializer().dumps(invite_payload)
    existing_user.invitation_token_hash = _hash_token(token)

    activation_link = _build_admin_invite_link(token)

    try:
        _send_admin_invite_email(existing_user, activation_link, current_user)
    except Exception:
        current_app.logger.exception('Failed to send admin invitation email for %s', existing_user.email)
        db.session.rollback()
        return {'error': 'Unable to send invitation email right now.'}, 503

    db.session.commit()
    Logs.log_action(current_user, f"Invited admin account {existing_user.email} with role {admin_role}")

    response_payload = {
        'message': 'Invitation sent.',
        'invited_user': _serialize_admin_user(existing_user),
        'expires_at': expires_at.isoformat(),
    }
    if current_app.config.get('TESTING') or current_app.config.get('MAIL_SUPPRESS_SEND'):
        response_payload['activation_link'] = activation_link

    return response_payload, 201


@admin_bp.route('/auth/admin-invite/accept', methods=['POST'])
def admin_accept_invitation():
    _sync_admin_access_columns()
    payload = request.get_json(silent=True) or request.form
    token = (payload.get('token') or '').strip()
    password = payload.get('password') or ''
    first_name = (payload.get('first_name') or '').strip()
    last_name = (payload.get('last_name') or '').strip()
    phone_number = (payload.get('phone_number') or '').strip()

    if not token or not password:
        return {'error': 'token and password are required.'}, 400
    if len(password) < 10:
        return {'error': 'Password must be at least 10 characters.'}, 400
    if not any(ch.isupper() for ch in password) or not any(ch.islower() for ch in password) or not any(ch.isdigit() for ch in password):
        return {'error': 'Password must include uppercase, lowercase, and numeric characters.'}, 400

    try:
        max_age_seconds = int(current_app.config.get('ADMIN_INVITE_MAX_AGE_SECONDS', 72 * 3600))
        invite_payload = _invite_serializer().loads(token, max_age=max_age_seconds)
    except Exception:
        return {'error': 'Invitation is invalid or expired.'}, 400

    if not isinstance(invite_payload, dict) or invite_payload.get('purpose') != 'admin_invite_activation':
        return {'error': 'Invitation is invalid or expired.'}, 400

    user_id = int(invite_payload.get('user_id') or 0)
    email = (invite_payload.get('email') or '').strip().lower()
    invited_user = User.query.filter_by(id=user_id, email=email).first()
    if not invited_user:
        return {'error': 'Invitation is invalid or expired.'}, 400

    if _hash_token(token) != (getattr(invited_user, 'invitation_token_hash', None) or ''):
        return {'error': 'Invitation is invalid or expired.'}, 400

    now = _utc_now()
    if getattr(invited_user, 'invitation_accepted_at', None):
        return {'error': 'Invitation has already been used.'}, 400
    if getattr(invited_user, 'invitation_expires_at', None) and invited_user.invitation_expires_at < now:
        return {'error': 'Invitation has expired.'}, 400

    invited_user.password = generate_password_hash(password, method='pbkdf2:sha256')
    if first_name:
        invited_user.first_name = first_name
    if last_name:
        invited_user.last_name = last_name
    if phone_number:
        invited_user.phone_number = phone_number

    invited_user.role = UserRole.ADMIN
    invited_user.is_active = True
    invited_user.email_verified_at = now
    invited_user.invitation_accepted_at = now
    invited_user.invitation_token_hash = None

    db.session.commit()

    return {
        'message': 'Account activated successfully. You can now sign in.',
        'user': _serialize_admin_user(invited_user),
    }, 200


@admin_bp.route('/api/admin/users/<int:user_id>/access', methods=['PATCH'])
@login_required
def admin_update_user_access(user_id):
    _sync_admin_access_columns()
    check_admin_role(current_user)

    if not _has_permission(current_user, 'users:role_assign'):
        return {'error': 'Missing permission: users:role_assign'}, 403

    target_user = User.query.get_or_404(user_id)
    if not _is_admin(target_user):
        return {'error': 'Target account is not an admin user.'}, 400

    payload = request.get_json(silent=True) or {}
    next_admin_role = _normalize_admin_role(payload.get('admin_role'), default=_safe_admin_role_for_user(target_user) or 'admin')
    next_permissions = _normalize_permissions(payload.get('permissions'))
    if 'permissions' in payload and next_permissions is None:
        return {'error': 'permissions must be an array of valid permission keys.'}, 400

    if next_admin_role is None:
        return {'error': f"admin_role must be one of: {', '.join(sorted(ADMIN_ROLE_TEMPLATES.keys()))}"}, 400

    if next_permissions is None:
        next_permissions = sorted(ADMIN_ROLE_TEMPLATES[next_admin_role])

    grant_allowed, grant_error = _can_grant_role_or_permissions(current_user, next_admin_role, next_permissions)
    if not grant_allowed:
        return {'error': grant_error}, 403

    if current_user.id == target_user.id and 'users:role_assign' not in next_permissions:
        return {'error': 'You cannot remove your own users:role_assign permission.'}, 400

    target_user.admin_role = next_admin_role
    target_user.admin_permissions = json.dumps(next_permissions)
    db.session.commit()

    Logs.log_action(current_user, f"Updated access for admin #{target_user.id} ({target_user.email})")
    return {
        'message': 'Admin access updated.',
        'user': _serialize_admin_user(target_user),
    }, 200

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


@admin_bp.route('/api/admin/vciso', methods=['POST'])
@login_required
def admin_post_vciso_update():
    """Post a vCISO update to a specific client or to all enterprise clients."""
    check_admin_role(current_user)

    payload = request.get_json(silent=True) or {}
    title = (payload.get('title') or '').strip()
    note = (payload.get('note') or '').strip()
    action_items = payload.get('action_items')
    target_user_id = payload.get('target_user_id')
    publish_to_all_enterprise = bool(payload.get('publish_to_all_enterprise', False))

    if not title or not note:
        return {'error': 'title and note are required.'}, 400

    action_items_text = None
    if isinstance(action_items, list):
        cleaned = [str(item).strip() for item in action_items if str(item).strip()]
        action_items_text = '\n'.join(cleaned) if cleaned else None
    elif isinstance(action_items, str):
        action_items_text = action_items.strip() or None

    target_user = None
    if target_user_id is not None:
        try:
            target_user_id = int(target_user_id)
        except (TypeError, ValueError):
            return {'error': 'target_user_id must be numeric.'}, 400
        target_user = User.query.get(target_user_id)
        if not target_user:
            return {'error': 'Target user not found.'}, 404

        latest_subscription = (
            Subscription.query
            .filter_by(user_id=target_user.id)
            .order_by(Subscription.end_date.desc())
            .first()
        )
        if not latest_subscription or not _is_enterprise_plan(latest_subscription.plan):
            return {'error': 'Target user does not have an enterprise subscription.'}, 400

    if publish_to_all_enterprise and target_user:
        return {'error': 'Provide either target_user_id or publish_to_all_enterprise, not both.'}, 400

    if not publish_to_all_enterprise and not target_user:
        return {'error': 'Provide target_user_id or set publish_to_all_enterprise to true.'}, 400

    update = VcisoUpdate(
        user_id=None if publish_to_all_enterprise else target_user.id,
        title=title,
        note=note,
        action_items=action_items_text,
        author_name=(payload.get('author_name') or 'Gabriel Aloho').strip() or 'Gabriel Aloho',
        created_by_admin_id=current_user.id,
        is_active=True,
    )

    db.session.add(update)
    db.session.commit()

    scope = 'all enterprise clients' if publish_to_all_enterprise else f'user #{target_user.id}'
    Logs.log_action(current_user, f"Posted vCISO update #{update.id} to {scope}")

    return {
        'message': 'vCISO update posted.',
        'update': _serialize_vciso_update(update),
        'scope': scope,
    }, 201


@admin_bp.route('/api/admin/vciso', methods=['GET'])
@login_required
def admin_list_vciso_updates():
    """List vCISO updates for admin history management."""
    check_admin_role(current_user)

    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    include_inactive = str(request.args.get('include_inactive', 'false')).strip().lower() in {'1', 'true', 'yes'}
    status_filter = str(request.args.get('status', '')).strip().lower()
    scope_filter = str(request.args.get('scope', 'all')).strip().lower()
    search_query = str(request.args.get('q', '')).strip()

    if not status_filter:
        status_filter = 'all' if include_inactive else 'active'

    if status_filter not in {'all', 'active', 'inactive'}:
        return {'error': "status must be one of: all, active, inactive."}, 400

    if scope_filter not in {'all', 'all_enterprise', 'single_client'}:
        return {'error': "scope must be one of: all, all_enterprise, single_client."}, 400

    query = VcisoUpdate.query

    if status_filter == 'active':
        query = query.filter(VcisoUpdate.is_active == True)
    elif status_filter == 'inactive':
        query = query.filter(VcisoUpdate.is_active == False)

    if scope_filter == 'all_enterprise':
        query = query.filter(VcisoUpdate.user_id == None)
    elif scope_filter == 'single_client':
        query = query.filter(VcisoUpdate.user_id != None)

    if search_query:
        # Limit keyword length to prevent excessive query work
        keyword = f'%{search_query[:120]}%'
        matching_user_ids = (
            db.session.query(User.id)
            .filter(
                (User.email.ilike(keyword)) |
                (User.first_name.ilike(keyword)) |
                (User.last_name.ilike(keyword))
            )
            .subquery()
        )
        query = query.filter(
            (VcisoUpdate.title.ilike(keyword)) |
            (VcisoUpdate.author_name.ilike(keyword)) |
            (VcisoUpdate.note.ilike(keyword)) |
            (VcisoUpdate.user_id.in_(matching_user_ids))
        )

    total = query.count()

    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    updates = (
        query
        .order_by(VcisoUpdate.created_at.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )

    return {
        'updates': [_serialize_vciso_update(item) for item in updates],
        'total': total,
        'limit': safe_limit,
        'offset': safe_offset,
        'status': status_filter,
        'scope': scope_filter,
        'q': search_query,
    }, 200


@admin_bp.route('/api/admin/vciso/<int:update_id>', methods=['PATCH'])
@login_required
def admin_update_vciso_update(update_id):
    """Edit or deactivate a published vCISO update."""
    check_admin_role(current_user)

    update = VcisoUpdate.query.get_or_404(update_id)
    payload = request.get_json(silent=True) or {}
    updates_made = False

    if 'title' in payload:
        new_title = str(payload.get('title') or '').strip()
        if not new_title:
            return {'error': 'title cannot be empty.'}, 400
        update.title = new_title
        updates_made = True

    if 'note' in payload:
        new_note = str(payload.get('note') or '').strip()
        if not new_note:
            return {'error': 'note cannot be empty.'}, 400
        update.note = new_note
        updates_made = True

    if 'author_name' in payload:
        update.author_name = str(payload.get('author_name') or '').strip() or 'Gabriel Aloho'
        updates_made = True

    if 'action_items' in payload:
        action_items = payload.get('action_items')
        action_items_text = None
        if isinstance(action_items, list):
            cleaned = [str(item).strip() for item in action_items if str(item).strip()]
            action_items_text = '\n'.join(cleaned) if cleaned else None
        elif isinstance(action_items, str):
            action_items_text = action_items.strip() or None
        update.action_items = action_items_text
        updates_made = True

    target_user_id = payload.get('target_user_id', '__not_provided__')
    publish_to_all_enterprise = payload.get('publish_to_all_enterprise', '__not_provided__')

    if target_user_id != '__not_provided__' or publish_to_all_enterprise != '__not_provided__':
        if publish_to_all_enterprise is True and target_user_id not in ('__not_provided__', None):
            return {'error': 'Provide either target_user_id or publish_to_all_enterprise, not both.'}, 400

        if publish_to_all_enterprise is True:
            update.user_id = None
            updates_made = True
        elif target_user_id is not None and target_user_id != '__not_provided__':
            try:
                target_user_id = int(target_user_id)
            except (TypeError, ValueError):
                return {'error': 'target_user_id must be numeric.'}, 400

            target_user = User.query.get(target_user_id)
            if not target_user:
                return {'error': 'Target user not found.'}, 404

            latest_subscription = (
                Subscription.query
                .filter_by(user_id=target_user.id)
                .order_by(Subscription.end_date.desc())
                .first()
            )
            if not latest_subscription or not _is_enterprise_plan(latest_subscription.plan):
                return {'error': 'Target user does not have an enterprise subscription.'}, 400

            update.user_id = target_user.id
            updates_made = True
        elif target_user_id is None:
            update.user_id = None
            updates_made = True

    if 'is_active' in payload:
        update.is_active = bool(payload.get('is_active'))
        updates_made = True

    if not updates_made:
        return {'error': 'No updates provided.'}, 400

    db.session.commit()
    Logs.log_action(current_user, f"Updated vCISO update #{update.id}")

    return {
        'message': 'vCISO update updated.',
        'update': _serialize_vciso_update(update),
    }, 200


# Logout
@admin_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))
