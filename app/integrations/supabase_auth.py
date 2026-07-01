import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import requests
from werkzeug.security import generate_password_hash

from app import db
from app.models import User, UserRole


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_role(role_like: Any) -> Optional[str]:
    if not role_like:
        return None
    raw = str(role_like)
    normalized = raw.split('.')[-1].strip().lower()
    return normalized or None


def _supabase_base_url() -> Optional[str]:
    base_url = (os.getenv('SUPABASE_URL') or '').strip().rstrip('/')
    return base_url or None


def _supabase_anon_key() -> Optional[str]:
    key = (os.getenv('SUPABASE_ANON_KEY') or '').strip()
    return key or None


def _supabase_service_role_key() -> Optional[str]:
    key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or '').strip()
    return key or None


def supabase_auth_enabled() -> bool:
    return bool(_supabase_base_url() and _supabase_anon_key())


def _headers(api_key: str, bearer_token: Optional[str] = None) -> Dict[str, str]:
    headers = {
        'Content-Type': 'application/json',
        'apikey': api_key,
    }
    if bearer_token:
        headers['Authorization'] = f'Bearer {bearer_token}'
    return headers


def sign_in_with_password(email: str, password: str, timeout_seconds: int = 15) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not supabase_auth_enabled():
        return None, 'Supabase Auth is not configured.'

    url = f"{_supabase_base_url()}/auth/v1/token?grant_type=password"
    payload = {
        'email': email,
        'password': password,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers=_headers(_supabase_anon_key()),
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        return None, f'Supabase sign-in request failed: {exc}'

    data = response.json() if response.content else {}
    if response.status_code >= 400:
        return None, data.get('error_description') or data.get('msg') or 'Supabase sign-in failed.'

    return data, None


def sign_up_user(email: str, password: str, user_metadata: Optional[Dict[str, Any]] = None, timeout_seconds: int = 15) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not supabase_auth_enabled():
        return None, 'Supabase Auth is not configured.'

    url = f"{_supabase_base_url()}/auth/v1/signup"
    payload = {
        'email': email,
        'password': password,
        'data': user_metadata or {},
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers=_headers(_supabase_anon_key()),
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        return None, f'Supabase signup request failed: {exc}'

    data = response.json() if response.content else {}
    if response.status_code >= 400:
        return None, data.get('msg') or data.get('error_description') or 'Supabase signup failed.'

    return data, None


def request_password_reset(email: str, redirect_to: Optional[str] = None, timeout_seconds: int = 15) -> Tuple[bool, Optional[str]]:
    if not supabase_auth_enabled():
        return False, 'Supabase Auth is not configured.'

    url = f"{_supabase_base_url()}/auth/v1/recover"
    payload: Dict[str, Any] = {'email': email}
    if redirect_to:
        payload['redirect_to'] = redirect_to

    try:
        response = requests.post(
            url,
            json=payload,
            headers=_headers(_supabase_anon_key()),
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        return False, f'Supabase password reset request failed: {exc}'

    data = response.json() if response.content else {}
    if response.status_code >= 400:
        return False, data.get('msg') or data.get('error_description') or 'Password reset request failed.'

    return True, None


def create_admin_user(email: str, password: str, user_metadata: Optional[Dict[str, Any]] = None, timeout_seconds: int = 15) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not supabase_auth_enabled():
        return None, 'Supabase Auth is not configured.'

    service_role_key = _supabase_service_role_key()
    if not service_role_key:
        return None, 'SUPABASE_SERVICE_ROLE_KEY is required to create admin users in Supabase.'

    url = f"{_supabase_base_url()}/auth/v1/admin/users"
    payload = {
        'email': email,
        'password': password,
        'email_confirm': True,
        'user_metadata': user_metadata or {},
        'app_metadata': {'role': 'admin'},
    }

    try:
        response = requests.post(
            url,
            json=payload,
            headers=_headers(service_role_key, bearer_token=service_role_key),
            timeout=timeout_seconds,
        )
    except requests.RequestException as exc:
        return None, f'Supabase admin create request failed: {exc}'

    data = response.json() if response.content else {}
    if response.status_code >= 400:
        return None, data.get('msg') or data.get('error_description') or 'Supabase admin create failed.'

    return data, None


def sync_local_user_from_supabase(supabase_user: Dict[str, Any], fallback_role: UserRole = UserRole.USER) -> Tuple[User, bool]:
    email = (supabase_user.get('email') or '').strip().lower()
    if not email:
        raise ValueError('Supabase user payload is missing email.')

    user_metadata = supabase_user.get('user_metadata') or {}
    app_metadata = supabase_user.get('app_metadata') or {}

    role = fallback_role
    normalized_role = _normalize_role(app_metadata.get('role') or user_metadata.get('role'))
    if normalized_role == 'admin':
        role = UserRole.ADMIN

    user = User.query.filter_by(email=email).first()
    created = False

    first_name = (user_metadata.get('first_name') or user_metadata.get('given_name') or 'Supabase').strip()
    last_name = (user_metadata.get('last_name') or user_metadata.get('family_name') or 'User').strip()
    phone_number = (user_metadata.get('phone_number') or user_metadata.get('phone') or '0000000000').strip()

    if not user:
        created = True
        user = User(
            email=email,
            password=generate_password_hash(os.urandom(24).hex(), method='pbkdf2:sha256'),
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            role=role,
            is_active=True,
            created_at=_utc_now(),
        )
        db.session.add(user)
    else:
        if not user.first_name:
            user.first_name = first_name
        if not user.last_name:
            user.last_name = last_name
        if not user.phone_number:
            user.phone_number = phone_number
        user.role = role if role == UserRole.ADMIN else user.role

    user.company = (user_metadata.get('company') or user.company)
    user.job_title = (user_metadata.get('job_title') or user.job_title)
    user.team_size = (user_metadata.get('team_size') or user.team_size)
    user.primary_use_case = (user_metadata.get('primary_use_case') or user.primary_use_case)
    user.last_login_at = _utc_now()
    user.is_active = True

    return user, created
