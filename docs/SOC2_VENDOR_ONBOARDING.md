SOC2 / ISO Vendor Onboarding Guide

Purpose
- Provide the artifacts and API endpoints vendors like Vanta or Drata need to assess controls and gather evidence.

Required Artifacts
1. User inventory (users + roles + MFA status)
2. Group and access control matrix (users × groups/roles)
3. Audit logs (admin actions, sign-ins, configuration changes)
4. Incident reports (NIS2 incidents, security events)
5. Data retention & deletion evidence (export & deletion logs)
6. Configuration snapshots (storage settings, EU residency flag, env)

Endpoints
- `POST /admin/evidence/gather` — Trigger evidence collection (M365/GWS)
- `POST /admin/evidence/generate-access-matrix` — Generate access control matrix CSV
- `GET  /admin/export/evidence?since=2026-05-01T00:00:00&type=audit_logs` — Download ZIP of artifacts
- `GET  /api/compliance/readiness` — Summary dashboard with readiness and counts
- `GET  /api/incidents/nis2/<id>/pdf` — Download incident report PDF

Suggested Onboarding Flow
1. Create a service account in Google Workspace and grant domain-wide delegation; store key at `GWS_SERVICE_ACCOUNT_PATH` and set `GWS_ADMIN_SUBJECT`.
2. Create an Azure AD app registration with `client_id`/`client_secret` and set `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET` in env.
3. Trigger `POST /admin/evidence/gather` to collect initial artifacts.
4. Trigger `POST /admin/evidence/generate-access-matrix` to produce access matrix.
5. Download evidence via `GET /admin/export/evidence` and provide ZIP to vendor or configure vendor polling to the endpoint.

Notes
- The current implementation is a starting point; for production, schedule regular evidence collection and harden connectors with retries, pagination, and rate-limit handling.
- Secure these admin endpoints and rotate credentials frequently.
