#!/usr/bin/env python
"""Test Payment API endpoints"""
import requests
import json
from http.cookies import SimpleCookie

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 70)
print("🧪 TESTING GueInsight PAYMENT & BILLING ENDPOINTS")
print("=" * 70)

# First, login to get session
print("\n🔐 Logging in...")
session = requests.Session()
login_data = {
    "email": "testuser@guecyber.com",
    "password": "TestPassword123!"
}

r = session.post(f'{BASE_URL}/auth/login', json=login_data)
if r.status_code == 200:
    print(f"   ✅ Authenticated as testuser@guecyber.com")
else:
    print(f"   ❌ Login failed: {r.status_code}")
    exit(1)

# Test subscription plans
print("\n1️⃣ Testing GET /auth/subscription/plans...")
try:
    r = session.get(f'{BASE_URL}/auth/subscription/plans')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        plans = r.json()
        print(f"   ✅ Found {len(plans)} subscription plans:")
        for plan in plans:
            print(f"      - {plan.get('name')}: €{plan.get('price_eur', plan.get('price'))}/month")
    else:
        print(f"   Response: {r.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test subscription upgrade
print("\n2️⃣ Testing POST /auth/subscription/upgrade...")
upgrade_data = {
    "plan_name": "Compliance Pro",
    "billing_cycle": "monthly"
}
try:
    r = session.post(f'{BASE_URL}/auth/subscription/upgrade', json=upgrade_data)
    print(f"   Status: {r.status_code}")
    if r.status_code in [200, 201]:
        print(f"   ✅ Response: {json.dumps(r.json(), indent=6)}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test Stripe checkout creation
print("\n3️⃣ Testing POST /checkout/create-session...")
checkout_data = {
    "plan_name": "Compliance Pro",
    "billing_cycle": "monthly"
}
try:
    r = session.post(f'{BASE_URL}/checkout/create-session', json=checkout_data)
    print(f"   Status: {r.status_code}")
    if r.status_code in [200, 201]:
        result = r.json()
        if 'checkout_url' in result:
            print(f"   ✅ Checkout session created")
            print(f"      URL: {result.get('checkout_url', 'N/A')[:80]}...")
        else:
            print(f"   Response: {json.dumps(result, indent=6)}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test Belgian payment methods
print("\n4️⃣ Testing GET /belgium/payment-methods...")
try:
    r = session.get(f'{BASE_URL}/belgium/payment-methods')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        methods = r.json()
        print(f"   ✅ Available payment methods ({methods.get('country', 'BE')}):")
        for pm in methods.get('payment_methods', []):
            print(f"      - {pm.get('name')}: {pm.get('description')}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test current subscription
print("\n5️⃣ Testing GET /auth/subscription...")
try:
    r = session.get(f'{BASE_URL}/auth/subscription')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        sub = r.json()
        print(f"   ✅ Current subscription:")
        print(f"      Plan: {sub.get('tier', 'Free')}")
        print(f"      Status: {sub.get('status', 'active')}")
        print(f"      Ends: {sub.get('end_date', 'Never')}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test user profile
print("\n6️⃣ Testing GET /auth/user...")
try:
    r = session.get(f'{BASE_URL}/auth/user')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        user = r.json()
        print(f"   ✅ User profile:")
        print(f"      Name: {user.get('first_name')} {user.get('last_name')}")
        print(f"      Email: {user.get('email')}")
        print(f"      Plan: {user.get('current_plan', 'Free')}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 70)
print("✅ Payment endpoint tests complete!")
print("=" * 70)
