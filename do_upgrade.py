import sys, os
sys.path.insert(0, '.')
from app import create_app, db
from app.models import User, Subscription, BillingTransaction
from app.subscription_service import COMPLIANCE_TIERS
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    user = User.query.filter_by(email='demo@guecyber.com').first()
    if not user:
        print('User not found')
        sys.exit(1)
    
    print(f'User: {user.first_name} {user.last_name}')
    
    current_sub = Subscription.query.filter_by(user_id=user.id).order_by(Subscription.end_date.desc()).first()
    print(f'Current: {current_sub.plan if current_sub else "starter"}')
    
    now = datetime.utcnow()
    start_date = now
    
    if current_sub and current_sub.end_date and current_sub.end_date > now:
        start_date = current_sub.end_date
    
    new_subscription = Subscription(
        user_id=user.id,
        plan='enterprise_elite',
        start_date=start_date,
        end_date=start_date + timedelta(days=30),
        payment_status='completed',
    )
    
    db.session.add(new_subscription)
    db.session.flush()
    
    tier_config = COMPLIANCE_TIERS.get('enterprise_elite', {})
    amount_minor = tier_config.get('price_monthly_eur', 0)
    
    transaction = BillingTransaction(
        user_id=user.id,
        subscription_id=new_subscription.id,
        type='subscription_upgrade',
        amount_minor=amount_minor,
        currency='EUR',
        description='Upgrade to Enterprise Elite',
        status='completed',
        provider='manual',
        transaction_date=now,
        period_start=start_date,
        period_end=start_date + timedelta(days=30),
        metadata={'previous_plan': current_sub.plan if current_sub else 'starter', 'new_plan': 'enterprise_elite'}
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    print(f'Upgraded to: enterprise_elite')
    print(f'Transaction ID: {transaction.id}')
    print(f'Amount: EUR {amount_minor / 100:.2f}/month')
    print(f'Effective: {start_date.strftime("%B %d, %Y")}')
    print(f'Status: COMPLETED')
