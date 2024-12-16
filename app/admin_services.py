# admin_services.py
from app.models import User, Logs, FileUpload
from flask import flash
from app import db
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta

def get_filtered_users(search_query, role_filter):
    """Fetch filtered users based on search and role filter."""
    users_query = User.query
    if search_query:
        users_query = users_query.filter(
            (User.email.ilike(f'%{search_query}%')) |
            (User.first_name.ilike(f'%{search_query}%')) |
            (User.last_name.ilike(f'%{search_query}%'))
        )
    if role_filter:
        users_query = users_query.filter(User.role == role_filter)

    return users_query.all()

def handle_new_user_addition(form_data):
    """Handles the process of adding a new user."""
    email = form_data.get('email')
    first_name = form_data.get('first_name')
    last_name = form_data.get('last_name')
    password = form_data.get('password')
    role = form_data.get('role', 'user')

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        flash(f'User with email {email} already exists.', 'warning')
    else:
        hashed_password = generate_password_hash(password)
        new_user = User(
            email=email,
            password=hashed_password,
            first_name=first_name,
            last_name=last_name,
            role=role
        )
        db.session.add(new_user)
        db.session.commit()
        flash('User added successfully!', 'success')

def get_file_uploads_in_last_24_hours():
    """Get the number of file uploads in the last 24 hours."""
    twenty_four_hours_ago = datetime.now() - timedelta(days=1)
    uploads = FileUpload.query.filter(FileUpload.timestamp > twenty_four_hours_ago).count()
    return uploads

def some_condition_for_critical_alert():
    """Check if there is a critical alert."""
    return get_failed_login_attempts_for_recent_period() > 5

def get_failed_login_attempts_for_recent_period():
    """Fetch the number of failed login attempts in the last hour."""
    one_hour_ago = datetime.now() - timedelta(hours=1)
    failed_attempts = Logs.query.filter(Logs.timestamp > one_hour_ago, Logs.success == False).count()
    return failed_attempts

def check_file_hash_against_ransomware_hashes(file):
    """Check if a file's hash matches known ransomware hashes."""
    known_ransomware_hashes = ['hash1', 'hash2', 'hash3']  # Example hash list
    return file.hash in known_ransomware_hashes

def check_for_suspicious_ip_activity(user_ip):
    """Check for suspicious IP activity."""
    suspicious_ips = ['192.168.1.1', '10.0.0.1']  # Example of suspicious IPs
    return user_ip in suspicious_ips

def detect_unusual_user_activity():
    """Detect unusual user activity (e.g., new locations or times)."""
    # Replace with actual detection logic
    return False

def get_recent_system_errors():
    """Get recent system errors from logs (e.g., server crashes)."""
    # Replace with actual logic
    return False
