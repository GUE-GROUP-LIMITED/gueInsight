# Production Readiness Evidence (2026-07-08)

## Scope
This evidence file captures completion of the must-complete go-live items:
1. SMTP sender auth hardening and signup verification flow checks.
2. Coverage uplift for security and payment/webhook modules.
3. Production alert enablement and tests for webhook/auth/error spikes.
4. One full backup and restore drill.

## 1) SMTP Sender Auth + Verification Flow

### Implemented controls
- Startup validation now enforces production mail prerequisites:
  - `MAIL_USERNAME` required
  - `MAIL_PASSWORD` required
  - `MAIL_DEFAULT_SENDER` must be a valid email
  - sender domain match check with `MAIL_ENFORCE_SENDER_MATCH`
- Production validation now runs when `APP_ENV` is `production` or `prod`.
- Verification emails explicitly use configured `MAIL_DEFAULT_SENDER`.
- Added resend endpoint: `POST /auth/verify-email/resend`.
- Signup flow is resilient if SMTP send fails:
  - account persists
  - response returns `202` with `verification_email_sent=false`
  - user can retry via resend endpoint.

### Validation tests
- `tests/test_production_hardening.py`
  - production mail config rejection/acceptance checks.
- `tests/test_auth_signup_verification.py`
  - successful signup + verification path
  - SMTP failure resilience path
  - resend verification path.

## 2) Coverage Uplift (Security + Webhook)

### Command
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_security_module.py tests/test_production_hardening.py tests/test_auth_signup_verification.py tests/test_stripe_webhooks.py --cov=app.security --cov=app.routes.stripe_webhooks --cov=app.production_errors --cov-report=term-missing
```

### Result
- `21 passed`
- Module coverage:
  - `app/security.py`: `99%`
  - `app/routes/stripe_webhooks.py`: `81%`
  - `app/production_errors.py`: `67%` (supporting reliability checks)

## 3) Production Alerts Enabled + Tested

### Alert channels and enablement
- Added operational alert emitter: `app/notifications/production_alerts.py`
- Controlled by:
  - `ENABLE_PRODUCTION_ALERTS`
  - `WEBHOOK_FAILURE_ALERT_THRESHOLD`
  - `AUTH_ANOMALY_ALERT_THRESHOLD`
  - `ERROR_RATE_SPIKE_THRESHOLD`

### Trigger wiring
- Webhook failures: `app/routes/stripe_webhooks.py`
- Auth anomalies (failed/rate-limited/unverified login attempts): `app/routes/users_auth_privacy_routes.py`
- API 500 spikes: `app/production_errors.py`

### Validation tests
- `tests/test_stripe_webhooks.py::test_stripe_webhook_invalid_signature_triggers_alert`
- `tests/test_auth_signup_verification.py::test_failed_login_spike_triggers_auth_anomaly_alert`
- `tests/test_production_hardening.py::test_api_500_spike_triggers_operational_alert`

## 4) Backup + Restore Drill

### Drill command
```powershell
.\.venv\Scripts\python.exe scripts\backup_restore_drill.py
```

### Drill output (UTC)
- `SRC=instance\app.db`
- `BACKUP=instance\app_backup_20260708T170612Z.db`
- `RESTORE=instance\app_restore_drill_20260708T170612Z.db`
- `TABLE_COUNT=25`
- `SAMPLE_COUNTS={'alert': 0, 'alert_processing_log': 0, 'alert_rule': 0, 'analysis_transaction': 0, 'analytics_metric': 0, 'batch_file_item': 0, 'batch_file_job': 0, 'billing_transaction': 0, 'data_deletion_request': 0, 'data_export_request': 1, 'event': 1, 'evidence_artifact': 0}`

### Drill result
- Backup copy created successfully.
- Restore copy created successfully.
- Restored database schema detected expected table count.
- Sample table reads succeeded after restore.
