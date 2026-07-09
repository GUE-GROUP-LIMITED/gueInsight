# app/__init__.py

import os
import datetime
import json

from flask import Flask, request, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from flask_login import LoginManager

from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_migrate import Migrate
from sqlalchemy.exc import SQLAlchemyError

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


def _register_realtime_ingest_route(app):
    from app.models import Event
    from app.notifications.alerts import send_slack_alert, send_teams_alert
    from app.security import require_api_key, rate_limit

    @app.route('/api/ingest_event', methods=['POST'])
    @require_api_key
    @rate_limit
    def ingest_event():
        if not request.is_json:
            return {'status': 'error', 'message': 'Request must be JSON.'}, 400
        if request.content_length and request.content_length > 1024 * 1024:
            return {'status': 'error', 'message': 'Payload too large. Max size is 1MB.'}, 413

        event = request.get_json(silent=True)
        if not isinstance(event, dict):
            return {'status': 'error', 'message': 'Event payload must be a JSON object.'}, 400

        allowed_types = {'alert', 'log', 'event', 'ioc', 'threat', 'generic'}
        event_type = str(event.get('type', 'generic')).strip().lower()
        if event_type not in allowed_types:
            return {'status': 'error', 'message': f'Unsupported event type. Allowed: {", ".join(sorted(allowed_types))}'}, 400

        source = str(event.get('source', 'api')).strip()
        if not source:
            return {'status': 'error', 'message': 'source is required.'}, 400

        try:
            from app.integrations.rapidapi import enrich_event
            enrichment = enrich_event(event)
        except Exception as exc:
            enrichment = {'error': str(exc)}

        if not isinstance(enrichment, dict):
            enrichment = {'result': enrichment}

        try:
            db_event = Event(
                timestamp=datetime.datetime.utcnow(),
                source=source,
                event_type=event_type,
                raw_data=json.dumps(event),
                enrichment=json.dumps(enrichment),
                threat_detected=any(isinstance(v, dict) and v.get('malicious') for v in enrichment.values()),
            )
            db.session.add(db_event)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()

        try:
            threat_summary = None
            for key, value in enrichment.items():
                if isinstance(value, dict) and value.get('malicious'):
                    threat_summary = f'Threat detected in {key}: {value}'
                    break
            if threat_summary:
                send_slack_alert(threat_summary)
                send_teams_alert(threat_summary)
        except Exception:
            pass

        return {'status': 'success', 'received_event': event, 'enrichment': enrichment}, 200

def create_app():
    app = Flask(__name__)
    # Load configuration from Config class
    app.config.from_object(Config)
    register_observability(app)

    # Allow browser calls from the local Vite frontend while keeping cookies enabled.
    configured_origins = os.getenv(
        'FRONTEND_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://insights.guecyber.com'
    )
    allowed_origins = [origin.strip() for origin in configured_origins.split(',') if origin.strip()]
    CORS(
        app,
        resources={r"/.*": {"origins": allowed_origins}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Auth-Context"],
    )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin and origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key, X-Auth-Context'
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

    @login_manager.unauthorized_handler
    def handle_unauthorized():
        # API consumers should receive JSON 401 instead of a redirect to a POST-only login route.
        wants_json = request.path.startswith('/auth') or request.path.startswith('/api') or request.path.startswith('/admin')
        if wants_json:
            return {'error': 'Authentication required'}, 401
        frontend_url = (app.config.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/')
        return redirect(f'{frontend_url}/login')

    @app.route('/')
    def index():
        return {'status': 'ok', 'service': 'gueInsight backend'}, 200

    @app.route('/healthz')
    def healthz():
        return {
            'status': 'ok',
            'service': 'gueInsight backend',
            'environment': app.config.get('APP_ENV', 'development'),
        }, 200

    @app.route('/login', methods=['GET'])
    def frontend_login_redirect():
        frontend_url = (app.config.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/')
        return redirect(f'{frontend_url}/login')

    @app.route('/signup', methods=['GET'])
    def frontend_signup_redirect():
        frontend_url = (app.config.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/')
        return redirect(f'{frontend_url}/signup')

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

    should_create_schema = bool(app.config.get('AUTO_CREATE_SCHEMA', True))
    if should_create_schema:
        with app.app_context():
            from app.models import User, Subscription  # Import your models
            db.create_all()  # Create tables only outside production

    # Register webhook routes before returning the app so Render serves them.
    app.register_blueprint(stripe_bp)
    app.register_blueprint(stripe_recurring_bp)
    app.register_blueprint(belgian_bp)
    _register_realtime_ingest_route(app)
    
    # Initialize production error handlers
    from app.production_errors import init_production_errors, validate_production_config
    init_production_errors(app)
    
    # Validate production configuration.
    app_env = str(app.config.get('APP_ENV') or app.config.get('ENV') or '').strip().lower()
    if app_env in {'production', 'prod'}:
        validate_production_config(app)

    return app


