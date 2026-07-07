# Admin RBAC + Invitation Rollout Runbook

## Scope
This runbook covers production rollout of:

- Admin invitation endpoint: `POST /api/admin/invitations`
- Admin invite activation endpoint: `POST /auth/admin-invite/accept`
- Admin role/privilege update endpoint: `PATCH /api/admin/users/<id>/access`
- Access metadata endpoint: `GET /api/admin/access/metadata`
- Frontend pages:
  - `/activate-admin`
  - `/admin/access`

## Pre-Deployment Checklist

1. Set environment variables:
- `SECRET_KEY` must be set and stable.
- `SECURITY_PASSWORD_SALT` must be set and stable.
- `FRONTEND_URL` must match the public frontend origin.
- `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` must be valid.
- Optional:
  - `ADMIN_INVITE_EXPIRY_HOURS` (default 72)
  - `ADMIN_INVITE_MAX_AGE_SECONDS` (default 259200)

2. Confirm mail delivery in staging:
- Send a real invite.
- Verify link opens `/activate-admin?token=...`.
- Verify activation succeeds once and fails on second use.

3. Confirm current super admin access:
- Ensure at least one known admin can call:
  - `GET /api/admin/access/metadata`
  - `POST /api/admin/invitations`

4. Confirm backups and observability:
- Snapshot database before deploy.
- Ensure app logs and error dashboards are monitored.

## Deployment Steps

1. Deploy backend and frontend together.
2. Verify health endpoints:
- Backend health endpoint returns OK.
- Frontend loads without routing errors.

3. Smoke test critical flows:
- Admin login works.
- `/admin/access` loads and shows roles/permissions.
- Invite a new admin and verify invitation response.
- Activate invited admin from email link.
- Login as invited admin.
- Update invited admin role/permissions and verify persistence.

## Post-Deployment Validation

1. API validations:
- Non-admin cannot access admin access endpoints.
- Admin without `users:invite` cannot send invites.
- Non-super-admin cannot assign `owner` or `super_admin`.
- Non-super-admin cannot grant permissions they do not own.

2. Security validations:
- Invitation token is single-use.
- Expired invitation is rejected.
- Activation requires strong password policy.

3. Data validations:
- `user.admin_role` populated for invited/admin users.
- `user.admin_permissions` stored and returned correctly.
- `invitation_accepted_at` set on successful activation.

## Rollback Plan

1. Frontend rollback:
- Revert to previous frontend build if `/activate-admin` or `/admin/access` fails.

2. Backend rollback:
- Revert to previous backend release.
- New nullable columns on `user` are backward-compatible and can remain.

3. Access emergency fallback:
- Use existing super admin account to restore critical access.
- If email delivery fails, set `MAIL_*` correctly and resend invite.

## Incident Playbook

### Invite email not received
1. Check `MAIL_*` config.
2. Check provider sending logs and spam/quarantine.
3. Re-send invite from `/admin/access`.

### Activation link invalid immediately
1. Verify `SECRET_KEY` and `SECURITY_PASSWORD_SALT` consistency across instances.
2. Check token max age settings.
3. Ensure frontend points to correct backend origin.

### Admin sees access page but cannot grant expected role
1. Review current effective permissions in `/api/admin/access/metadata`.
2. Confirm anti-escalation policy is expected.
3. Use super admin for owner/super_admin assignment.

## Recommended Hardening Follow-Ups

1. Add mandatory MFA for all admin roles.
2. Add dual approval for `owner` and `super_admin` assignment.
3. Add explicit audit events for invite, accept, and privilege update actions.
4. Add periodic access review job and report.
