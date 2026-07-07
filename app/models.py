

from app import db
from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from enum import Enum as PyEnum
from sqlalchemy.types import Enum as SQLAlchemyEnum

def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)




# Event model for persistent event storage
class Event(db.Model):
    __tablename__ = 'event'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=_utc_now, nullable=False)
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
    triggered_at = db.Column(db.DateTime, default=_utc_now)
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
    country_of_residence = Column(String(100), nullable=True)
    newsletter_opt_in = Column(Boolean, nullable=False, default=False)
    gdpr_consent_at = Column(DateTime, nullable=True)
    gdpr_consent_version = Column(String(50), nullable=True)
    privacy_policy_version = Column(String(50), nullable=True)
    terms_accepted_at = Column(DateTime, nullable=True)
    marketing_consent_at = Column(DateTime, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    role = Column(SQLAlchemyEnum(UserRole), nullable=False, default=UserRole.USER)
    admin_role = Column(String(50), nullable=True)
    admin_permissions = Column(String(4000), nullable=True)
    invited_by_user_id = Column(Integer, nullable=True)
    invited_at = Column(DateTime, nullable=True)
    invitation_expires_at = Column(DateTime, nullable=True)
    invitation_token_hash = Column(String(128), nullable=True)
    invitation_accepted_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utc_now)
    
    # Stripe integration
    stripe_customer_id = Column(String(120), nullable=True, unique=True)
    stripe_subscription_id = Column(String(120), nullable=True)
    
    # Belgian payment methods
    sepa_mandate_id = Column(String(120), nullable=True)  # SEPA Direct Debit mandate ID
    sepa_iban_last4 = Column(String(4), nullable=True)    # Last 4 digits of IBAN
    
    # Address fields for invoicing
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)

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
    is_trial = Column(Boolean, nullable=False, default=False)
    
    # Stripe integration
    stripe_subscription_id = Column(String(120), nullable=True)
    stripe_customer_id = Column(String(120), nullable=True)
    
    # Payment tracking
    payment_method = Column(String(50), nullable=True, default='card')  # bancontact, sepa_debit, card, paypal, etc
    last_payment_date = Column(DateTime, nullable=True)

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
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)
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


