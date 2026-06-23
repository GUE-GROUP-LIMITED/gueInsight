#!/usr/bin/env python3
"""
STRIPE SETUP GUIDE
This script will help you create Stripe prices for all plans.

PREREQUISITE: You need actual Stripe API keys
Get them from: https://dashboard.stripe.com/apikeys (Test Mode)

Steps:
1. Set STRIPE_SECRET_KEY in .env with your test sk_test_xxx key
2. Run this script: python3 setup_stripe_interactive.py
3. The script will create products and prices
4. Copy the price IDs back to app/subscription_service.py
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app

def setup_stripe_interactive():
    """Interactively setup Stripe prices."""
    
    app = create_app()
    stripe_secret = app.config.get('STRIPE_SECRET_KEY')
    
    print("\n" + "="*70)
    print("STRIPE PAYMENT SETUP WIZARD")
    print("="*70 + "\n")
    
    # Check Stripe configuration
    if not stripe_secret:
        print("❌ ERROR: STRIPE_SECRET_KEY not configured in .env")
        print("\nTo fix:")
        print("1. Go to https://dashboard.stripe.com/apikeys")
        print("2. Switch to TEST MODE (toggle in top right)")
        print("3. Copy the Secret Key (starts with sk_test_)")
        print("4. Add to .env: STRIPE_SECRET_KEY=sk_test_xxxxx")
        print("5. Run this script again\n")
        return False
    
    if not stripe_secret.startswith('sk_test_'):
        print("⚠️  WARNING: You are using a LIVE Stripe key!")
        print("    For development, use TEST mode keys (sk_test_)")
        response = input("    Continue anyway? (y/n): ").lower()
        if response != 'y':
            print("Cancelled.\n")
            return False
    
    print(f"✅ Stripe API Key configured: {stripe_secret[:20]}...\n")
    
    # Import Stripe after config is verified
    try:
        import stripe
        stripe.api_key = stripe_secret
        
        # Test the connection
        stripe.Product.list(limit=1)
        print("✅ Successfully connected to Stripe!\n")
        
    except Exception as e:
        print(f"❌ Failed to connect to Stripe: {e}\n")
        return False
    
    # Pricing tiers to create
    from app.subscription_service import COMPLIANCE_TIERS
    
    print("="*70)
    print("CREATING STRIPE PRODUCTS AND PRICES")
    print("="*70 + "\n")
    
    price_mapping = {}
    
    for plan_key, plan_config in COMPLIANCE_TIERS.items():
        if not plan_config.get('requires_payment'):
            print(f"⏭️  Skipping {plan_key} (free plan - no payment required)\n")
            continue
        
        plan_name = plan_config['name']
        amount = plan_config['price_monthly_eur']
        description = plan_config['description']
        
        print(f"Setting up: {plan_name}")
        print(f"  Amount: €{amount/100:.2f}/month")
        print(f"  Description: {description}")
        
        try:
            # Search for existing product
            products = stripe.Product.list(limit=100)
            product = None
            for p in products.data:
                if p.get('name') == f"GueInsight {plan_name}":
                    product = p
                    print(f"  ℹ️  Product exists: {product.id}")
                    break
            
            # Create product if it doesn't exist
            if not product:
                product = stripe.Product.create(
                    name=f"GueInsight {plan_name}",
                    type='service',
                    description=description,
                    metadata={'plan_key': plan_key, 'gueinsight_plan': 'true'},
                )
                print(f"  ✅ Created product: {product.id}")
            
            # Create price
            price = stripe.Price.create(
                product=product.id,
                unit_amount=int(amount),  # Amount in cents
                currency='eur',
                recurring={
                    'interval': 'month',
                    'interval_count': 1,
                },
                metadata={'plan_key': plan_key},
            )
            
            price_mapping[plan_key] = price.id
            print(f"  ✅ Created price: {price.id}\n")
            
        except Exception as e:
            print(f"  ❌ ERROR: {e}\n")
            return False
    
    # Display results
    print("\n" + "="*70)
    print("✅ STRIPE SETUP COMPLETE!")
    print("="*70 + "\n")
    
    print("NEXT STEP: Update app/subscription_service.py\n")
    print("Copy the following price IDs to COMPLIANCE_TIERS:\n")
    
    for plan_key, price_id in price_mapping.items():
        print(f'    "{plan_key}": {{')
        print(f'        ...existing config...')
        print(f'        "stripe_price_id": "{price_id}",')
        print(f'    }},\n')
    
    # Save to file for reference
    config_file = Path(__file__).parent / 'stripe_prices_config.json'
    with open(config_file, 'w') as f:
        json.dump(price_mapping, f, indent=2)
    print(f"\n✅ Saved to: {config_file}\n")
    
    return True

if __name__ == '__main__':
    try:
        success = setup_stripe_interactive()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nCancelled.\n")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
