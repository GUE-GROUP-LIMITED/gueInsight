# 🚀 PAYMENT SYSTEM SETUP - COMPLETE CHECKLIST

This is your complete setup guide. Follow each step in order.

---

## ✅ STEP 1: Verify Installation (Already Done!)

**Status:** ✓ Complete

The payment system has been fully implemented in the code. The upgrade endpoint now:
- Routes free plans to instant activation
- Routes paid plans to Stripe Checkout
- Handles payment methods properly
- All billing transactions require payment data

**Files Modified:**
- `app/subscription_service.py` - Added Stripe price IDs and payment flags
- `app/routes/users_billing_routes.py` - Refactored upgrade flow with Stripe integration
- `frontend/src/components/PlanSelector.jsx` - Updated to handle Stripe redirects
- `app/config.py` - Added Stripe config keys

---

## ✅ STEP 2: Get Stripe Test Keys (5 minutes)

**What you need:** Test mode API keys from Stripe

### Instructions:

1. **Go to Stripe Dashboard**
   ```
   https://dashboard.stripe.com/apikeys
   ```

2. **Make sure TEST MODE is enabled**
   - Look for the toggle in the top right
   - Should show "Viewing test data"

3. **Copy the Secret Key**
   - Under "Secret key" section
   - Click "Reveal test key" or it may already be visible
   - Format: `sk_test_51ABC...` (long string)
   - Copy this entire string

4. **Copy the Publishable Key**
   - Under "Publishable key" section  
   - Format: `pk_test_51ABC...` (long string)
   - Copy this entire string

### What you should have:
```
STRIPE_SECRET_KEY=sk_test_51ABC...
STRIPE_PUBLIC_KEY=pk_test_51ABC...
```

---

## ✅ STEP 3: Update .env Configuration (2 minutes)

**File:** `.env` (in project root)

Already updated with placeholders. Just replace the test keys:

```env
# Line 6-8 in .env
STRIPE_SECRET_KEY=sk_test_51ABC...    # ← Replace this
STRIPE_PUBLIC_KEY=pk_test_51ABC...    # ← Replace this  
STRIPE_API_KEY=sk_test_51ABC...       # ← Replace this
```

Then save the file.

---

## ✅ STEP 4: Create Stripe Products & Prices (5 minutes)

**What this does:** Creates Stripe products for each plan tier so we can charge customers

### Instructions:

1. **Make sure .env is updated** (Step 3 complete)

2. **Run the setup script:**
   ```bash
   python3 setup_stripe_interactive.py
   ```

3. **The script will:**
   - Connect to Stripe
   - Create a product for each plan (starter, compliance_pro, etc.)
   - Create a monthly recurring price for each
   - Output all the price IDs

4. **Example output:**
   ```
   Setting up: Starter
     ✅ Created product: prod_ABC123
     ✅ Created price: price_1ABC123DEF456
   
   Setting up: Compliance Pro
     ✅ Created product: prod_DEF456
     ✅ Created price: price_1DEF456GHI789
   ```

---

## ✅ STEP 5: Update Price IDs in Code (5 minutes)

**File:** `app/subscription_service.py` (lines 26-150)

After step 4, you'll have price IDs. Update each plan:

```python
"starter": {
    ...existing fields...
    "stripe_price_id": "price_1ABC123DEF456",  # ← Update this
},

"compliance_pro": {
    ...existing fields...
    "stripe_price_id": "price_1DEF456GHI789",  # ← Update this
},
```

Do this for all 5 paid plans:
1. `starter`
2. `compliance_pro`
3. `enterprise_professional`
4. `enterprise_risk`
5. `enterprise_elite`

**Tip:** The setup script saves price IDs to `stripe_prices_config.json` - you can reference it

---

## ✅ STEP 6: Setup Webhook (Local Testing) - Optional but Recommended

**What this does:** Receives payment confirmations from Stripe when payments succeed

### Instructions:

1. **Install Stripe CLI** (if not already)
   ```
   https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe**
   ```bash
   stripe login
   ```

3. **Start webhook listener** (in project terminal)
   ```bash
   stripe listen --forward-to localhost:5000/webhook/stripe
   ```

4. **The output will show:**
   ```
   > Ready! Your webhook signing secret is: whsec_test_ABC123...
   ```

5. **Copy the signing secret to .env:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_test_ABC123...
   ```

6. **Keep this terminal open** while testing payments

---

## ✅ STEP 7: Restart Application

```bash
# In your app terminal, press Ctrl+C to stop
# Then restart

npm run dev    # For frontend
python3 manage.py run  # For backend (or your start command)
```

---

## ✅ STEP 8: Test Payment Flow

**Test the entire payment system end-to-end**

### Test Case 1: Free Plan (Instant)

1. Go to http://localhost:5173/subscription
2. Click "Downgrade to Free" (if on paid plan) or "Start Free"
3. **Expected:** Instant activation, no Stripe redirect
4. **Verify:** Check `/auth/session` - plan should be `free`

