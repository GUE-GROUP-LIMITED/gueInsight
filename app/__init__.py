# app/__init__.py

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from app.config import Config


#from flask_wtf.csrf import CSRFProtect


# Initialize the database instance
db = SQLAlchemy()
mail = Mail()  # Initialize Mail here without passing an app

def create_app():
    app = Flask(__name__)
    # Load configuration from Config class
    app.config.from_object(Config)

    

    db.init_app(app)  # Bind SQLAlchemy to the app
    mail.init_app(app)  # Bind Flask-Mail to the app
    #csrf = CSRFProtect(app)
    #csrf.init_app(app)
    from routes.users_routes import users_bp
    from routes.admin_routes import admin_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        from app.models import User, Subscription  # Import your models
        db.create_all()  # Create tables
    


    return app


