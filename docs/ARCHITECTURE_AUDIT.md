# Architecture Audit

Date: 2026-06-22

## Scope

This audit reviewed backend, frontend, deployment, and test structure to identify monolith risk and define a scalable modularization path.

## Current Structure Summary

- Backend uses Flask app factory with separate blueprints for user, admin, and Stripe routes.
- Domain services exist (`subscription_service.py`, `admin_services.py`, middleware, integrations).
- Frontend is isolated in a Vite React app.
- CI exists and now enforces build, tests, and security checks.
- Auth and privacy endpoints were extracted from `users_routes.py` into `users_auth_privacy_routes.py` using explicit blueprint registration.

## Monolith Risk Hotspots

- `app/routes/users_routes.py` is large (~71 KB) and contains mixed concerns:
  - auth/session
  - privacy/export/deletion
  - billing/checkout
  - dashboard and notifications
  - analysis orchestration
- `app/routes/admin_routes.py` is large (~42 KB) and contains mixed concerns:
  - admin auth
  - alerts/rules
  - support operations
  - security events/deletion workflows

## Recommended Target Architecture

### Backend Module Boundaries

- `app/routes/auth_routes.py`: login/logout/signup/session
- `app/routes/privacy_routes.py`: export, deletion, consent
- `app/routes/billing_routes.py`: checkout, subscription changes
- `app/routes/analysis_routes.py`: analysis execution and results
- `app/routes/admin_users_routes.py`: admin user operations
- `app/routes/admin_security_routes.py`: security events and deletion requests

### Service Layer

- Move business logic from route handlers to service modules:
  - `app/services/auth_service.py`
  - `app/services/privacy_service.py`
  - `app/services/billing_service.py`
  - `app/services/analysis_service.py`

### Data and API Contracts

- Introduce request/response schema validation for route payloads.
- Keep response shapes stable while routing code is decomposed.

## Phased Execution Plan

1. Extract helper functions from oversized routes into service modules (no route changes).
2. Create new route modules and re-export existing endpoints.
3. Move endpoint implementations one feature area at a time.
4. Add integration tests per module group.
5. Deprecate and remove original oversized modules after parity is verified.

## Progress Update

- Completed: Step 3 for auth/privacy endpoint set.
- Completed: Step 3 for user billing/transactions/notifications endpoint set.
- Completed: Step 3 for admin security/deletion endpoint set.
- Completed: Additional integration tests for auth session/logout and privacy consent update flow.
- Completed: Additional integration tests for transactions/receipt fallback, upgrade validation, and admin deletion status patch flow.
- Remaining: Split support ticket and dashboard/analysis paths from `users_routes.py` plus remaining admin operational areas from `admin_routes.py`.

## Success Criteria

- No single route module exceeds 800 lines.
- 100% endpoint parity (status code + response shape).
- New route groups covered by integration tests.
- CI enforces tests and security scans on pull requests.
