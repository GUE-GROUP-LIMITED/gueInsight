# app/__init__.py

import os

from flask import Flask, request
from flask_cors import CORS
from dotenv import load_dotenv
from flask_login import LoginManager

from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_migrate import Migrate

load_dotenv()

from app.config import Config
from app.observability import register_observability


#from flask_wtf.csrf import CSRFProtect
from flask_cors import CORS


# Initialize the database instance
db = SQLAlchemy()
mail = Mail()  # Initialize Mail here without passing an app
migrate = Migrate()
from .routes.stripe_webhooks import stripe_bp
from .routes.stripe_recurring_billing import stripe_recurring_bp
from .routes.belgian_payments_routes import belgian_bp
login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    # Load configuration from Config class
    app.config.from_object(Config)
    register_observability(app)

    # Allow browser calls from the local Vite frontend while keeping cookies enabled.
    configured_origins = os.getenv(
        'FRONTEND_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,https://insights.guecyber.com'
    )
    allowed_origins = [origin.strip() for origin in configured_origins.split(',') if origin.strip()]
    CORS(
        app,
        resources={r"/.*": {"origins": allowed_origins}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin and origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http: https:"
        if request.is_secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    

    db.init_app(app)  # Bind SQLAlchemy to the app
    mail.init_app(app)  # Bind Flask-Mail to the app
    migrate.init_app(app, db)  # Bind Flask-Migrate to the app
    login_manager.init_app(app)
    # Ensure the login view matches the auth route defined in users_routes.py
    login_manager.login_view = 'users.auth_login'

    @app.route('/')
    def index():
        return {'status': 'ok', 'service': 'gueInsight backend'}, 200

    @app.route('/healthz')
    def healthz():
        return {'status': 'ok'}, 200

    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        """Handle CORS preflight OPTIONS requests."""
        return '', 200

    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User

        try:
            return User.query.get(int(user_id))
        except (TypeError, ValueError):
            return None
    #csrf = CSRFProtect(app)
    #csrf.init_app(app)
    from app.routes.users_routes import users_bp
    from app.routes.admin_routes import admin_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        from app.models import User, Subscription  # Import your models
        db.create_all()  # Create tables

    # Register webhook routes before returning the app so Render serves them.
    app.register_blueprint(stripe_bp)
    app.register_blueprint(stripe_recurring_bp)
    app.register_blueprint(belgian_bp)
    
    # Initialize production error handlers
    from app.production_errors import init_production_errors, validate_production_config
    init_production_errors(app)
    
    # Validate production configuration
    if app.config.get('ENV') == 'production':
        validate_production_config(app)

    return app


