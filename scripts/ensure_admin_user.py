import argparse
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from werkzeug.security import generate_password_hash

from app import create_app, db
from app.models import User, UserRole


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_args():
    parser = argparse.ArgumentParser(
        description='Ensure a GueInsight admin account exists and has a known password.'
    )
    parser.add_argument('--email', required=True, help='Admin email address')
    parser.add_argument('--password', required=True, help='Password to set for the admin user')
    parser.add_argument('--first-name', default='Admin', help='First name to use when creating a user')
    parser.add_argument('--last-name', default='User', help='Last name to use when creating a user')
    parser.add_argument('--phone-number', default='0000000000', help='Phone number to use when creating a user')
    parser.add_argument('--country', default='Belgium', help='Country to use when creating a user')
    return parser.parse_args()


def ensure_admin_user(args):
    normalized_email = args.email.strip().lower()
    user = User.query.filter_by(email=normalized_email).first()
    created = False

    if not user:
        user = User(
            email=normalized_email,
            password=generate_password_hash(args.password),
            first_name=args.first_name.strip() or 'Admin',
            last_name=args.last_name.strip() or 'User',
            phone_number=args.phone_number.strip() or '0000000000',
            country_of_residence=args.country.strip() or 'Belgium',
            role=UserRole.ADMIN,
            is_active=True,
            email_verified_at=utc_now(),
        )
        db.session.add(user)
        created = True
    else:
        user.password = generate_password_hash(args.password)
        user.role = UserRole.ADMIN
        user.is_active = True
        if not getattr(user, 'email_verified_at', None):
            user.email_verified_at = utc_now()

    db.session.commit()

    print({
        'created': created,
        'id': user.id,
        'email': user.email,
        'role': getattr(user.role, 'value', user.role),
        'is_active': user.is_active,
        'email_verified_at': user.email_verified_at.isoformat() if user.email_verified_at else None,
    })


def main():
    args = parse_args()
    app = create_app()
    with app.app_context():
        ensure_admin_user(args)


if __name__ == '__main__':
    main()