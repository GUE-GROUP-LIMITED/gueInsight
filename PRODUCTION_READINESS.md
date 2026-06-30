# Production Readiness Checklist

**Status**: Launch hardening in progress - not yet general-availability ready  
**Last Updated**: Current session  
**Target**: Minimum 70% test coverage + critical security hardening

---

## Phase 1: Critical Blocking Issues (MUST COMPLETE FIRST)

### 1.1 Environment & Configuration ✅ PARTIALLY DONE
- [x] Config validates SECRET_KEY and SECURITY_PASSWORD_SALT at startup
- [x] Environment-based configuration for database, email, Stripe
- [x] `.env.production.example` template exists with production variables
- [x] Document exact required environment variables and defaults
- [ ] **ACTION**: Add startup warning if running with debug=True in production

**Secrets Required for Production:**
```
SECRET_KEY=<long-random-string>
SECURITY_PASSWORD_SALT=<random-salt>
SQLALCHEMY_DATABASE_URI=postgresql://...
STRIPE_API_KEY=<stripe-secret>
MAIL_SERVER=<smtp-server>
MAIL_USERNAME=<email-user>
MAIL_PASSWORD=<email-password>
SESSION_COOKIE_SECURE=true
EU_ONLY_DATA_RESIDENCY=true|false
```

### 1.2 Error Handling ✅ IMPROVING
- [x] 404 error handler exists and returns safe API JSON
- [x] 500 error handler exists and returns safe API JSON
- [x] 413 upload-too-large handler added
- [x] 403 Forbidden handler present
- [x] Validation error handler present (422)
- [ ] **ACTION**: Add CSRF error handler if CSRF is enabled globally
- [ ] **ACTION**: Verify no stack traces exposed to users in all non-API templates

**Test Coverage**: 0% on app.py (103 statements currently untested)

### 1.3 Security Hardening - CRITICAL
- [x] CSRF appears to be set up but commented out (app.py line 7) 
- [ ] **ACTION**: Review and uncomment CSRF protection if not causing issues
- [ ] **ACTION**: Review all admin routes for authorization (currently 18% coverage, 236 statements missed)
- [ ] **ACTION**: Add input validation to all form submissions
- [ ] **ACTION**: Verify no hardcoded secrets in source code
- [ ] **ACTION**: Review API key validation in security.py (currently 0% coverage - CRITICAL)

**Files to Review:**
- `app/security.py` - 0% coverage (43 statements) - CRITICAL
- `app/routes/admin_routes.py` - 18% coverage (287 statements)
- `app/routes/stripe_webhooks.py` - 10% coverage (67 statements)

### 1.4 Database Production Setup
- [ ] **ACTION**: Test migrations on fresh production schema
- [ ] **ACTION**: Document database backup procedures
- [ ] **ACTION**: Document database restore procedures
- [ ] **ACTION**: Test rollback procedures
- [ ] **ACTION**: Create monitoring for database growth

**Migration Files:** Located in `migrations/versions/`
- 20260424_01_compliance_baseline.py
- 20260516_01_add_subscription_is_trial.py

---

## Phase 2: Test Coverage Expansion (Before MVP Launch)

### 2.1 Current Coverage by Module
```
Total Coverage: 38% (1858 missed of 3008 statements)

CRITICAL (0% coverage):
- app.py: 0% (103 statements) - WSGI entry
- security.py: 0% (43 statements) - Auth/rate-limit
- celery_app.py: 0% (8 statements)

HIGH PRIORITY (< 20% coverage):
- stripe_webhooks.py: 10% (67 statements)
- users_analysis_routes.py: 11% (168 statements)
- admin_routes.py: 18% (287 statements)
- subscription_service.py: 16% (109 statements)

MEDIUM PRIORITY (20-50% coverage):
- admin_operations_routes.py: 26% (183 statements)
- admin_security_routes.py: 30% (43 statements)
- admin_alerts_routes.py: 29% (65 statements)
- users_routes.py: 49% (314 statements)

GOOD (> 90% coverage):
- users_billing_routes.py: 100% ✅ (18 tests)
- forms.py: 100% ✅
- config.py: 91% ✅
- observability.py: 96% ✅
- models.py: 96% ✅
```

### 2.2 Priority Test Coverage Targets
1. **security.py** (43 stmts) - Add 4-6 tests for decorators, rate limiting
2. **stripe_webhooks.py** (67 stmts) - Add webhook handler tests
3. **users_analysis_routes.py** (168 stmts) - Expand from 11% to 50%+
4. **admin_routes.py** (287 stmts) - Expand from 18% to 50%+

**Target**: Get to 65%+ coverage before public beta

---

## Phase 3: Deployment & Operations

