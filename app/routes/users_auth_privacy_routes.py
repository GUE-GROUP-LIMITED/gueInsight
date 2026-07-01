from flask import request, current_app, url_for, send_file
from flask_login import current_user, login_user, logout_user, login_required
from werkzeug.security import generate_password_hash
import re


def register_auth_privacy_routes(users_bp):
    from app.routes import users_routes as ur
    email_pattern = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    @users_bp.route('/auth/session', methods=['GET'])
    def auth_session():
        if not current_user.is_authenticated:
            return {'authenticated': False, 'user': None}, 200
        return {'authenticated': True, 'user': ur._serialize_auth_user(current_user)}, 200

    @users_bp.route('/auth/login', methods=['POST'])
    def auth_login():
        ur._sync_user_profile_columns()
        payload = request.get_json(silent=True) or request.form
        email = (payload.get('email') or '').strip().lower()
        password = payload.get('password') or ''
        ip_address = request.remote_addr or 'unknown'
        rate_key = f"{email}:{ip_address}"

        if not email or not password:
            return {'error': 'Email and password are required.'}, 400

        if ur._is_login_rate_limited(rate_key):
            ur._log_security_event(
                event_type='auth.login.rate_limited',
                severity='warning',
                details={'email': email},
            )
            ur.db.session.commit()
            return {'error': 'Too many login attempts. Please try again later.'}, 429

        user = ur.User.query.filter_by(email=email).first()
        authenticated_via_supabase = False
        auth_source = 'local'

        if not user or not user.check_password(password):
            if ur.sign_in_with_password and ur.sync_local_user_from_supabase and ur.supabase_auth_enabled():
                supabase_payload, supabase_error = ur.sign_in_with_password(email, password)
                supabase_user = (supabase_payload or {}).get('user') if supabase_payload else None
                if supabase_user:
                    user, _ = ur.sync_local_user_from_supabase(supabase_user)
                    authenticated_via_supabase = True
                    auth_source = 'supabase'
                else:
                    current_app.logger.info('Supabase auth fallback failed for %s: %s', email, supabase_error)

        if not user or not (authenticated_via_supabase or user.check_password(password)):
            ur._log_security_event(
                event_type='auth.login.failed',
                severity='warning',
                user_id=getattr(user, 'id', None),
                details={'email': email},
            )
            ur.db.session.commit()
            return {'error': 'Invalid credentials.'}, 401

        if not bool(getattr(user, 'is_active', True)):
            ur._log_security_event(
                event_type='auth.login.deactivated_account',
                severity='warning',
                user_id=user.id,
                details={'email': email},
            )
            ur.db.session.commit()
            return {'error': 'This account is deactivated.'}, 403

        user.last_login_at = ur._utc_now()
        ur._log_security_event(
            event_type='auth.login.success',
            severity='info',
            user_id=user.id,
            details={'email': email},
        )
        ur.db.session.commit()
        login_user(user)
        return {'message': 'Login successful.', 'auth_source': auth_source, 'user': ur._serialize_auth_user(user)}, 200

    @users_bp.route('/auth/signup', methods=['POST'])
    def auth_signup():
        ur._sync_user_profile_columns()
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
        newsletter_opt_in = ur._parse_bool(payload.get('newsletter') or payload.get('newsletter_opt_in'))
        agreed_to_terms = ur._parse_bool(payload.get('agree_to_terms') or payload.get('agreed_to_terms'))
        gdpr_consent = ur._parse_bool(payload.get('gdpr_consent'))

        if not agreed_to_terms or not gdpr_consent:
            return {'error': 'You must accept the Terms and Privacy Policy and provide GDPR consent.'}, 400

        if not email or not password:
            return {'error': 'Email and password are required.'}, 400

        if not email_pattern.match(email):
            return {'error': 'A valid email address is required.'}, 400

        if len(password) < 10:
            return {'error': 'Password must be at least 10 characters.'}, 400

        if not any(ch.isupper() for ch in password) or not any(ch.islower() for ch in password) or not any(ch.isdigit() for ch in password):
            return {'error': 'Password must include uppercase, lowercase, and numeric characters.'}, 400

        existing_user = ur.User.query.filter_by(email=email).first()
        if existing_user:
            return {'error': 'An account with this email already exists.'}, 400

        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        now = ur._utc_now()
        policy_version = current_app.config.get('GDPR_POLICY_VERSION', '2026-04')
        terms_version = current_app.config.get('TERMS_VERSION', policy_version)
        new_user = ur.User(
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
            role=ur.UserRole.USER,
        )
        ur.db.session.add(new_user)
        ur.db.session.commit()

        # Provision a default free subscription so access/limits logic has a stable baseline.
        free_subscription = ur.Subscription(
            user_id=new_user.id,
            plan='free',
            start_date=now,
            end_date=now + ur.datetime.timedelta(days=3650),
            is_trial=False,
        )
        ur.db.session.add(free_subscription)
        ur.db.session.commit()

        ur._get_or_create_user_preference(new_user.id)
        ur._log_user_activity(
            new_user.id,
            event_type='account.created',
            description='Created account.',
            entity_type='user',
            entity_id=new_user.id,
        )
        ur._create_user_notification(
            new_user.id,
            notification_type='system',
            title='Welcome to GueInsight',
            message='Your account is ready. Complete your profile preferences to personalize your dashboard.',
            severity='info',
            action_url='/profile',
        )
        ur._log_security_event(
            event_type='auth.account.created',
            severity='info',
            user_id=new_user.id,
            details={'policy_version': policy_version, 'terms_version': terms_version},
        )
        ur.db.session.commit()

        login_user(new_user)
        return {'message': 'Signup successful.', 'user': ur._serialize_auth_user(new_user)}, 201

    @users_bp.route('/auth/logout', methods=['POST'])
    def auth_logout():
        if current_user.is_authenticated:
            ur._log_security_event(
                event_type='auth.logout',
                severity='info',
                user_id=current_user.id,
            )
            ur.db.session.commit()
            logout_user()
        return {'message': 'Logged out.'}, 200

    @users_bp.route('/auth/password/reset/request', methods=['POST'])
    def auth_password_reset_request():
        payload = request.get_json(silent=True) or request.form
        email = (payload.get('email') or '').strip().lower()
        redirect_to = (payload.get('redirect_to') or '').strip() or None

        if not email or not email_pattern.match(email):
            return {'error': 'A valid email address is required.'}, 400

        user = ur.User.query.filter_by(email=email).first()
        if not user:
            # Do not reveal user existence; keep response generic.
            return {'message': 'If that account exists, a reset email has been sent.'}, 200

        if ur.request_password_reset and ur.supabase_auth_enabled():
            ok, reset_error = ur.request_password_reset(email, redirect_to=redirect_to)
            if not ok:
                current_app.logger.warning('Supabase reset request failed for %s: %s', email, reset_error)
                return {'error': reset_error or 'Unable to send reset email right now.'}, 503
            return {'message': 'If that account exists, a reset email has been sent.'}, 200

        serializer = ur.get_serializer(current_app.config['SECRET_KEY'], current_app.config['SECURITY_PASSWORD_SALT'])
        token = serializer.dumps({'user_id': user.id, 'email': user.email})
        frontend_url = (current_app.config.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/')
        reset_link = f'{frontend_url}/reset-password?token={token}'

        try:
            msg = ur.Message('Password Reset Request', recipients=[user.email])
            msg.body = (
                'We received a request to reset your GueInsight password.\n\n'
                f'Reset link (valid for 1 hour): {reset_link}\n\n'
                'If you did not request this, you can ignore this email.'
            )
            ur.mail.send(msg)
        except Exception as exc:
            current_app.logger.exception('Password reset email failed for %s: %s', email, exc)
            return {'error': 'Unable to send reset email right now. Please contact support.'}, 503

        return {'message': 'If that account exists, a reset email has been sent.'}, 200

    @users_bp.route('/auth/password/reset/confirm', methods=['POST'])
    def auth_password_reset_confirm():
        payload = request.get_json(silent=True) or request.form
        token = (payload.get('token') or '').strip()
        password = payload.get('password') or ''

        if not token:
            return {'error': 'Reset token is required.'}, 400
        if len(password) < 10:
            return {'error': 'Password must be at least 10 characters.'}, 400
        if not any(ch.isupper() for ch in password) or not any(ch.islower() for ch in password) or not any(ch.isdigit() for ch in password):
            return {'error': 'Password must include uppercase, lowercase, and numeric characters.'}, 400

        serializer = ur.get_serializer(current_app.config['SECRET_KEY'], current_app.config['SECURITY_PASSWORD_SALT'])
        try:
            token_payload = serializer.loads(token, max_age=3600)
        except Exception:
            return {'error': 'Reset link is invalid or expired.'}, 400

        user_id = int(token_payload.get('user_id') or 0)
        email = (token_payload.get('email') or '').strip().lower()
        user = ur.User.query.filter_by(id=user_id, email=email).first()
        if not user:
            return {'error': 'Reset link is invalid or expired.'}, 400

        user.password = generate_password_hash(password, method='pbkdf2:sha256')
        user.last_login_at = ur._utc_now()
        ur.db.session.commit()

        return {'message': 'Password updated successfully. You can now sign in.'}, 200

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
        now = ur._utc_now()

        if 'newsletter_opt_in' in payload:
            newsletter_opt_in = ur._parse_bool(payload.get('newsletter_opt_in'))
            current_user.newsletter_opt_in = newsletter_opt_in
            current_user.marketing_consent_at = now if newsletter_opt_in else None

        if ur._parse_bool(payload.get('refresh_legal_consent')):
            policy_version = current_app.config.get('GDPR_POLICY_VERSION', '2026-04')
            current_user.gdpr_consent_at = now
            current_user.gdpr_consent_version = policy_version
            current_user.privacy_policy_version = policy_version
            current_user.terms_accepted_at = now

        ur._log_user_activity(
            current_user.id,
            event_type='privacy.consent.updated',
            description='Updated privacy consent settings.',
            entity_type='privacy',
        )
        ur._log_security_event(
            event_type='privacy.consent.updated',
            severity='info',
            user_id=current_user.id,
        )
        ur.db.session.commit()

        return {
            'message': 'Consent settings updated.',
            'user': ur._serialize_auth_user(current_user),
        }, 200

    @users_bp.route('/auth/privacy/export', methods=['POST'])
    @login_required
    def auth_privacy_export():
        export_request = ur.DataExportRequest(user_id=current_user.id, status='processing', requested_at=ur._utc_now())
        ur.db.session.add(export_request)
        ur.db.session.flush()

        export_payload = ur._build_privacy_export_payload(current_user)
        export_path = ur._write_privacy_export(current_user.id, export_request.id, export_payload)
        download_token = ur._privacy_export_serializer().dumps({
            'request_id': export_request.id,
            'user_id': current_user.id,
        })

        export_request.status = 'completed'
        export_request.completed_at = ur._utc_now()
        export_request.download_token = download_token

        ur._log_user_activity(
            current_user.id,
            event_type='privacy.data_exported',
            description='Exported personal account data.',
            entity_type='privacy',
            metadata={'export_request_id': export_request.id, 'export_path': export_path},
        )
        ur._log_security_event(
            event_type='privacy.data_exported',
            severity='info',
            user_id=current_user.id,
            details={'export_request_id': export_request.id},
        )
        ur.db.session.commit()

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
            token_payload = ur._privacy_export_serializer().loads(token, max_age=86400)
        except Exception:
            return {'error': 'Invalid or expired export token.'}, 400

        if int(token_payload.get('user_id') or 0) != current_user.id:
            return {'error': 'Forbidden.'}, 403

        export_request = ur.DataExportRequest.query.filter_by(
            id=token_payload.get('request_id'),
            user_id=current_user.id,
            download_token=token,
            status='completed',
        ).first()
        if not export_request:
            return {'error': 'Export request not found.'}, 404

        export_path = ur.os.path.join(ur._privacy_export_dir(), f'user_{current_user.id}_export_{export_request.id}.json')
        if not ur.os.path.exists(export_path):
            return {'error': 'Export file not found.'}, 404

        ur._log_user_activity(
            current_user.id,
            event_type='privacy.data_export_downloaded',
            description='Downloaded exported personal account data.',
            entity_type='privacy',
            metadata={'export_request_id': export_request.id},
        )
        ur._log_security_event(
            event_type='privacy.data_export_downloaded',
            severity='info',
            user_id=current_user.id,
            details={'export_request_id': export_request.id},
        )
        ur.db.session.commit()

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
            ur.DataDeletionRequest.query
            .filter_by(user_id=current_user.id, status='pending')
            .order_by(ur.DataDeletionRequest.requested_at.desc())
            .first()
        )
        if existing_pending:
            return {
                'error': 'A deletion request is already pending for this account.',
                'request': existing_pending.to_dict(),
            }, 409

        deletion_request = ur.DataDeletionRequest(
            user_id=current_user.id,
            reason=reason,
            status='pending',
            requested_at=ur._utc_now(),
        )
        current_user.is_active = False
        ur.db.session.add(deletion_request)

        ur._log_user_activity(
            current_user.id,
            event_type='privacy.deletion_requested',
            description='Submitted account deletion request.',
            entity_type='privacy',
        )
        ur._log_security_event(
            event_type='privacy.deletion_requested',
            severity='warning',
            user_id=current_user.id,
            details={'reason': reason},
        )
        ur.db.session.commit()

        logout_user()
        return {
            'message': 'Deletion request submitted. Account has been deactivated pending review.',
            'request': deletion_request.to_dict(),
        }, 202

    @users_bp.route('/auth/profile', methods=['PATCH'])
    @login_required
    def auth_update_profile():
        ur._sync_user_profile_columns()
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
        ur.db.session.commit()

        ur._log_user_activity(
            current_user.id,
            event_type='profile.updated',
            description='Updated profile details.',
            entity_type='profile',
        )
        ur.db.session.commit()

        return {'message': 'Profile updated.', 'user': ur._serialize_auth_user(current_user)}, 200

    @users_bp.route('/auth/preferences', methods=['GET', 'PATCH'])
    @login_required
    def auth_preferences():
        preference = ur._get_or_create_user_preference(current_user.id)

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
            'company_name',
            'company_logo_url',
            'company_address',
            'company_contact',
        }

        for field_name in allowed_fields:
            if field_name in payload:
                setattr(preference, field_name, payload.get(field_name))

        ur.db.session.commit()
        ur._log_user_activity(
            current_user.id,
            event_type='preferences.updated',
            description='Updated profile preferences.',
            entity_type='profile',
        )
        ur.db.session.commit()

        return {'message': 'Preferences updated.', 'preferences': preference.to_dict(), 'user': ur._serialize_auth_user(current_user)}, 200