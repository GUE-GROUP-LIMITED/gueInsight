#!/usr/bin/env python3
"""Test script to verify payment system configuration"""

from app import create_app, db
import sys

try:
    app = create_app()
    
    print("\n" + "="*60)
    print("✅ APP LOADED SUCCESSFULLY")
    print("="*60 + "\n")
    
    print("Configuration Status:")
    print(f"  ✓ Stripe Secret Key:     {bool(app.config.get('STRIPE_SECRET_KEY'))}")
    print(f"  ✓ Stripe Public Key:     {bool(app.config.get('STRIPE_PUBLIC_KEY'))}")
    print(f"  ✓ Stripe Webhook Secret: {bool(app.config.get('STRIPE_WEBHOOK_SECRET'))}")
    print(f"  ✓ Frontend URL:          {app.config.get('FRONTEND_URL')}")
    
    print("\nImporting subscription service...")
    from app.subscription_service import COMPLIANCE_TIERS
    
    print(f"✅ Found {len(COMPLIANCE_TIERS)} pricing tiers:\n")
    
    for plan_key, config in COMPLIANCE_TIERS.items():
        requires_payment = config.get('requires_payment', False)
        stripe_price = config.get('stripe_price_id', 'Not configured')
        payment_status = "💳 Paid" if requires_payment else "✓ Free"
        print(f"  {payment_status}  {plan_key:25} - {config['name']:30} (Stripe: {stripe_price})")
    
    print("\n" + "="*60)
    print("✅ PAYMENT SYSTEM IS READY FOR SETUP")
    print("="*60 + "\n")
    
    print("Next steps:")
    print("1. Get Stripe test keys from https://dashboard.stripe.com/apikeys")
    print("2. Update .env with your keys (STRIPE_SECRET_KEY, STRIPE_PUBLIC_KEY)")
    print("3. Run: python3 scripts/setup_stripe_prices.py")
    print("4. Update app/subscription_service.py with the returned price IDs\n")
    
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
