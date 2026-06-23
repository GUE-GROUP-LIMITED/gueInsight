#!/usr/bin/env python
"""Test API endpoints"""
import requests
import json

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 60)
print("🧪 TESTING GueInsight API")
print("=" * 60)

# Test 1: Auth Session
print("\n1️⃣ Testing /auth/session...")
try:
    r = requests.get(f'{BASE_URL}/auth/session')
    print(f"   Status: {r.status_code}")
    print(f"   Response: {json.dumps(r.json(), indent=6)}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Signup
print("\n2️⃣ Testing /auth/signup...")
signup_data = {
    "first_name": "Test",
    "last_name": "User",
    "email": "testuser@guecyber.com",
    "password": "TestPassword123!",
    "company": "GueInsight Test",
    "job_title": "Security Analyst",
    "team_size": "1-5",
    "primary_use_case": "Threat monitoring",
    "phone_number": "+1 555 010 9999",
    "agreed_to_terms": True,
    "gdpr_consent": True,
    "newsletter_opt_in": True
}
try:
    r = requests.post(
        f'{BASE_URL}/auth/signup',
        json=signup_data,
        headers={'Content-Type': 'application/json'}
    )
    print(f"   Status: {r.status_code}")
    if r.status_code in [200, 201]:
        print(f"   ✅ Response: {json.dumps(r.json(), indent=6)}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Login
print("\n3️⃣ Testing /auth/login...")
login_data = {
    "email": "testuser@guecyber.com",
    "password": "TestPassword123!"
}
try:
    r = requests.post(
        f'{BASE_URL}/auth/login',
        json=login_data,
        headers={'Content-Type': 'application/json'}
    )
    print(f"   Status: {r.status_code}")
    if r.status_code in [200, 201]:
        print(f"   ✅ Response: {json.dumps(r.json(), indent=6)}")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Get Subscription Plans
print("\n4️⃣ Testing /auth/subscription/plans...")
try:
    r = requests.get(f'{BASE_URL}/auth/subscription/plans')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        plans = r.json()
        print(f"   ✅ Found {len(plans)} plans:")
        for plan in plans:
            print(f"      - {plan.get('name')}: €{plan.get('price')}/mo")
    else:
        print(f"   Response: {r.text[:300]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 5: Belgian Payment Methods (requires auth)
print("\n5️⃣ Testing /belgium/payment-methods...")
try:
    r = requests.get(f'{BASE_URL}/belgium/payment-methods')
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        methods = r.json()
        print(f"   ✅ Available payment methods:")
        for pm in methods.get('payment_methods', []):
            print(f"      - {pm.get('name')}: {pm.get('description')}")
    else:
        print(f"   Note: {r.status_code} (expected - requires authentication)")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("✅ Test complete!")
print("=" * 60)
