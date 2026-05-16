"""add subscription is_trial flag

Revision ID: 20260516_01
Revises: 20260424_01
Create Date: 2026-05-16 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '20260516_01'
down_revision = '20260424_01'
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
    if _table_exists('subscription') and not _column_exists('subscription', 'is_trial'):
        op.add_column('subscription', sa.Column('is_trial', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade():
    if _table_exists('subscription') and _column_exists('subscription', 'is_trial'):
        with op.batch_alter_table('subscription') as batch_op:
            batch_op.drop_column('is_trial')
