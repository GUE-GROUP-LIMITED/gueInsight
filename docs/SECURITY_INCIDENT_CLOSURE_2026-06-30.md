# Security Incident Closure Note (GitGuardian + Stripe)

## Incident Summary
- **Date detected:** 2026-06-30
- **Sources:**
  - Stripe security notification (live API key exposure)
  - GitGuardian historical scan incidents
- **Repository:** GUE-GROUP-LIMITED/gueInsight
- **Scope:** Historical commits contained exposed credentials and key-like secrets.

## Reported Incidents
1. Stripe live key exposure (historical commit content)
2. GitGuardian: PostgreSQL credentials in `app/config.py` (historical)
3. GitGuardian: Company email password in `app/config.py` (historical)
4. GitGuardian: Generic password in `platform/docker-compose.yml` (historical flag)
5. GitGuardian: Company email password in `frontend/src/locales/fr.json` (historical flag)

## Impact Assessment
- **Confirmed real exposures:**
  - Stripe live key string in historical commits
  - Hardcoded PostgreSQL URI with credentials in historical commits
  - Hardcoded mail password in historical commits
- **Likely false/legacy positives:**
  - `frontend/src/locales/fr.json` (localized word "password" context; no credential value confirmed)
  - `platform/docker-compose.yml` not present in current active history

## Containment and Remediation Performed
1. **Repository history rewritten and force-pushed** to remove leaked credential strings from active branch history.
2. **Post-cleanup verification performed** by searching rewritten history for known leaked strings; no matches found.
3. **Preventive controls added:**
   - GitHub Actions secret scanning workflow (`.github/workflows/secret-scan.yml`)
   - Security incident runbook added to `SECURITY.md`

## Validation Evidence
- Main branch rewritten and pushed successfully.
- Re-scan commands used after rewrite:
  - `git grep -n "<leaked_value>" $(git rev-list main)`
- Result: **No matches** for the previously exposed Stripe key, PostgreSQL credential URI, or mail password in active main history.

## External Key Rotation Actions (Required/Completed)
- [ ] Stripe exposed key revoked/deactivated
- [ ] Stripe live API keys rotated
- [ ] Stripe webhook secrets rotated
- [ ] Database credentials rotated at provider
- [ ] Mail/app password rotated at provider
- [ ] Render/Vercel/CI environment variables updated with new secrets
- [ ] Services redeployed and validated after rotation

> Note: Mark each checkbox with exact completion time and owner in your internal incident tracker.

## Monitoring and Follow-Up
- Review Stripe suspicious API activity and API logs for unauthorized actions during exposure window.
- Monitor GitGuardian incidents for resolution status after provider rescans.
- Keep secret scanning workflow mandatory on PRs and main branch pushes.
- Add quarterly secret hygiene audit and credential rotation drill.

## Communication Note (for GitGuardian / Stripe response)
"We identified and remediated historical secret exposure by rewriting repository history, force-pushing cleaned history, and adding automated secret scanning and incident runbook controls. We are rotating affected external credentials (Stripe, database, and mail provider), updating deployment environment variables, and validating service integrity post-rotation."

## Technical References
- Security policy: `SECURITY.md`
- Secret scan workflow: `.github/workflows/secret-scan.yml`
- Incident closure note: `docs/SECURITY_INCIDENT_CLOSURE_2026-06-30.md`
