from functools import wraps
from flask import abort
from flask_login import current_user


def _is_admin(user):
    role = getattr(user, 'role', None)
    role_value = getattr(role, 'value', role)
    return role_value == 'admin'


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not _is_admin(current_user):
            abort(403)
        return f(*args, **kwargs)
    return decorated_function
