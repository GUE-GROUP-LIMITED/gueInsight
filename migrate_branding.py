#!/usr/bin/env python
"""Add company branding columns to UserPreference table."""
from app import create_app, db
from sqlalchemy import text

app = create_app()
with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE user_preference ADD COLUMN company_name VARCHAR(255)"))
        db.session.execute(text("ALTER TABLE user_preference ADD COLUMN company_logo_url VARCHAR(500)"))
        db.session.execute(text("ALTER TABLE user_preference ADD COLUMN company_address VARCHAR(500)"))
        db.session.execute(text("ALTER TABLE user_preference ADD COLUMN company_contact VARCHAR(255)"))
        db.session.commit()
        print("✓ UserPreference table updated with company branding columns")
    except Exception as e:
        if 'duplicate column' in str(e).lower():
            print("✓ Company branding columns already exist")
        else:
            print(f"Note: {e}")
