#!/usr/bin/env python3
"""
Create test user for development/demo purposes
"""
import sys
sys.path.insert(0, '.')

from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    # Check if test user already exists
    existing = User.query.filter_by(email='demo@gueinsight.com').first()
    if existing:
        print(f"✓ Test user already exists: demo@gueinsight.com")
        print(f"  Password: demo12345")
    else:
        # Create test user
        user = User(
            email='demo@gueinsight.com',
            first_name='Demo',
            last_name='User',
            phone_number='+1234567890',
            company='GueInsight Test',
            job_title='Security Analyst'
        )
        user.set_password('demo12345')
        
        db.session.add(user)
        db.session.commit()
        print("✓ Test user created successfully!")
        print(f"\n  Email: demo@gueinsight.com")
        print(f"  Password: demo12345")
        print(f"  Name: Demo User")
        print(f"  Company: GueInsight Test")

print("\n" + "="*60)
print("LOGIN INSTRUCTIONS:")
print("="*60)
print("\n1. Go to: http://localhost:5173/login")
print("2. Enter credentials:")
print("   • Email: demo@gueinsight.com")
print("   • Password: demo12345")
print("3. Click 'Login'")
print("\nYou'll be redirected to the dashboard to test file analysis.")
print("="*60 + "\n")
