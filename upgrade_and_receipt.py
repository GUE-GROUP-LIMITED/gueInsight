#!/usr/bin/env python
"""
Script to upgrade subscription to Enterprise Elite and generate receipt
"""
import os
import sys
import json
from datetime import datetime, timedelta

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import User, Subscription, BillingTransaction
from app.routes.users_billing_routes import register_billing_routes
from flask_login import login_user

# Create app context
app = create_app()

with app.app_context():
    # Get or create test user
    user = User.query.filter_by(email='demo@guecyber.com').first()
    
    if not user:
        print("❌ User not found")
        sys.exit(1)
    
    print(f"\n📋 Current User: {user.first_name} {user.last_name} ({user.email})")
    
    # Get current subscription
    current_sub = Subscription.query.filter_by(user_id=user.id).order_by(Subscription.end_date.desc()).first()
    
    if current_sub:
        print(f"📊 Current Plan: {current_sub.plan}")
        print(f"   Start: {current_sub.start_date}")
        print(f"   End: {current_sub.end_date}")
    
    # Create upgrade subscription
    now = datetime.utcnow()
    start_date = now
    
    # If there's an active subscription, start new one after current ends
    if current_sub and current_sub.end_date and current_sub.end_date > now:
        start_date = current_sub.end_date
    
    new_plan = 'enterprise_elite'
    new_subscription = Subscription(
        user_id=user.id,
        plan=new_plan,
        start_date=start_date,
        end_date=start_date + timedelta(days=30),
        stripe_subscription_id=None,
        payment_status='completed',
    )
    
    db.session.add(new_subscription)
    db.session.flush()  # Get the subscription ID
    
    print(f"\n✅ Upgrading to: {new_plan}")
    print(f"   Start: {start_date}")
    print(f"   End: {start_date + timedelta(days=30)}")
    
    # Create billing transaction for the upgrade
    from app.subscription_service import COMPLIANCE_TIERS
    
    # Get pricing
    tier_config = COMPLIANCE_TIERS.get(new_plan, {})
    amount_minor = tier_config.get('price_monthly_eur', 0)
    
    # Create transaction
    transaction = BillingTransaction(
        user_id=user.id,
        subscription_id=new_subscription.id,
        type='subscription_upgrade',
        amount_minor=amount_minor,
        currency='EUR',
        description=f'Upgrade to {tier_config.get("name", "Enterprise Elite")}',
        status='completed',
        provider='manual',
        transaction_date=now,
        period_start=start_date,
        period_end=start_date + timedelta(days=30),
        metadata={
            'previous_plan': current_sub.plan if current_sub else 'starter',
            'new_plan': new_plan,
            'upgrade_type': 'plan_upgrade',
        }
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    print(f"\n💳 Billing Transaction Created:")
    print(f"   Transaction ID: {transaction.id}")
    print(f"   Type: {transaction.type}")
    print(f"   Amount: €{transaction.amount_minor / 100:.2f}")
    print(f"   Status: {transaction.status}")
    
    # Generate receipt HTML
    receipt_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Subscription Upgrade Receipt #{transaction.id}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                padding: 40px;
                color: #111;
                background: #f9f9f9;
            }}
            .receipt {{
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }}
            .header {{
                text-align: center;
                border-bottom: 2px solid #6eece5;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            .header h1 {{
                margin: 0;
                color: #67b4ff;
                font-size: 28px;
            }}
            .header p {{
                margin: 5px 0 0 0;
                color: #666;
                font-size: 14px;
            }}
            .section {{
                margin-bottom: 25px;
            }}
            .section-title {{
                font-weight: 600;
                color: #111;
                margin-bottom: 12px;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            .detail-row {{
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #f0f0f0;
                font-size: 14px;
            }}
            .detail-row:last-child {{
                border-bottom: none;
            }}
            .detail-label {{
                color: #666;
            }}
            .detail-value {{
                font-weight: 500;
                color: #111;
            }}
            .amount-section {{
                background: linear-gradient(135deg, rgba(110,236,229,0.1), rgba(167,139,250,0.1));
                border-left: 4px solid #6eece5;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
            }}
            .amount {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 18px;
                font-weight: 600;
                color: #111;
            }}
            .status-badge {{
                display: inline-block;
                background: #d4f4e5;
                color: #0b7c4d;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }}
            .footer {{
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                text-align: center;
                font-size: 12px;
                color: #999;
            }}
            .plan-comparison {{
                background: #f9f9f9;
                padding: 15px;
                border-radius: 4px;
                font-size: 13px;
                margin: 15px 0;
            }}
            .plan-comparison-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e0e0e0;
            }}
            .plan-comparison-row:last-child {{
                border-bottom: none;
            }}
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <h1>🎉 Upgrade Confirmation</h1>
                <p>Subscription upgrade receipt</p>
            </div>
            
            <div class="section">
                <div class="section-title">Customer Information</div>
                <div class="detail-row">
                    <span class="detail-label">Name</span>
                    <span class="detail-value">{user.first_name} {user.last_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">{user.email}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Organization</span>
                    <span class="detail-value">{user.company_name or 'N/A'}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Subscription Upgrade Details</div>
                <div class="plan-comparison">
                    <div class="plan-comparison-row">
                        <strong>Previous Plan:</strong>
                        <strong>{current_sub.plan.replace('_', ' ').title() if current_sub else 'Starter'}</strong>
                    </div>
                    <div class="plan-comparison-row">
                        <strong>New Plan:</strong>
                        <strong style="color: #67b4ff;">Enterprise Elite</strong>
                    </div>
                    <div class="plan-comparison-row">
                        <strong>Upgrade Date:</strong>
                        <strong>{now.strftime('%B %d, %Y at %H:%M:%S UTC')}</strong>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Billing Information</div>
                <div class="detail-row">
                    <span class="detail-label">Subscription Start</span>
                    <span class="detail-value">{start_date.strftime('%B %d, %Y')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Subscription End</span>
                    <span class="detail-value">{(start_date + timedelta(days=30)).strftime('%B %d, %Y')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Billing Cycle</span>
                    <span class="detail-value">30 days (Monthly)</span>
                </div>
            </div>
            
            <div class="amount-section">
                <div class="amount">
                    <span>Monthly Subscription Fee</span>
                    <span style="color: #67b4ff;">€{transaction.amount_minor / 100:.2f}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Transaction Details</div>
                <div class="detail-row">
                    <span class="detail-label">Receipt #</span>
                    <span class="detail-value">REC-{transaction.id:06d}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction ID</span>
                    <span class="detail-value">{transaction.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Subscription Upgrade</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value"><span class="status-badge">✓ Completed</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Method</span>
                    <span class="detail-value">Account Credit</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Currency</span>
                    <span class="detail-value">EUR (€)</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Enterprise Elite Features Included</div>
                <div style="font-size: 13px; line-height: 1.8;">
                    ✓ All Enterprise Risk features<br>
                    ✓ EU-only data residency enforcement<br>
                    ✓ SOC2 Type II readiness assessment<br>
                    ✓ Custom compliance dashboards<br>
                    ✓ Dedicated compliance officer support<br>
                    ✓ Incident response playbooks<br>
                    ✓ Unlimited file/text analysis<br>
                    ✓ Real-time security alerting<br>
                    ✓ Compliance training materials
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for upgrading to Enterprise Elite!</p>
                <p>For support or questions, visit <strong>app.gueinsight.com/support</strong></p>
                <p>Generated: {datetime.utcnow().isoformat()} UTC</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Save receipt to file
    receipt_filename = f"receipt_{transaction.id}_{now.strftime('%Y%m%d_%H%M%S')}.html"
    receipt_path = os.path.join(os.path.dirname(__file__), receipt_filename)
    
    with open(receipt_path, 'w', encoding='utf-8') as f:
        f.write(receipt_html)
    
    print(f"\n📄 Receipt Generated:")
    print(f"   File: {receipt_filename}")
    print(f"   Path: {receipt_path}")
    
    # Send email with receipt (simulated - in production would send via SMTP)
    print(f"\n📧 Email Notification:")
    print(f"   To: {user.email}")
    print(f"   Subject: ✓ Enterprise Elite Upgrade - Receipt #{transaction.id}")
    print(f"   Content: Customized receipt with upgrade details and new plan features")
    
    print(f"\n✅ Upgrade Complete!")
    print(f"   Old Plan: {current_sub.plan if current_sub else 'Starter'} → New Plan: {new_plan}")
    print(f"   Amount: €{transaction.amount_minor / 100:.2f}/month")
    print(f"   Effective: {start_date.strftime('%B %d, %Y')}")
