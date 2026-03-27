import os
import stripe

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'SQLALCHEMY_DATABASE_URI',
        'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'gueInsight_db.db')
    )
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    OUTPUT_FOLDER = os.path.join(BASE_DIR, 'output/user_reports')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = 'alohoaondoaver@gmail.com'
    MAIL_PASSWORD = 'kpnp dwbe sqcs ktvk'
    MAIL_DEFAULT_SENDER = 'alohoaondoaver@gmail.com'
    SECURITY_PASSWORD_SALT = os.urandom(24).hex()
    SECRET_KEY = os.urandom(24).hex()
    SESSION_TYPE = 'filesystem'
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
    stripe.api_key = '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'
