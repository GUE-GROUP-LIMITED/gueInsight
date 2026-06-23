# Payment Method Integration Guide

This guide explains the updated payment system where every transaction requires an attached payment method and all billing plans are integrated with Stripe.

## Overview

### What Changed

**Before:**
- Purchases created subscriptions and billing transactions without payment
- All transactions used 'internal' provider
- No payment method tracking
- No Stripe integration for actual payments

**After:**
- Free plans: Instant activation (no payment method needed)
- Paid plans: Must go through Stripe Checkout
- Every transaction tracks payment method type
- All 5 paid plans integrated with Stripe
- Test and production payment methods supported

---

## Architecture

### Payment Flow

```
User clicks "Upgrade to Paid Plan"
    ↓
Frontend sends POST /auth/subscription/upgrade
    ↓
Backend checks: is_free_plan?
    ├─ YES: Create subscription immediately (payment_method='none')
    └─ NO: Create Stripe checkout session
         ↓
         Return checkout_url
    ↓
Frontend redirects to Stripe Checkout (checkout_url)
    ↓
User selects payment method (card, SEPA, etc.)
    ↓
User completes payment
    ↓
Stripe webhook (checkout.session.completed) fires
    ↓
Backend creates subscription + billing transaction
    ↓
(Optional) Webhook also triggers email receipt
    ↓
User sees "upgrade=success" on redirect
```

### Data Models

#### Subscription
```python
class Subscription:
    plan: str                       # free, starter, compliance_pro, etc.
    payment_method: str             # 'none' (free), 'card', 'sepa_debit', 'bancontact'
    stripe_subscription_id: str     # Stripe subscription ID for recurring
    stripe_customer_id: str         # Stripe customer ID
    last_payment_date: DateTime     # When last payment was processed
    is_trial: bool                  # Whether subscription includes trial period
```

#### BillingTransaction
```python
class BillingTransaction:
    provider: str                   # 'stripe', 'internal', 'belgian_payments'
    provider_txn_id: str            # Stripe payment intent ID or transaction ID
    amount_minor: int               # Amount in cents (4990 = €49.90)
    currency: str                   # 'EUR' or 'USD'
    status: BillingStatus           # pending, succeeded, failed
    # Implicit payment method comes from provider + customer's default
```

---

## Implementation Details

### 1. Compliance Tiers Configuration

File: `app/subscription_service.py`

Each tier now includes:
```python
{
    "name": "Starter",
    "price_monthly_eur": 4990,      # €49.90 in cents
    "stripe_price_id": "price_xxx", # Stripe Price ID
    "requires_payment": True,        # Free=False, Paid=True
}
```

### 2. Upgrade Subscription Endpoint

File: `app/routes/users_billing_routes.py`

**Endpoint:** `POST /auth/subscription/upgrade`

**Request:**
```json
{
  "plan": "starter"  // or "enterprise_elite", etc.
}
```

**Response (Free Plan):**
```json
{
  "message": "Free plan activated",
  "transaction_id": 123,
  "receipt_url": "/auth/billing/123/receipt"
}
```

**Response (Paid Plan):**
```json
{
  "message": "Checkout session created",
  "checkout_url": "https://checkout.stripe.com/pay/xxx",
  "session_id": "cs_test_xxx"
}
```

**Error Response:**
```json
{
  "error": "Stripe integration not configured for starter plan"
}
```

### 3. Stripe Webhook Handler

File: `app/routes/stripe_webhooks.py`

Handles `checkout.session.completed` event:
1. Extracts user_id and plan from metadata
2. Gets or creates Stripe customer
3. Creates Subscription record
4. Creates BillingTransaction with status='succeeded'
5. Sets payment_method from customer's card type
6. Sends email receipt
7. Logs security event

### 4. Frontend Integration

File: `frontend/src/components/PlanSelector.jsx`

Updated `startCheckout()` function:
```javascript
const resp = await api.post('/auth/subscription/upgrade', { plan: planToUse });

if (resp.data?.checkout_url) {
  // Redirect to Stripe Checkout
  window.location.href = resp.data.checkout_url;
}
```

---

## Setup Instructions

### Step 1: Stripe Test Account

1. Create account at https://stripe.com (already done)
2. Go to **Settings** → **API Keys**
3. Copy test mode keys:
   - `STRIPE_PUBLIC_KEY` (pk_test_xxx)
   - `STRIPE_SECRET_KEY` (sk_test_xxx)

### Step 2: Configuration

Update `.env`:
```env
STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx  # (from webhook setup)
FRONTEND_URL=http://localhost:5173       # For redirect URLs
```

### Step 3: Create Stripe Prices

Run setup script:
```bash
python3 scripts/setup_stripe_prices.py
```

This will output price IDs. Copy them to `app/subscription_service.py`:

```python
"stripe_price_id": "price_1ABC123DEF456",
```

### Step 4: Webhook Setup (Local Testing)

Install Stripe CLI: https://stripe.com/docs/stripe-cli

Then:
```bash
stripe login
stripe listen --forward-to localhost:5000/webhook/stripe
```

