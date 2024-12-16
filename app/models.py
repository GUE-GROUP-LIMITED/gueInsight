from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from app import db
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy.types import Enum as SQLAlchemyEnum

# Enum for user roles
class UserRole(PyEnum):
    USER = "user"
    ADMIN = "admin"

# User model with basic fields and roles
class User(db.Model, UserMixin):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(200), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=False)
    role = Column(SQLAlchemyEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Method to set password for User
    def set_password(self, password):
        self.password = generate_password_hash(password)
        db.session.commit()

    # Method to check password for User
    def check_password(self, password):
        return check_password_hash(self.password, password)

# Subscription model for user plans
class Subscription(db.Model):
    __tablename__ = 'subscription'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    plan = Column(String(50), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    # Relationship with User
    user = db.relationship("User", backref="subscriptions")
  

class FileUpload(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('file_uploads', lazy=True))

# Logs model to track user actions
class Logs(db.Model):
    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    action = Column(String(200), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationship with User
    user = db.relationship("User", backref="logs")

    # Method to log actions
    @staticmethod
    def log_action(user, action_description):
        log_entry = Logs(
            user_id=user.id,
            action=action_description,
            timestamp=datetime.utcnow()
        )
        db.session.add(log_entry)
        db.session.commit()
