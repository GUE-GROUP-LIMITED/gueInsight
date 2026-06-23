import os
import stripe

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # Validate critical secrets at startup
    _SECRET_KEY = os.getenv('SECRET_KEY')
    _SECURITY_SALT = os.getenv('SECURITY_PASSWORD_SALT')
    
    if not _SECRET_KEY:
        raise ValueError('CRITICAL: SECRET_KEY environment variable is required for production')
    if not _SECURITY_SALT:
        raise ValueError('CRITICAL: SECURITY_PASSWORD_SALT environment variable is required for production')
    
    SECRET_KEY = _SECRET_KEY
    SECURITY_PASSWORD_SALT = _SECURITY_SALT
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'SQLALCHEMY_DATABASE_URI',
        'sqlite:///' + os.path.join(BASE_DIR, '..', 'instance', 'app.db')
    )
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    OUTPUT_FOLDER = os.path.join(BASE_DIR, 'output/user_reports')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Email configuration
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', '587'))
    MAIL_USE_TLS = str(os.getenv('MAIL_USE_TLS', 'true')).lower() in {'1', 'true', 'yes'}
    MAIL_USERNAME = os.getenv('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@guecyber.com')
    SESSION_TYPE = 'filesystem'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    SESSION_COOKIE_SECURE = str(os.getenv('SESSION_COOKIE_SECURE', 'false')).lower() in {'1', 'true', 'yes'}
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    PERMANENT_SESSION_LIFETIME = int(os.getenv('PERMANENT_SESSION_LIFETIME_SECONDS', '86400'))
    GDPR_POLICY_VERSION = os.getenv('GDPR_POLICY_VERSION', '2026-04')
    TERMS_VERSION = os.getenv('TERMS_VERSION', '2026-04')
    DATA_RETENTION_DAYS = int(os.getenv('DATA_RETENTION_DAYS', '180'))
    EU_ONLY_DATA_RESIDENCY = str(os.getenv('EU_ONLY_DATA_RESIDENCY', 'false')).lower() in {'1', 'true', 'yes'}
    PREFERRED_DATA_REGION = os.getenv('PREFERRED_DATA_REGION', 'eu-west-1')
    ALLOWED_EXTENSIONS = {
        'txt', 'json', 'xml', 'log', 'pcap', 'pcapng', 
        'yar', 'yara', 'pdf', 'sqlite', 'db', 'mdb', 'bin'
    }

    @staticmethod
    def user_upload_folder(user_id):
        """Generate user-specific upload folder."""
        return os.path.join(Config.UPLOAD_FOLDER, str(user_id))
    
    @staticmethod
    def user_output_folder(user_id):
        """Generate user-specific output folder."""
        return os.path.join(Config.OUTPUT_FOLDER, str(user_id))

    # Stripe API key
    STRIPE_API_KEY = os.getenv('STRIPE_API_KEY', '')
    STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', os.getenv('STRIPE_API_KEY', ''))
    STRIPE_PUBLIC_KEY = os.getenv('STRIPE_PUBLIC_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    stripe.api_key = STRIPE_SECRET_KEY or STRIPE_API_KEY
    
    # Frontend configuration
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
