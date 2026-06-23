#!/usr/bin/env python3
"""
Script to setup Stripe prices for all billing plans.
Run this once to create all prices in Stripe test mode, then update app/subscription_service.py
with the returned price IDs.

Usage:
    python3 scripts/setup_stripe_prices.py

This script will:
1. Create or verify Stripe products for each plan
2. Create or verify Stripe prices for each plan
3. Output the price IDs to use in app/subscription_service.py
"""

import os
import sys
import stripe
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app

def setup_stripe_prices():
    """Create Stripe products and prices for all plans."""
    
    app = create_app()
    stripe.api_key = app.config.get('STRIPE_SECRET_KEY')
    
    if not stripe.api_key or not stripe.api_key.startswith('sk_test_'):
        print("❌ Error: STRIPE_SECRET_KEY not configured or not in test mode")
        print("   Add STRIPE_SECRET_KEY=sk_test_xxx to .env file")
        return False
    
    plans = {
        'starter': {
            'name': 'GueInsight Starter',
            'amount': 4990,  # €49.90
            'description': 'For small teams and individual professionals',
        },
        'compliance_pro': {
            'name': 'GueInsight Compliance Pro',
            'amount': 9990,  # €99.90
            'description': 'GDPR-focused threat detection with audit trails',
        },
        'enterprise_professional': {
            'name': 'GueInsight Enterprise Professional',
            'amount': 29990,  # €299.90
            'description': 'GDPR + NIS2 compliance for growing enterprises',
        },
        'enterprise_risk': {
            'name': 'GueInsight Enterprise Risk',
            'amount': 49900,  # €499.00
            'description': 'NIS2 + ISO27001 risk management',
        },
        'enterprise_elite': {
            'name': 'GueInsight Enterprise Elite',
            'amount': 99900,  # €999.00
            'description': 'White-glove SOC2 compliance + EU residency',
        },
    }
    
    print("🔄 Setting up Stripe prices...\n")
    
    price_mapping = {}
    
    try:
        for plan_key, plan_info in plans.items():
            print(f"Setting up {plan_key}...")
            
            # Create or get product
            products = stripe.Product.list(limit=100)
            product = None
            for p in products.data:
                if p.get('name') == plan_info['name']:
                    product = p
                    break
            
            if not product:
                product = stripe.Product.create(
                    name=plan_info['name'],
                    type='service',
                    description=plan_info['description'],
                    metadata={'plan_key': plan_key},
                )
                print(f"  ✅ Created product: {product.id}")
            else:
                print(f"  ℹ️  Product exists: {product.id}")
            
            # Create price
            price = stripe.Price.create(
                product=product.id,
                unit_amount=plan_info['amount'],
                currency='eur',
                recurring={
                    'interval': 'month',
                    'interval_count': 1,
                },
                metadata={'plan_key': plan_key},
            )
            
            price_mapping[plan_key] = price.id
            print(f"  ✅ Created price: {price.id}")
            print()
        
        # Print configuration for copy-paste
        print("\n" + "="*60)
        print("✅ Stripe setup complete!")
        print("="*60 + "\n")
        print("Update app/subscription_service.py with these price IDs:\n")
        
        for plan_key, price_id in price_mapping.items():
            print(f'    "{plan_key}": {{')
            print(f'        ...existing config...')
            print(f'        "stripe_price_id": "{price_id}",  # ← Add this line')
            print(f'    }},')
        
        print("\n" + "="*60 + "\n")
        print("💾 Save the configuration above and restart the application.\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error setting up Stripe: {e}")
        return False

if __name__ == '__main__':
    success = setup_stripe_prices()
    sys.exit(0 if success else 1)
