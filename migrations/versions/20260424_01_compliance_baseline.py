"""compliance baseline

Revision ID: 20260424_01
Revises:
Create Date: 2026-04-24 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '20260424_01'
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(table_name):
    inspector = inspect(op.get_bind())
    return inspector.has_table(table_name)


def _column_exists(table_name, column_name):
    if not _table_exists(table_name):
        return False
    inspector = inspect(op.get_bind())
    columns = inspector.get_columns(table_name)
    return any(column['name'] == column_name for column in columns)


def upgrade():
    if not _column_exists('user', 'gdpr_consent_at'):
        op.add_column('user', sa.Column('gdpr_consent_at', sa.DateTime(), nullable=True))
    if not _column_exists('user', 'gdpr_consent_version'):
        op.add_column('user', sa.Column('gdpr_consent_version', sa.String(length=50), nullable=True))
    if not _column_exists('user', 'privacy_policy_version'):
        op.add_column('user', sa.Column('privacy_policy_version', sa.String(length=50), nullable=True))
    if not _column_exists('user', 'terms_accepted_at'):
        op.add_column('user', sa.Column('terms_accepted_at', sa.DateTime(), nullable=True))
    if not _column_exists('user', 'marketing_consent_at'):
        op.add_column('user', sa.Column('marketing_consent_at', sa.DateTime(), nullable=True))
    if not _column_exists('user', 'last_login_at'):
        op.add_column('user', sa.Column('last_login_at', sa.DateTime(), nullable=True))

    if not _table_exists('data_export_request'):
        op.create_table(
            'data_export_request',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=30), nullable=False),
            sa.Column('requested_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('download_token', sa.String(length=120), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id']),
            sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('data_deletion_request'):
        op.create_table(
            'data_deletion_request',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('reason', sa.String(length=500), nullable=True),
            sa.Column('status', sa.String(length=30), nullable=False),
            sa.Column('requested_at', sa.DateTime(), nullable=True),
            sa.Column('processed_at', sa.DateTime(), nullable=True),
            sa.Column('processed_by_user_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['processed_by_user_id'], ['user.id']),
            sa.ForeignKeyConstraint(['user_id'], ['user.id']),
            sa.PrimaryKeyConstraint('id')
        )

    if not _table_exists('security_event'):
        op.create_table(
            'security_event',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('event_type', sa.String(length=120), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False),
            sa.Column('ip_address', sa.String(length=64), nullable=True),
            sa.Column('user_agent', sa.String(length=500), nullable=True),
            sa.Column('details', sa.String(length=2000), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id']),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    if _table_exists('security_event'):
        op.drop_table('security_event')

    if _table_exists('data_deletion_request'):
        op.drop_table('data_deletion_request')

    if _table_exists('data_export_request'):
        op.drop_table('data_export_request')

    existing_columns = set()
    if _table_exists('user'):
        inspector = inspect(op.get_bind())
        existing_columns = {column['name'] for column in inspector.get_columns('user')}

    removable_columns = [
        'last_login_at',
        'marketing_consent_at',
        'terms_accepted_at',
        'privacy_policy_version',
        'gdpr_consent_version',
        'gdpr_consent_at',
    ]

    with op.batch_alter_table('user') as batch_op:
        for column_name in removable_columns:
            if column_name in existing_columns:
                batch_op.drop_column(column_name)
