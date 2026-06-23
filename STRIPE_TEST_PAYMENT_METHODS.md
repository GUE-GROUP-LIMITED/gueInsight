# Stripe Test Payment Methods

This document provides all test payment methods and cards for development and testing. Use these dummy cards in Stripe test mode to simulate payments without charges.

## Stripe Test Mode Cards

### Successful Payments

| Card Number | Expiry | CVC | Description |
|-------------|--------|-----|-------------|
| 4242 4242 4242 4242 | 12/25 | 123 | Standard Visa test card - always succeeds |
| 5555 5555 5555 4444 | 12/25 | 123 | Mastercard test card - always succeeds |
| 3782 822463 10005 | 12/25 | 1234 | American Express test card |
| 6011 1111 1111 1117 | 12/25 | 123 | Discover test card |

### Payment Outcomes (for different scenarios)

| Card Number | Outcome | Use Case |
|-------------|---------|----------|
| 4000 0000 0000 0002 | Card declined | Test failed payment handling |
| 4000 0000 0000 9995 | CVC check fails | Test CVC validation |
| 4000 0000 0000 0069 | Lost card | Test specific decline reason |
| 4000 0000 0000 0127 | Incorrect CVC | Test CVC error handling |

### 3D Secure / SCA (Strong Customer Authentication)

| Card Number | Result |
|-------------|--------|
| 4000 0025 0000 3155 | Requires authentication (success) |
| 4000 0000 0000 3220 | Requires authentication (failure) |

## How to Test Payments in Development

### Step 1: Create Stripe Test Price IDs

In your Stripe Dashboard (test mode):

1. Go to **Products** → **Create Product**
2. Create a product for each plan:
   - **Name**: GueInsight Starter
   - **Type**: Service
   - **Pricing**: Add a price (EUR, monthly recurring)
   - **Amount**: €49.90

3. Do this for all 5 paid plans:
   - Starter: €49.90/month → Copy `price_*_xxx` ID
   - Compliance Pro: €99.90/month
   - Enterprise Professional: €299.90/month
   - Enterprise Risk: €499.00/month
   - Enterprise Elite: €999.00/month

### Step 2: Update Configuration

Replace placeholder price IDs in `app/subscription_service.py`:

```python
"stripe_price_id": "price_starter_eur_monthly",  # ← Replace with actual ID from Stripe
```

With the actual IDs from Stripe Dashboard:

```python
"stripe_price_id": "price_1ABC123DEF456",  # ← Actual ID
```

### Step 3: Test Checkout Flow

1. In app, click upgrade to a paid plan
2. You'll be redirected to Stripe test checkout
3. Use test card **4242 4242 4242 4242** with any future date and CVC
4. Complete payment
5. Webhook should fire and create subscription

### Step 4: Test Different Scenarios

**Successful Payment:**
- Card: 4242 4242 4242 4242
- Expected: Subscription created, webhook received

**Failed Payment:**
- Card: 4000 0000 0000 0002
- Expected: Payment declined, no subscription created

**3D Secure Required:**
- Card: 4000 0025 0000 3155
- Expected: Customer prompted for authentication, then succeeds

## Payment Method Tracking

### Subscription Model

The `Subscription` model tracks:
- `payment_method`: Type of payment (card, sepa_debit, bancontact, none)
- `last_payment_date`: When the last payment was processed

### Billing Transaction Model

Every transaction must include:
- `provider`: 'stripe', 'internal', 'belgian_payments', etc.
- `provider_txn_id`: The transaction ID from payment provider
- `amount_minor`: Amount in cents (e.g., 4990 = €49.90)
- `currency`: EUR or USD
- `status`: pending, succeeded, failed
- `payment_method`: Inferred from provider

## Webhook Configuration

### Stripe Webhook Setup

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL**: `https://yourdomain.com/webhook/stripe`
3. **Events**:
   - `checkout.session.completed` - Payment successful
   - `invoice.payment_succeeded` - Recurring payment succeeded
   - `invoice.payment_failed` - Recurring payment failed
   - `customer.subscription.updated` - Plan changed
   - `customer.subscription.deleted` - Cancelled

4. Save signing secret as `STRIPE_WEBHOOK_SECRET` in `.env`

### Testing Webhooks Locally

Use Stripe CLI to forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:5000/webhook/stripe
```

This will print a signing secret - add to `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

Then trigger test events:

```bash
stripe trigger checkout.session.completed
```

## Configuration Environment Variables

Add to `.env`:

```env
# Stripe (Test Mode)
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx

# Frontend redirect after payment
FRONTEND_URL=http://localhost:5173
```

## Development Workflow

1. **Free Plan**: Immediate subscription, no payment required
2. **Paid Plans**: Redirect to Stripe → Test card → Webhook creates subscription
3. **Downgrade**: From paid → free is immediate (no payment)
4. **Upgrade**: From free/paid → paid shows Stripe checkout

## Safety Notes

⚠️ **Never use real card numbers in development**
⚠️ **All test cards automatically decline in production**
⚠️ **Webhooks only fire in Stripe test mode for test transactions**
⚠️ **Test transactions don't appear on bank statements**
