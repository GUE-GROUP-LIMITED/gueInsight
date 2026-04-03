# app/__init__.py

import os

from flask import Flask, request
from flask_cors import CORS
from dotenv import load_dotenv

from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_migrate import Migrate

load_dotenv()

from app.config import Config


#from flask_wtf.csrf import CSRFProtect


# Initialize the database instance
db = SQLAlchemy()
mail = Mail()  # Initialize Mail here without passing an app
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    # Load configuration from Config class
    app.config.from_object(Config)

    # Allow browser calls from the local Vite frontend while keeping cookies enabled.
    configured_origins = os.getenv('FRONTEND_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    allowed_origins = [origin.strip() for origin in configured_origins.split(',') if origin.strip()]
    CORS(
        app,
        resources={r"/.*": {"origins": allowed_origins}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin and origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        return response

    

    db.init_app(app)  # Bind SQLAlchemy to the app
    mail.init_app(app)  # Bind Flask-Mail to the app
    migrate.init_app(app, db)  # Bind Flask-Migrate to the app
    #csrf = CSRFProtect(app)
    #csrf.init_app(app)
    from app.routes.users_routes import users_bp
    from app.routes.admin_routes import admin_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        from app.models import User, Subscription  # Import your models
        db.create_all()  # Create tables
    


    return app


