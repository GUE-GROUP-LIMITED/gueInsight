

from app import db
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from enum import Enum as PyEnum
from sqlalchemy.types import Enum as SQLAlchemyEnum




# Event model for persistent event storage
class Event(db.Model):
    __tablename__ = 'event'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    source = db.Column(db.String(100))  # e.g., 'api', 'manual', etc.
    event_type = db.Column(db.String(100))  # e.g., 'alert', 'log', etc.
    raw_data = db.Column(db.Text, nullable=False)  # JSON string of the event
    enrichment = db.Column(db.Text)  # JSON string of enrichment results
    threat_detected = db.Column(db.Boolean, default=False)

# AlertRule model for user/admin-defined alert rules
class AlertRule(db.Model):
    __tablename__ = 'alert_rule'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Null for global/admin rules
    rule_type = db.Column(db.String(50), nullable=False)  # e.g., 'keyword', 'ioc', 'severity'
    value = db.Column(db.String(255), nullable=False)
    severity = db.Column(db.String(20), default='medium')
    enabled = db.Column(db.Boolean, default=True)
    user = db.relationship('User', backref=db.backref('alert_rules', lazy=True))

# Alert model for triggered alerts
class Alert(db.Model):
    __tablename__ = 'alert'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('alert_rule.id'), nullable=False)
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    description = db.Column(db.String(255))
    event = db.relationship('Event', backref=db.backref('alerts', lazy=True))
    rule = db.relationship('AlertRule', backref=db.backref('alerts', lazy=True))


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
    company = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    team_size = Column(String(50), nullable=True)
    primary_use_case = Column(String(255), nullable=True)
    newsletter_opt_in = Column(Boolean, nullable=False, default=False)
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


class SupportTicketStatus(PyEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_ON_USER = "waiting_on_user"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SupportTicket(db.Model):
    __tablename__ = 'support_ticket'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    subject = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False)
    category = Column(String(80), nullable=True)
    priority = Column(String(20), nullable=False, default='medium')
    status = Column(SQLAlchemyEnum(SupportTicketStatus), nullable=False, default=SupportTicketStatus.OPEN)
    assigned_admin_id = Column(Integer, ForeignKey('user.id'), nullable=True)
    attended_by_id = Column(Integer, ForeignKey('user.id'), nullable=True)
    resolution_summary = Column(String(2000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    attended_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('support_tickets', lazy=True))
    assigned_admin = db.relationship('User', foreign_keys=[assigned_admin_id], post_update=True)
    attended_by = db.relationship('User', foreign_keys=[attended_by_id], post_update=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'subject': self.subject,
            'description': self.description,
            'category': self.category,
            'priority': self.priority,
            'status': self.status.value if hasattr(self.status, 'value') else self.status,
            'assigned_admin_id': self.assigned_admin_id,
            'attended_by_id': self.attended_by_id,
            'resolution_summary': self.resolution_summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'attended_at': self.attended_at.isoformat() if self.attended_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }
  

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