### 3.1 Pre-Deployment Checklist
- [x] All environment variables documented in `.env.production.example`
- [ ] Database backups tested
- [ ] Error monitoring set up (Sentry/similar)
- [ ] Logging configured for production
- [ ] Rate limiting verified working
- [ ] CSRF protection tested
- [x] Session security verified

### 3.2 Deployment Process
1. Create `.env.production` with all required secrets
2. Set up PostgreSQL database (not SQLite for production)
3. Run migrations: `alembic upgrade head`
4. Run full test suite: `pytest tests/ --cov=app --cov-report=term-missing`
5. Verify coverage is > 60%
6. Deploy to staging
7. Run smoke tests in staging
8. Deploy to production
9. Monitor logs and error rates

### 3.3 Rollback Procedures
- Keep previous version deployable
- Database rollback: `alembic downgrade -1`
- Have recent backup available
- Monitor error rates post-deployment
- Reference the full procedure in `OPERATIONS_RUNBOOK.md`

---

## Phase 4: Monitoring & Operations

### 4.1 Logging
- [ ] Structured logging in place (JSON format)
- [ ] Request IDs tracked through logs
- [ ] Error rates monitored
- [ ] Performance metrics collected
- [ ] Access logs configured

### 4.2 Health Checks
- [x] `/healthz` endpoint working
- [ ] Database connectivity tested
- [ ] External services tested (Stripe, Supabase, etc.)

### 4.3 Alerting
- [ ] Error rate threshold alerts set
- [ ] Database space alerts
- [ ] Authentication failure rate alerts
- [ ] Payment processing alerts

---

## Current Launch Verdict

- Market ready: No
- Beta/staging ready: Yes, with caution
- Next release gate: finish production backup/restore validation and monitoring setup

---

## Commands for Validation

### Run Full Test Suite
```bash
cd c:/Users/User/source/repos/gueInsight
$env:SECRET_KEY='production-secret'
$env:SECURITY_PASSWORD_SALT='production-salt'
.venv/Scripts/python.exe -m pytest tests/ -v --cov=app --cov-report=html
```

### Run Specific Module Tests
```bash
# Security tests
.venv/Scripts/python.exe -m pytest tests/test_security_module.py -v

# Billing tests
.venv/Scripts/python.exe -m pytest tests/test_billing_routes.py -v

# Compliance tests
.venv/Scripts/python.exe -m pytest tests/test_compliance_endpoints.py -v
```

### Coverage Report
```bash
# Terminal report
pytest tests/ --cov=app --cov-report=term-missing

# HTML report (open htmlcov/index.html in browser)
pytest tests/ --cov=app --cov-report=html
```

---

## Known Issues & Warnings

### ⚠️ SQLite in Production
Currently configured to use SQLite by default. **Do not use in production!**
- Set `SQLALCHEMY_DATABASE_URI` to PostgreSQL
- Test migrations thoroughly before production

### ⚠️ Stripe API Key Handling  
- Ensure STRIPE_API_KEY is set in environment
- Never commit .env files to source control
- Rotate API keys periodically

### ⚠️ CSRF Protection
- Currently commented out in app.py (line 7)
- Uncomment when enabling CSRF across all forms
- Requires template changes to include CSRF tokens

### ⚠️ Admin Routes Coverage
- Many admin operations untested (18% coverage)
- Recommend review of authorization logic before production
- Consider limiting admin access initially

---

## Next Steps

### Immediate (Before Any Deploy)
1. [ ] Uncomment CSRF protection and test
2. [ ] Create `.env.production` template
3. [ ] Review admin routes for authorization
4. [ ] Add error handlers for edge cases

### Short-term (Before MVP)
1. [ ] Expand test coverage to 60%+
2. [ ] Add security.py tests (currently 0%)
3. [ ] Add stripe webhook tests
4. [ ] Performance testing

### Medium-term (After MVP)
1. [ ] Get to 80%+ coverage
2. [ ] Add integration tests
3. [ ] Add load testing
4. [ ] Security audit

---

## Files to Update

- [ ] `PRODUCTION_READINESS.md` - This file (track completion)
- [ ] `.env.production.example` - Create with all required variables
- [ ] `app/app.py` - Verify error handlers, CSRF, logging
- [ ] `app/config.py` - Add production-specific configs
- [ ] `tests/` - Add coverage for security, webhooks, admin routes
- [ ] `README.md` - Add deployment instructions
- [ ] `.gitignore` - Ensure .env files are ignored

---

## Success Criteria

✅ **Ready for Staging Deployment When:**
- Test coverage ≥ 60%
- All Critical security issues resolved
- Database migrations tested
- Error handlers verified
- Environment variables documented

✅ **Ready for Production When:**
- Test coverage ≥ 75%
- Staging tested for 48+ hours
- No critical security issues
- Backup/restore tested
- Incident response procedures documented
- Operations runbook created

---
