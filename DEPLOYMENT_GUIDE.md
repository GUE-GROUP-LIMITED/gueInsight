# Deployment Guide

**Last Updated**: Current Session  
**Version**: 1.0  
**Status**: DRAFT - Ready for Staging

---

## Quick Start

### Prerequisites
- Python 3.14+
- PostgreSQL 13+ (not SQLite)
- Redis 6+ (for Celery/caching)
- Git
- A `.env.production` file with all required variables

### 0. Pre-Deployment Validation

```bash
# 1. Run full test suite
pytest tests/ --cov=app --cov-report=term-missing

# Verify coverage >= 60% before proceeding
# Verify no test failures

# 2. Verify environment configuration
python -c "from app.config import Config; print('Config validated')"

# 3. Check for hardcoded secrets
grep -r "sk_test_\|pk_test_\|password.*=" app/ --include="*.py" | grep -v ".env"
```

---

## Staging Deployment

### 1. Prepare Staging Environment

```bash
# SSH into staging server
ssh staging-server

# Clone repository (or pull latest)
cd /opt/gueinsight
git pull origin main

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt
pip install gunicorn pytest pytest-cov  # For production
```

### 2. Configure Staging Environment

```bash
# Copy and edit environment file
cp .env.production.example .env.staging
nano .env.staging  # Edit with staging secrets

# Set environment
export FLASK_ENV=staging
export ENV=staging
```

### 3. Initialize Database

```bash
# Create PostgreSQL database
createdb gueinsight_staging

# Run migrations
alembic upgrade head

# Verify schema
psql gueinsight_staging -c "\dt"  # List all tables
```

### 4. Run Tests on Staging Environment

```bash
# Load staging environment
source .env.staging

# Run full test suite
pytest tests/ -v --cov=app --cov-report=term-missing

# Expected: >= 60% coverage, all tests passing
```

### 5. Start Staging Application

**Linux/macOS:**
```bash
# Using provided script (recommended)
chmod +x ./scripts/run_production_linux.sh
./scripts/run_production_linux.sh --port 8000 --workers 4

# Or manually with Gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 --timeout 120 app:app
```

**Windows:**
```powershell
# Using provided script (recommended)
.\scripts\run_production_windows.ps1 -Port 8000 -Workers 2

# Or manually with Waitress
.\.venv\Scripts\waitress-serve.exe --listen=0.0.0.0:8000 wsgi:app
```

### 6. Smoke Tests on Staging

```bash
# Test health endpoint
curl http://staging-server:8000/healthz
# Expected: {"status": "ok"}

# Test API endpoint (requires auth)
curl -H "Authorization: Bearer <token>" http://staging-server:8000/api/notifications

# Test database connectivity
curl http://staging-server:8000/api/health
```

### 7. Verification Checklist

- [ ] All tests pass
- [ ] Coverage >= 60%
- [ ] Health endpoint responds
- [ ] Database queries work
- [ ] API returns valid JSON (not HTML errors)
- [ ] No stack traces in responses
- [ ] HTTPS redirects configured
- [ ] Session cookies secure flag set
- [ ] CORS allows staging frontend domain

---

## Production Deployment

### Render Backend + Vercel Frontend (Current Topology)

Use these settings when backend is on Render and frontend is on Vercel.

#### Render web service

- Start command:

```bash
gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers ${WEB_CONCURRENCY:-1}
```

- Required environment variables:

```bash
SECRET_KEY=<strong-random-secret>
SECURITY_PASSWORD_SALT=<different-strong-random-secret>
SQLALCHEMY_DATABASE_URI=<managed-postgres-uri>
FRONTEND_URL=https://insights.guecyber.com
FRONTEND_ORIGINS=https://insights.guecyber.com,https://gue-insight-git-main-gabalohos-projects.vercel.app,https://gue-insight-q9pcgtp7h-gabalohos-projects.vercel.app
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=None
```

If `SECRET_KEY` or `SECURITY_PASSWORD_SALT` is missing, app boot fails before Gunicorn can bind a port.

#### Vercel frontend

- Set:

```bash
VITE_API_URL=https://kuber.guecyber.com
```

This ensures browser API calls target the live backend domain.

### 1. Final Pre-Production Checks

```bash
# In staging environment
# 1. Run full test suite again
pytest tests/ --cov=app --cov-report=term-missing

# 2. Monitor staging for 24-48 hours
# Look for errors in logs:
tail -f /var/log/gueinsight/app.log

# 3. Verify no sensitive data in logs
grep -i "password\|secret\|key" /var/log/gueinsight/app.log | grep -v "api_key_regex"

# 4. Test database backup/restore
pg_dump gueinsight_staging > backup.sql
dropdb gueinsight_staging_test
createdb gueinsight_staging_test
psql gueinsight_staging_test < backup.sql
```

### 2. Production Deployment Steps

```bash
# 1. SSH to production server
ssh production-server

# 2. Create backup of current deployment
cd /opt/gueinsight
tar -czf backups/gueinsight-$(date +%Y%m%d-%H%M%S).tar.gz .

# 3. Pull latest code
git pull origin main --ff-only  # Fail if not fast-forward

# 4. Install dependencies (virtual env already exists)
source .venv/bin/activate
pip install -r requirements.txt --no-deps  # Use existing versions

# 5. Run database migrations
export FLASK_ENV=production
alembic upgrade head

# 6. Run tests (final check)
pytest tests/ -q

# 7. Restart application
systemctl restart gueinsight  # Or your deployment method
```

### 3. Post-Deployment Verification