### Test Case 2: Paid Plan (Stripe Checkout)

1. Go to http://localhost:5173/subscription
2. Click "Upgrade to Starter"
3. **Expected:** Redirected to Stripe test checkout page
4. **Use test card:** `4242 4242 4242 4242`
5. **Expiry:** Any future date (e.g., 12/25)
6. **CVC:** Any 3 digits (e.g., 123)
7. **Email:** Any email
8. **Expected result:**
   - Payment succeeds
   - Redirected back to app with `?upgrade=success`
   - Webhook fires (if terminal running from Step 6)
   - Subscription created in database
   - Receipt available

### Test Case 3: Failed Payment

1. Go to http://localhost:5173/subscription
2. Click upgrade to paid plan
3. **Use decline card:** `4000 0000 0000 0002`
4. **Expected:** Payment declined message, no subscription created
5. Can retry with valid card

---

## ✅ STEP 9: Verify in Database

**Check that payments are being recorded**

```bash
# In app terminal (if using SQLite):
sqlite3 instance/app.db

# Query subscriptions
SELECT id, user_id, plan, payment_method, stripe_subscription_id FROM subscription WHERE user_id = 1;

# Query billing transactions
SELECT * FROM billing_transaction WHERE user_id = 1 ORDER BY created_at DESC;

# Check for Stripe transactions
SELECT * FROM billing_transaction WHERE provider = 'stripe';
```

**Expected data:**
- `payment_method` field is populated (card, sepa_debit, etc.)
- `provider` = 'stripe' for paid transactions
- `status` = 'succeeded' for successful payments
- `provider_txn_id` contains Stripe payment intent ID

---

## ✅ STEP 10: Production Setup (Later)

**When deploying to production:**

1. **Get live Stripe keys** (from Stripe Dashboard, turn OFF test mode)
2. **Update environment secrets** (don't commit to git!)
3. **Create live products & prices** (same process as Step 4)
4. **Update production .env** with live keys
5. **Test with real payment** or use "Stripe Testing" endpoint

---

## 🧪 Test Card Numbers

### Success Cases
- **4242 4242 4242 4242** - Visa (most common)
- **5555 5555 5555 4444** - Mastercard
- **3782 822463 10005** - American Express
- **6011 1111 1111 1117** - Discover

### Decline Cases
- **4000 0000 0000 0002** - Card declined
- **4000 0000 0000 9995** - CVC check fails
- **4000 0000 0000 0069** - Lost card

### 3D Secure (Authentication Required)
- **4000 0025 0000 3155** - Succeeds after authentication
- **4000 0000 0000 3220** - Fails after authentication

**For all test cards:**
- Expiry: Any future date (e.g., 12/25, 12/30)
- CVC: Any 3-4 digits
- Cardholder: Any name
- Address: Any address

---

## 📋 Troubleshooting

### Problem: "Stripe integration not configured for starter plan"

**Solution:**
1. Run `python3 setup_stripe_interactive.py` to create prices
2. Update price IDs in `app/subscription_service.py`
3. Restart app

### Problem: Webhook not firing

**Solution:**
1. Make sure `stripe listen` terminal is running
2. Verify `STRIPE_WEBHOOK_SECRET` is set in .env
3. Check Stripe Dashboard → Developers → Webhooks → View logs

### Problem: Payment succeeds but subscription not created

**Solution:**
1. Check webhook was processed (look in webhook terminal)
2. Check database for billing transaction
3. Restart webhook listener and try again
4. Check app logs for errors

### Problem: "Invalid API Key"

**Solution:**
1. Verify key is `sk_test_` (not `sk_live_`)
2. Check it's copied completely (no extra spaces)
3. Restart app after updating `.env`
4. Generate new test key from Stripe Dashboard

---

## ✨ Success Indicators

When everything is set up correctly, you should see:

- ✅ Free plan → Instant activation, no Stripe redirect
- ✅ Paid plan → Redirected to Stripe checkout
- ✅ Payment succeeds → Subscription created, receipt available
- ✅ Payment fails → Error message, can retry
- ✅ Database → Transactions recorded with payment_method and provider
- ✅ Emails → Receipt sent (if email configured)

---

## 📞 Questions?

If you run into any issues:

1. Check app logs for error messages
2. Check Stripe Dashboard → Developers → Webhooks → Failed events
3. Verify all `.env` values are correct
4. Try restarting both frontend and backend

---

## 🎯 Next Steps (After Testing)

1. **Add real company branding** to Stripe customer portal
2. **Implement payment method management** UI (add/remove cards)
3. **Add invoice generation** (PDF receipts)
4. **Setup email notifications** for failed payments
5. **Implement subscription pause/resume**
6. **Add admin payment dashboard** to review transactions

---

**Configuration Date:** 2026-06-23  
**Status:** ✅ Ready for testing
