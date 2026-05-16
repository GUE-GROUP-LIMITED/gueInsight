from app import create_app, db
from sqlalchemy import inspect, text


def ensure_is_trial_column():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        if 'subscription' not in inspector.get_table_names():
            print('subscription table does not exist; running create_all to ensure tables')
            db.create_all()
            inspector = inspect(db.engine)

        cols = [c['name'] for c in inspector.get_columns('subscription')]
        if 'is_trial' in cols:
            print('is_trial column already exists')
            return

        # Try to add column (works for SQLite and Postgres)
        try:
            print('Adding is_trial column to subscription table')
            db.session.execute(text('ALTER TABLE subscription ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT 0'))
            db.session.commit()
            print('is_trial column added')
        except Exception as e:
            print('Failed to add column via raw ALTER TABLE:', e)
            print('Attempting SQLAlchemy batch alter')
            from alembic import op
            # As a fallback, call raw SQL alter for sqlite or other DBs
            raise


if __name__ == '__main__':
    ensure_is_trial_column()