class NotificationSeverity(PyEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AnalysisStatus(PyEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED_BY_PLAN = "blocked_by_plan"


class BillingStatus(PyEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class UserPreference(db.Model):
    __tablename__ = 'user_preference'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False, unique=True)
    avatar_url = Column(String(500), nullable=True)
    theme = Column(String(20), nullable=False, default='system')
    timezone = Column(String(80), nullable=False, default='UTC')
    language = Column(String(20), nullable=False, default='en')
    notification_email_enabled = Column(Boolean, nullable=False, default=True)
    notification_inapp_enabled = Column(Boolean, nullable=False, default=True)
    dashboard_layout = Column(String(2000), nullable=True)
    company_name = Column(String(255), nullable=True)
    company_logo_url = Column(String(500), nullable=True)
    company_address = Column(String(500), nullable=True)
    company_contact = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    user = db.relationship('User', backref=db.backref('preference', uselist=False, lazy=True))

    def to_dict(self):
        return {
            'avatar_url': self.avatar_url,
            'theme': self.theme,
            'timezone': self.timezone,
            'language': self.language,
            'notification_email_enabled': bool(self.notification_email_enabled),
            'notification_inapp_enabled': bool(self.notification_inapp_enabled),
            'dashboard_layout': self.dashboard_layout,
            'company_name': self.company_name,
            'company_logo_url': self.company_logo_url,
            'company_address': self.company_address,
            'company_contact': self.company_contact,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class UserNotification(db.Model):
    __tablename__ = 'user_notification'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(String(2000), nullable=False)
    severity = Column(SQLAlchemyEnum(NotificationSeverity), nullable=False, default=NotificationSeverity.INFO)
    action_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utc_now)

    user = db.relationship('User', backref=db.backref('notifications', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'severity': self.severity.value if hasattr(self.severity, 'value') else self.severity,
            'action_url': self.action_url,
            'is_read': bool(self.is_read),
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AnalysisTransaction(db.Model):
    __tablename__ = 'analysis_transaction'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    source_type = Column(String(30), nullable=False)
    input_ref = Column(String(1000), nullable=True)
    status = Column(SQLAlchemyEnum(AnalysisStatus), nullable=False, default=AnalysisStatus.QUEUED)
    plan_at_time = Column(String(50), nullable=False, default='free')
    items_count = Column(Integer, nullable=False, default=1)
    input_size_bytes = Column(Integer, nullable=True)
    processing_ms = Column(Integer, nullable=True)
    result_summary = Column(String(2000), nullable=True)
    error_message = Column(String(2000), nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    completed_at = Column(DateTime, nullable=True)

    user = db.relationship('User', backref=db.backref('analysis_transactions', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'source_type': self.source_type,
            'input_ref': self.input_ref,
            'status': self.status.value if hasattr(self.status, 'value') else self.status,
            'plan_at_time': self.plan_at_time,
            'items_count': self.items_count,
            'input_size_bytes': self.input_size_bytes,
            'processing_ms': self.processing_ms,
            'result_summary': self.result_summary,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class UserActivityEvent(db.Model):
    __tablename__ = 'user_activity_event'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    event_type = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    description = Column(String(500), nullable=False)
    event_metadata = Column('metadata', String(2000), nullable=True)
    created_at = Column(DateTime, default=_utc_now)

    user = db.relationship('User', backref=db.backref('activity_events', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'event_type': self.event_type,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'description': self.description,
            'metadata': self.event_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class BillingTransaction(db.Model):
    __tablename__ = 'billing_transaction'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    subscription_id = Column(Integer, ForeignKey('subscription.id'), nullable=True)
    provider = Column(String(50), nullable=False, default='internal')
    provider_txn_id = Column(String(120), nullable=True)
    amount_minor = Column(Integer, nullable=False, default=0)
    currency = Column(String(10), nullable=False, default='usd')
    status = Column(SQLAlchemyEnum(BillingStatus), nullable=False, default=BillingStatus.PENDING)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utc_now)

    user = db.relationship('User', backref=db.backref('billing_transactions', lazy=True))
    subscription = db.relationship('Subscription', backref=db.backref('billing_transactions', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'provider': self.provider,
            'provider_txn_id': self.provider_txn_id,
            'amount_minor': self.amount_minor,
            'currency': self.currency,
            'status': self.status.value if hasattr(self.status, 'value') else self.status,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class DataExportRequest(db.Model):
    __tablename__ = 'data_export_request'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    status = Column(String(30), nullable=False, default='queued')
    requested_at = Column(DateTime, default=_utc_now)
    completed_at = Column(DateTime, nullable=True)
    download_token = Column(String(120), nullable=True)

    user = db.relationship('User', backref=db.backref('data_export_requests', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'status': self.status,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class DataDeletionRequest(db.Model):
    __tablename__ = 'data_deletion_request'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(String(30), nullable=False, default='pending')
    requested_at = Column(DateTime, default=_utc_now)
    processed_at = Column(DateTime, nullable=True)
    processed_by_user_id = Column(Integer, ForeignKey('user.id'), nullable=True)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('data_deletion_requests', lazy=True))
    processed_by = db.relationship('User', foreign_keys=[processed_by_user_id], post_update=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reason': self.reason,
            'status': self.status,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'processed_by_user_id': self.processed_by_user_id,
        }


class SecurityEvent(db.Model):
    __tablename__ = 'security_event'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=True)
    event_type = Column(String(120), nullable=False)
    severity = Column(String(20), nullable=False, default='info')
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(String(2000), nullable=True)
    created_at = Column(DateTime, default=_utc_now)

    user = db.relationship('User', backref=db.backref('security_events', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'event_type': self.event_type,
            'severity': self.severity,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'details': self.details,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class EvidenceArtifact(db.Model):
    """Normalized evidence artifacts for ISO27001 / audit readiness."""
    __tablename__ = 'evidence_artifact'

    id = Column(Integer, primary_key=True)
    source = Column(String(100), nullable=False)  # e.g., 'm365', 'gws', 'app'
    artifact_type = Column(String(100), nullable=False)  # e.g., 'audit_log', 'access_control_matrix'
    raw_payload = Column(db.Text, nullable=False)  # JSON string of raw artifact
    indexed_fields = Column(db.Text, nullable=True)  # JSON string of extracted/indexed fields for search
    control_mappings = Column(db.String(500), nullable=True)  # ISO control ids mapped
    processed = Column(Boolean, nullable=False, default=False)
    collected_at = Column(DateTime, default=_utc_now)

    def to_dict(self):
        return {
            'id': self.id,
            'source': self.source,
            'artifact_type': self.artifact_type,
            'processed': bool(self.processed),
            'collected_at': self.collected_at.isoformat() if self.collected_at else None,
        }


class NIS2IncidentReport(db.Model):
    """NIS2 Directive critical infrastructure incident reporting model."""
    __tablename__ = 'nis2_incident_report'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    incident_type = Column(String(100), nullable=False)  # e.g., 'ransomware', 'data_breach', 'ddos', 'supply_chain'
    severity = Column(String(20), nullable=False)  # 'critical', 'high', 'medium', 'low'
    affected_systems = Column(String(500), nullable=True)  # Comma-separated system names
    initial_detection_at = Column(DateTime, nullable=False)
    description = Column(String(2000), nullable=False)
    actions_taken = Column(String(2000), nullable=True)  # Remediation steps
    notification_sent_at = Column(DateTime, nullable=True)
    notification_recipient = Column(String(200), nullable=True)  # Competent authority email/agency
    status = Column(String(50), nullable=False, default='reported')  # 'draft', 'reported', 'under_investigation', 'resolved'
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    user = db.relationship('User', backref=db.backref('nis2_incident_reports', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'incident_type': self.incident_type,
            'severity': self.severity,
            'affected_systems': self.affected_systems,
            'initial_detection_at': self.initial_detection_at.isoformat() if self.initial_detection_at else None,
            'description': self.description,
            'actions_taken': self.actions_taken,
            'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            'notification_recipient': self.notification_recipient,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class VcisoUpdate(db.Model):
    """Advisory updates posted by admin/vCISO staff for enterprise client dashboards."""
    __tablename__ = 'vciso_update'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=True)  # Null means all eligible enterprise users
    title = Column(String(255), nullable=False)
    note = Column(String(3000), nullable=False)
    action_items = Column(String(3000), nullable=True)
    author_name = Column(String(120), nullable=False, default='Gabriel Aloho')
    created_by_admin_id = Column(Integer, ForeignKey('user.id'), nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)
    is_active = Column(Boolean, nullable=False, default=True)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('vciso_updates', lazy=True))
    created_by_admin = db.relationship('User', foreign_keys=[created_by_admin_id], post_update=True)

    def to_dict(self):
        action_items = []
        if self.action_items:
            action_items = [item.strip() for item in self.action_items.split('\n') if item.strip()]

        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'note': self.note,
            'action_items': action_items,
            'author_name': self.author_name,
            'created_by_admin_id': self.created_by_admin_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': bool(self.is_active),
        }



# ===== ENTERPRISE FEATURES =====

class SubUser(db.Model):
    """Sub-user management for enterprise plans (SME/Large Enterprise)."""
    __tablename__ = 'sub_user'
    
    id = Column(Integer, primary_key=True)
    parent_user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    sub_user_id = Column(Integer, ForeignKey('user.id'), nullable=False, unique=True)
    role = Column(String(50), nullable=False, default='analyst')  # analyst, manager, admin
    permissions = Column(String(500), nullable=True)  # JSON: comma-separated permissions
    added_at = Column(DateTime, default=_utc_now)
    removed_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    parent = db.relationship('User', foreign_keys=[parent_user_id], backref=db.backref('sub_users', lazy=True))
    sub_user = db.relationship('User', foreign_keys=[sub_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'parent_user_id': self.parent_user_id,
            'sub_user_id': self.sub_user_id,
            'sub_user_email': self.sub_user.email if self.sub_user else None,
            'role': self.role,
            'permissions': self.permissions,
            'is_active': bool(self.is_active),
            'added_at': self.added_at.isoformat() if self.added_at else None,
        }


class BatchFileJob(db.Model):
    """Batch file processing job for multiple file analysis."""
    __tablename__ = 'batch_file_job'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    job_name = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default='queued')  # queued, processing, completed, failed
    total_files = Column(Integer, nullable=False, default=0)
    processed_files = Column(Integer, nullable=False, default=0)
    failed_files = Column(Integer, nullable=False, default=0)
    celery_task_id = Column(String(120), nullable=True)
    progress_percentage = Column(Integer, nullable=False, default=0)
    error_message = Column(String(2000), nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    user = db.relationship('User', backref=db.backref('batch_jobs', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'job_name': self.job_name,
            'status': self.status,
            'total_files': self.total_files,
            'processed_files': self.processed_files,
            'failed_files': self.failed_files,
            'progress_percentage': self.progress_percentage,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class BatchFileItem(db.Model):
    """Individual file in a batch processing job."""
    __tablename__ = 'batch_file_item'
    
    id = Column(Integer, primary_key=True)
    batch_job_id = Column(Integer, ForeignKey('batch_file_job.id'), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False, default='pending')  # pending, processing, completed, failed
    analysis_transaction_id = Column(Integer, ForeignKey('analysis_transaction.id'), nullable=True)
    error_message = Column(String(500), nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    
    batch_job = db.relationship('BatchFileJob', backref=db.backref('items', lazy=True))
    analysis = db.relationship('AnalysisTransaction', backref=db.backref('batch_items', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_job_id': self.batch_job_id,
            'file_name': self.file_name,
            'status': self.status,
            'analysis_transaction_id': self.analysis_transaction_id,
            'error_message': self.error_message,
            'processing_started_at': self.processing_started_at.isoformat() if self.processing_started_at else None,
            'processing_completed_at': self.processing_completed_at.isoformat() if self.processing_completed_at else None,
        }


class AnalyticsMetric(db.Model):
    """Store analytics metrics for advanced dashboards and reporting."""
    __tablename__ = 'analytics_metric'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=True)  # None for global metrics
    metric_type = Column(String(100), nullable=False)  # files_uploaded, analyses_completed, threats_detected, etc.
    metric_value = Column(Integer, nullable=False, default=0)
    metric_unit = Column(String(50), nullable=True)  # count, bytes, ms, percentage, etc.
    time_period = Column(String(30), nullable=False, default='daily')  # daily, weekly, monthly
    recorded_at = Column(DateTime, default=_utc_now)
    
    user = db.relationship('User', backref=db.backref('analytics_metrics', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'metric_type': self.metric_type,
            'metric_value': self.metric_value,
            'metric_unit': self.metric_unit,
            'time_period': self.time_period,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
        }


class AlertProcessingLog(db.Model):
    """Track real-time alert processing and execution."""
    __tablename__ = 'alert_processing_log'
    
    id = Column(Integer, primary_key=True)
    alert_id = Column(Integer, ForeignKey('alert.id'), nullable=False)
    processing_status = Column(String(50), nullable=False, default='received')  # received, processing, completed, failed
    processor_type = Column(String(100), nullable=True)  # webhook, email, sms, slack, pagerduty, etc.
    notification_sent_at = Column(DateTime, nullable=True)
    response_code = Column(String(10), nullable=True)
    response_message = Column(String(500), nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    last_retry_at = Column(DateTime, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    
    alert = db.relationship('Alert', backref=db.backref('processing_logs', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'alert_id': self.alert_id,
            'processing_status': self.processing_status,
            'processor_type': self.processor_type,
            'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
            'response_code': self.response_code,
            'retry_count': self.retry_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class SecurityToolIntegration(db.Model):
    """External security tool integrations (VirusTotal, AbuseIPDB, etc.)."""
    __tablename__ = 'security_tool_integration'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    tool_name = Column(String(100), nullable=False)  # virustotal, abuseipdb, shodan, etc.
    api_key_encrypted = Column(String(500), nullable=False)  # Should be encrypted in production
    is_active = Column(Boolean, nullable=False, default=True)
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(500), nullable=True)
    last_successful_call = Column(DateTime, nullable=True)
    last_failed_call = Column(DateTime, nullable=True)
    failure_reason = Column(String(500), nullable=True)
    rate_limit_remaining = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)
    
    user = db.relationship('User', backref=db.backref('tool_integrations', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'tool_name': self.tool_name,
            'is_active': bool(self.is_active),
            'last_successful_call': self.last_successful_call.isoformat() if self.last_successful_call else None,
            'last_failed_call': self.last_failed_call.isoformat() if self.last_failed_call else None,
            'rate_limit_remaining': self.rate_limit_remaining,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class FileUpload(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.DateTime, default=_utc_now)

    user = db.relationship('User', backref=db.backref('file_uploads', lazy=True))

# Logs model to track user actions
class Logs(db.Model):
    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    action = Column(String(200), nullable=False)
    timestamp = Column(DateTime, default=_utc_now)

    # Relationship with User
    user = db.relationship("User", backref="logs")

    # Method to log actions
    @staticmethod
    def log_action(user, action_description):
        log_entry = Logs(
            user_id=user.id,
            action=action_description,
            timestamp=_utc_now()
        )
        db.session.add(log_entry)
        db.session.commit()

