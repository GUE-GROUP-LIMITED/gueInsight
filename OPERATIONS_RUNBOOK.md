# Operations Runbook

## Purpose
This runbook covers the last-mile operational steps needed before public launch and how to keep the platform healthy after release.

## Launch Gates
- Production secrets are set and validated at startup
- PostgreSQL is used in production, never SQLite
- Health endpoint returns 200 and includes request IDs/headers
- Security, billing, and launch-critical tests pass
- Error handlers return safe API responses with no stack traces
- Backup and restore have been tested on a fresh schema

## Monitoring
Track these signals during rollout:
- HTTP 5xx rate
- Login failure rate and rate-limit events
- Stripe webhook failures
- Background task failures
- Database connection errors
- Memory and CPU usage
- Request latency for login, upload, and dashboard endpoints

## Alert Thresholds
- Error rate above 1% for 5 minutes
- Login failures spike above baseline by 3x
- Stripe webhook failures above 2 in 10 minutes
- Background task failures above 1 in 15 minutes
- Disk usage above 80%
- Database connection errors or migration failures

## Rollback Procedure
1. Stop the app service.
2. Restore the previous deployment bundle.
3. Roll back the database migration only if the schema change caused the incident.
4. Restart the app.
5. Confirm `/healthz` returns 200.
6. Check logs for new errors and confirm traffic is stable.

## Post-Deploy Checklist
- Verify login, signup, dashboard, and file upload flows
- Verify public landing page and docs load correctly
- Confirm billing and webhook flows if payments are enabled
- Confirm logs do not contain secrets
- Confirm secure cookies and HTTPS headers are present

## Go/No-Go Decision
Go live only if:
- Critical tests pass
- Monitoring is live
- Rollback is documented
- Database backups are verified
- No production blockers remain in the readiness checklist