```bash
# 1. Check application status
systemctl status gueinsight

# 2. Verify health endpoint
curl https://api.guecyber.com/healthz
# Expected: {"status": "ok"}

# 3. Monitor logs for errors
journalctl -u gueinsight -f

# 4. Check database integrity
psql gueinsight_prod -c "SELECT COUNT(*) FROM users;"

# 5. Test critical user journeys (sign up, login, upload file, view report)
```

### 4. Monitoring During Rollout

**First 15 minutes:**
- Watch error logs continuously
- Monitor response times
- Watch for database connection errors
- Monitor memory/CPU usage

**First hour:**
- Verify all endpoints working
- Check for data inconsistencies
- Monitor error rate (should be < 1%)

**First 24 hours:**
- Continue log monitoring
- Verify scheduled tasks running
- Check stripe webhook processing
- Monitor user activity patterns

---

## Rollback Procedures

### Quick Rollback (< 5 minutes)

If critical issues found immediately:

```bash
# 1. Restore previous deployment
cd /opt/gueinsight
tar -xzf backups/gueinsight-PREVIOUS_DATE.tar.gz

# 2. Restart application
systemctl restart gueinsight

# 3. Verify health
curl https://api.guecyber.com/healthz

# 4. Check logs
journalctl -u gueinsight -f
```

### Database Rollback

If database schema migration causes issues:

```bash
# 1. Stop application
systemctl stop gueinsight

# 2. Rollback database
alembic downgrade -1  # Go back one migration

# 3. Restart application
systemctl start gueinsight

# 4. Verify
curl https://api.guecyber.com/healthz
```

### Full Rollback (>1 hour into deployment)

If rollback takes > 1 hour, consider:
- Communicate to stakeholders
- Document what went wrong
- Create post-mortem issue
- Fix and re-deploy properly

---

## Configuration Files

### Production Systemd Service File
**File: `/etc/systemd/system/gueinsight.service`**

```ini
[Unit]
Description=gueInsight Backend Service
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=gueinsight
WorkingDirectory=/opt/gueinsight
Environment="PATH=/opt/gueinsight/.venv/bin"
EnvironmentFile=/opt/gueinsight/.env.production
ExecStart=/opt/gueinsight/.venv/bin/gunicorn \
  -w 4 \
  -b 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile /var/log/gueinsight/access.log \
  --error-logfile /var/log/gueinsight/error.log \
  app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable gueinsight
sudo systemctl start gueinsight
```

### Nginx Configuration
**File: `/etc/nginx/sites-available/gueinsight`**

```nginx
upstream gueinsight {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.guecyber.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.guecyber.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.guecyber.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.guecyber.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy Configuration
    location / {
        proxy_pass http://gueinsight;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files (if not using separate CDN)
    location /static {
        alias /opt/gueinsight/app/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/gueinsight /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Application Metrics**
   - Request latency (p50, p95, p99)
   - Error rate (target: < 0.1%)
   - Active connections
   - Memory usage

2. **Database Metrics**
   - Connection pool usage
   - Slow queries (> 1s)
   - Disk space
   - Replication lag (if replicated)

3. **Business Metrics**
   - User registrations
   - Failed logins
   - File uploads
   - Report generations

### Alert Thresholds

Create alerts for:
- Error rate > 1%
- Response time p95 > 2s
- Database connections > 90% of pool
- Disk usage > 80%
- OOM killer events

### Operational Runbook

Use [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for the launch gate, alert thresholds, and rollback steps.

---

## Incident Response

### Error Rate Spike (> 1%)

1. Check recent changes: `git log --oneline -5`
2. Check logs: `journalctl -u gueinsight -n 100 --no-pager`
3. Check database: `psql gueinsight_prod -c "SELECT * FROM pg_stat_statements LIMIT 10;"`
4. Check infrastructure: CPU/memory/disk usage
5. If recent deploy, consider rollback

### Database Connection Errors

1. Check database status: `systemctl status postgresql`
2. Check connection count: `psql -c "SELECT count(*) FROM pg_stat_activity;"`
3. Check for locks: `psql -c "SELECT * FROM pg_locks WHERE NOT granted;"`
4. Restart pool if needed: Kill and restart app connections

### Memory Leak Suspected

1. Monitor process: `watch -n 1 'ps aux | grep gunicorn'`
2. Check for circular imports
3. Consider reducing worker count temporarily
4. Restart workers: `systemctl restart gueinsight`

---

## Maintenance Windows

### Weekly
- [ ] Check log file sizes (rotate if needed)
- [ ] Monitor disk usage
- [ ] Review error logs for patterns

### Monthly
- [ ] Database maintenance: `VACUUM ANALYZE;`
- [ ] Update dependencies: `pip list --outdated`
- [ ] Review security alerts
- [ ] Backup verification: test restore process

### Quarterly
- [ ] Security audit
- [ ] Performance analysis
- [ ] Dependency updates
- [ ] Disaster recovery drill

---

## Rollback Decision Tree

```
Problem Detected?
├─ Yes → Can we fix in < 15 mins?
│  ├─ Yes → Deploy hotfix
│  └─ No → ROLLBACK NOW
└─ No → Continue monitoring
```

**Always prioritize user stability over rapid deployment.**

---

## Market-Ready Criteria

Do not promote to general availability until all of the following are true:
- Production config validation passes with real secrets and PostgreSQL
- Launch-critical tests pass, including security and production error handling
- Monitoring and alerting are configured and tested
- Backup and restore have been verified on a fresh schema
- Rollback has been rehearsed and documented
- The operations runbook is accepted by the team

---

## Support

For deployment issues:
1. Check logs: `/var/log/gueinsight/`
2. Check this guide: DEPLOYMENT_GUIDE.md
3. Check production readiness: PRODUCTION_READINESS.md
4. Create incident ticket
