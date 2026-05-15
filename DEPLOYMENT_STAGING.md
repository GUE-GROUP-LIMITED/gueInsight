Staging Deployment & Stripe E2E Guide

This guide helps you deploy to staging and validate Stripe checkout + evidence collection.

1) Environment variables (example `.env.staging`)

STRIPE_API_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FLASK_ENV=production
DATABASE_URL=postgresql://user:pass@db:5432/gueinsight
CELERY_BROKER_URL=redis://redis:6379/0
GWS_SERVICE_ACCOUNT_PATH=/secrets/gws_service_account.json
GWS_ADMIN_SUBJECT=admin@yourdomain.com
M365_TENANT_ID=...
M365_CLIENT_ID=...
M365_CLIENT_SECRET=...
EU_ONLY_DATA_RESIDENCY=true
PREFERRED_DATA_REGION=eu-west-1

2) Deploy with Docker Compose (example for staging)

# from repo root
docker compose -f docker/docker-compose.celery.yml up --build -d

3) Stripe: create test products/prices
- Use Stripe dashboard to create products for each tier. Set price in cents and currency EUR.
- When creating a price, note the price id.

4) Testing Checkout locally with Stripe CLI (recommended)
- Install Stripe CLI: https://stripe.com/docs/stripe-cli
- Forward events to local webhook endpoint:

stripe listen --forward-to "https://staging.example.com/webhook/stripe"

- Create a test Checkout session using the frontend flow (choose a paid tier) and complete the test card purchase (`4242 4242 4242 4242`, any future date, CVC 123).
- Confirm `checkout.session.completed` is received by webhook (Stripe CLI prints events), and verify a `Subscription` and `BillingTransaction` record are created in DB.

5) Verify evidence collection
- Trigger a one-off run: POST `/admin/evidence/gather` (admin auth required) or run the Celery task:

# Trigger locally
python -m app.tasks.run_evidence_collector

# or use Celery
docker compose -f docker/docker-compose.celery.yml exec celery_worker celery -A app.celery_app.celery call app.tasks.celery_tasks.run_evidence_collection

- Check `evidence_artifact` table for new artifacts and download a ZIP via `/admin/export/evidence`.

6) Run periodic collection
- Configure `celery beat` schedule (edit `app/tasks/celery_tasks.py` to add beat schedule) and monitor logs.

Notes & security
- Rotate `STRIPE_WEBHOOK_SECRET` and verify signature verification is enabled in production.
- Lock down admin endpoints with strong admin accounts and IP whitelisting if desired.
