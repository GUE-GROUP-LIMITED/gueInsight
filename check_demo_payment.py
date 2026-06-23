from app import db, app
from app.models import Subscription, BillingTransaction, User
from datetime import datetime

with app.app_context():
    user = User.query.filter_by(email='demo@example.com').first()
    if user:
        print(f'=== Demo User ===')
        print(f'Email: {user.email}')
        print(f'User ID: {user.id}')
        sub = Subscription.query.filter_by(user_id=user.id).first()
        if sub:
            print(f'\n=== Subscription ===')
            print(f'Plan: {sub.plan}')
            print(f'Is Trial: {sub.is_trial}')
            print(f'Start Date: {sub.start_date}')
            print(f'End Date: {sub.end_date}')
            print(f'Days Remaining: {(sub.end_date - datetime.utcnow()).days if sub.end_date else "N/A"}')
            
            txns = BillingTransaction.query.filter_by(user_id=user.id).order_by(BillingTransaction.created_at.desc()).all()
            print(f'\n=== Billing History ({len(txns)} transactions) ===')
            for i, txn in enumerate(txns[:5], 1):
                print(f'{i}. Provider: {txn.provider}, Status: {txn.status}')
                print(f'   Amount: €{txn.amount_minor/100} ({txn.currency})')
                print(f'   Period: {txn.period_start} to {txn.period_end}')
                print(f'   Txn ID: {txn.provider_txn_id}')
                print()
        else:
            print('No subscription found')
    else:
        print('Demo user not found')