This prints signing secret - add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

### Step 5: Test Payment

1. Start the app
2. Click "Upgrade to Starter"
3. You'll be redirected to Stripe test checkout
4. Use test card: **4242 4242 4242 4242**
5. Expiry: **12/25**, CVC: **123**
6. Complete payment
7. Webhook should fire and create subscription
8. User redirected to `/subscription?upgrade=success`

---

## Test Scenarios

### Scenario 1: Free Plan → Free Plan (Same)
- User clicks "Downgrade to Free" (already on Enterprise Risk)
- Backend checks: same plan already active
- ❌ Error returned

### Scenario 2: Paid Plan → Free Plan (Downgrade)
- User on Enterprise Risk, clicks "Downgrade to Free"
- No payment needed
- ✅ Subscription created immediately
- Billing transaction: `plan-change:enterprise_risk:free`

### Scenario 3: Free Plan → Paid Plan (Upgrade)
- User on Free, clicks "Upgrade to Starter"
- Backend: `requires_payment=True`
- Creates Stripe checkout session
- User redirected to Stripe
- ✅ Completes payment with test card
- Webhook creates subscription

### Scenario 4: Paid Plan → Paid Plan (Upgrade)
- User on Starter (€49.90), clicks "Upgrade to Enterprise Risk" (€499.00)
- Backend: `requires_payment=True`
- Creates Stripe checkout session
- User completes payment
- ✅ New subscription created at higher tier

### Scenario 5: Paid Plan → Paid Plan (Downgrade)
- User on Enterprise Risk (€499.00), clicks "Downgrade to Starter" (€49.90)
- No payment needed (going down)
- ✅ Subscription created immediately
- Billing transaction: `plan-change:enterprise_risk:starter`
- (Optional future: Proration/refund)

---

## Test Payment Methods

### Cards (Always Succeed)
- **4242 4242 4242 4242** - Visa (standard)
- **5555 5555 5555 4444** - Mastercard
- **3782 822463 10005** - Amex

### Cards (Test Specific Outcomes)
- **4000 0000 0000 0002** - Card declined
- **4000 0025 0000 3155** - Requires 3D Secure (succeed)

### Full Address
- Name: Any
- Email: Any
- Address: Any (test mode ignores)
- Phone: Any (test mode ignores)

---

## Monitoring

### Check Webhook Events

Stripe Dashboard → Developers → Webhooks → Click event log

### Database Queries

```sql
-- All transactions for a user
SELECT * FROM billing_transaction WHERE user_id = 1 ORDER BY created_at DESC;

-- Check payment methods used
SELECT DISTINCT provider FROM billing_transaction;
SELECT payment_method, COUNT(*) FROM subscription GROUP BY payment_method;

-- Successful payments
SELECT * FROM billing_transaction WHERE status = 'succeeded' AND provider = 'stripe';

-- Failed payments
SELECT * FROM billing_transaction WHERE status = 'failed';
```

### Logs

```bash
# Check webhook processing
grep "Stripe webhook" app.log

# Check subscription creation
grep "subscription.*created" app.log

# Check errors
grep "ERROR.*Stripe" app.log
```

---

## Migration Strategy (Production)

### Phase 1: Soft Launch (Test Mode)
- Deploy with Stripe test keys
- All purchases in test mode
- Monitor webhook delivery
- Verify payment flows

### Phase 2: Production Keys
- Add live Stripe keys to production .env
- Create live mode products & prices
- Deploy to production
- Existing "internal" transactions grandfathered in

### Phase 3: Cleanup
- Migrate old "internal" transactions to proper provider
- Update payment_method field based on transaction type
- Provide admin dashboard to review payment history

---

## Troubleshooting

### Webhook Not Firing
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check Stripe Dashboard → Webhooks → Failed events
- Ensure endpoint URL is public/reachable

### Stripe Session Creation Fails
- Check `STRIPE_SECRET_KEY` is valid and in test mode
- Verify `stripe_price_id` exists in Stripe
- Check logs for: "Failed to create Stripe checkout session"

### Payment Method Shows "None"
- For internal/test transactions, payment_method is set manually
- For Stripe transactions, it's derived from customer's default card
- Update manually if needed in admin panel

### User Sees "Stripe integration not configured"
- Run `scripts/setup_stripe_prices.py`
- Update `app/subscription_service.py` with price IDs

---

## Future Enhancements

1. **Multiple Payment Methods**
   - Support SEPA, Bancontact, PayPal, Apple Pay
   - Store multiple cards per customer
   - Allow payment method selection at checkout

2. **Prorations**
   - Calculate refunds/charges for mid-cycle upgrades/downgrades
   - Stripe API handles this automatically

3. **Invoicing**
   - Generate detailed PDF invoices
   - Email invoices automatically
   - Allow invoice download from dashboard

4. **Subscription Management**
   - Allow users to pause/resume
   - Change billing cycle (monthly/annual)
   - Auto-renewal toggle

5. **Admin Dashboard**
   - View all transactions by provider
   - Payment reconciliation
   - Refund/dispute handling
