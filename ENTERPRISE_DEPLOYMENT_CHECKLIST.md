# Enterprise Features Deployment Checklist

**Objective**: Deploy all 5 enterprise features to production safely

---

## 🎯 Phase 1: Configuration (1-2 hours)

### Environment Setup
- [ ] Set API keys in `.env` or production environment:
  ```bash
  VIRUSTOTAL_API_KEY=your_key
  ABUSEIPDB_API_KEY=your_key  
  RAPIDAPI_KEY=your_key
  SLACK_WEBHOOK_URL=your_webhook
  ```

- [ ] Verify Celery/Redis configuration
  ```bash
  CELERY_BROKER_URL=redis://localhost:6379/0
  CELERY_RESULT_BACKEND=redis://localhost:6379/0
  ```

- [ ] Enable PostgreSQL (not SQLite) for production
  ```bash
  DATABASE_URL=postgresql://user:password@host/gueinsight
  ```

---

## 📁 Phase 2: Database Migrations (1-2 hours)

### Create Alembic Migrations
```bash
# Run in migrations/ directory
alembic revision --autogenerate -m "Add enterprise features"
```

This will auto-detect new models:
- SubUser
- BatchFileJob
- BatchFileItem
- AnalyticsMetric
- AlertProcessingLog
- SecurityToolIntegration

### Review Migration File
- [ ] Check `migrations/versions/add_enterprise_features.py`
- [ ] Ensure all 6 models are included
- [ ] Verify foreign key relationships

### Apply Migration
```bash
alembic upgrade head
```

### Verify Database Schema
```sql
\dt  -- List all tables
```

Should include new tables:
- sub_user
- batch_file_job
- batch_file_item
- analytics_metric
- alert_processing_log
- security_tool_integration

---

## 🚀 Phase 3: Application Updates (1-2 hours)

### Review Files Modified
- [x] `app/models.py` - 6 new models added (~400 lines)
- [x] `app/routes/users_enterprise_routes.py` - 15 endpoints (~600 lines)
- [x] `app/tasks/celery_tasks.py` - 3 new async tasks (~350 lines)
- [x] `app/routes/users_routes.py` - Route registration updated
- [x] `app/integrations/virustotal_integration.py` - 4 new functions
- [x] `app/integrations/abuseipdb_integration.py` - 5 new functions
- [x] `app/integrations/rapidapi.py` - Enhanced implementation
- [x] `app/integrations/slack_integration.py` - 3 new functions

### Syntax Validation
```bash
# Check for syntax errors
python -m py_compile app/routes/users_enterprise_routes.py
python -m py_compile app/tasks/celery_tasks.py
python -m py_compile app/integrations/virustotal_integration.py
python -m py_compile app/integrations/abuseipdb_integration.py
python -m py_compile app/integrations/rapidapi.py
python -m py_compile app/integrations/slack_integration.py
```

### Import Verification
```bash
# Test imports
cd /path/to/app
python -c "from routes.users_enterprise_routes import register_enterprise_routes; print('✓ Routes import OK')"
python -c "from integrations.virustotal_integration import test_connection; print('✓ VT import OK')"
python -c "from integrations.abuseipdb_integration import check_ip; print('✓ AIDB import OK')"
python -c "from tasks.celery_tasks import process_batch_files; print('✓ Tasks import OK')"
```

---

## 🔗 Phase 4: Integration Testing (2-3 hours)

### Test Sub-User Management
```bash
# Create enterprise sub-user
curl -X POST http://localhost:5000/auth/sub-users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@company.com", "role": "analyst", "permissions": "read,export"}'

# Expected: 201 Created with SubUser object
```

- [ ] Can create sub-user ✓
- [ ] Can list sub-users ✓
- [ ] Can update role ✓
- [ ] Can delete sub-user ✓

### Test Batch Processing
```bash
# Create batch job
curl -X POST http://localhost:5000/auth/batch-jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_name": "Test", "files": ["test.zip"]}'

# Expected: 201 Created with BatchFileJob object
```

- [ ] Can create batch job ✓
- [ ] Can get job status ✓
- [ ] Celery task starts asynchronously ✓
- [ ] Progress updates as files process ✓

### Test Analytics
```bash
# Get analytics summary
curl -X GET http://localhost:5000/auth/analytics/summary \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 with metrics
```

- [ ] Analytics summary returns data ✓
- [ ] Timeline data appears after 24h ✓
- [ ] Threat patterns tracked ✓

### Test Alert Rules
```bash
# Create alert rule
curl -X POST http://localhost:5000/auth/alerts/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rule_type": "keyword", "value": "ransomware", "severity": "high"}'

# Expected: 201 Created with AlertRule object
```

- [ ] Can create alert rule ✓
- [ ] Can list rules ✓
- [ ] Can update rule ✓
- [ ] Rules trigger on match ✓

### Test Security Tool Integrations
```bash
# Add VirusTotal integration
curl -X POST http://localhost:5000/auth/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "virustotal", "api_key": "YOUR_KEY"}'

# Expected: 201 Created with SecurityToolIntegration object

# Test connection
curl -X POST http://localhost:5000/auth/integrations/1/test \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 with success status
```

- [ ] Can add VirusTotal ✓
- [ ] Can add AbuseIPDB ✓
- [ ] Can add RapidAPI ✓
- [ ] Test endpoints work ✓
- [ ] Can remove integration ✓

---

## ⚠️ Phase 5: Error Handling & Monitoring (1 hour)

### Test Error Cases
- [ ] Invalid API keys properly rejected
- [ ] Rate limits handled gracefully
- [ ] Missing integrations don't break analysis
- [ ] Batch job cancellation works
- [ ] Retry logic functions (check Celery logs)

### Monitor Logs
```bash
# Celery task logs
tail -f /var/log/celery/worker.log

# Application logs
tail -f /var/log/gueinsight/app.log

# Check for errors:
grep -i "error\|exception\|failed" /var/log/gueinsight/app.log
```

### Health Checks
- [ ] Celery worker is running: `celery -A app.celery_app inspect active`
- [ ] Redis is accessible: `redis-cli ping` → `PONG`
- [ ] PostgreSQL is accessible: `psql -l`
- [ ] All imports successful: Application starts without errors

---

## 🔒 Phase 6: Security Review (1-2 hours)

### API Key Security
- [ ] API keys stored securely (use `.env`, not in code)
- [ ] API keys NOT logged in debug output
- [ ] Never return raw API keys in API responses
- [ ] Consider implementing Fernet encryption for stored keys

### Authorization
- [ ] Sub-user endpoints require enterprise plan
- [ ] Sub-users cannot modify parent account
- [ ] Integration endpoints enforce user ownership
- [ ] Batch jobs access restricted to owner

### Rate Limiting
- [ ] Configure rate limits on `/auth/` endpoints
- [ ] External API calls respect their rate limits
- [ ] Batch processing limits respected (max 100 files)

### Data Privacy
- [ ] No sensitive data in alert logs
- [ ] Webhook payloads don't expose API keys
- [ ] Analysis results don't leak other users' data

---

## 📊 Phase 7: Performance Validation (1-2 hours)

### Load Testing
```bash
# Test batch processing with realistic file counts
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/auth/batch-jobs

# Expected: No timeouts, proper queue handling
```

### Celery Performance
- [ ] Tasks complete within expected time
- [ ] No memory leaks in long-running tasks
- [ ] Queue doesn't back up excessively
- [ ] Retries don't overwhelm the system

### Database Performance
```bash
# Check query performance
EXPLAIN ANALYZE
SELECT * FROM analytics_metric 
WHERE user_id = 1 AND recorded_at > NOW() - INTERVAL '30 days';
```

- [ ] Analytic queries return < 100ms
- [ ] Batch job queries scale linearly
- [ ] No N+1 query problems

---

## 🎯 Phase 8: Documentation & Training (1 hour)

### Document Endpoints
- [ ] Create API docs for enterprise endpoints
- [ ] Document expected request/response formats
- [ ] Include error code reference

### Create User Guide
- [ ] How to invite sub-users
- [ ] How to upload batch files
- [ ] How to set up alert rules
- [ ] How to configure integrations

### Internal Wiki
- [ ] Architecture overview (diagrams)
- [ ] Troubleshooting guide
- [ ] Common issues and solutions
- [ ] Support contact information

---

## 🚨 Phase 9: Rollout Strategy (Variable)

### Option A: Phased Rollout (Recommended)
```
Day 1: 5% of traffic (beta testers)
Day 2: 25% of traffic (early adopters)
Day 3: 50% of traffic (monitor performance)
Day 4: 100% of traffic (full release)
```

### Option B: Feature Flags
```python
# Conditionally enable features
if app.config.get('ENABLE_ENTERPRISE_FEATURES'):
    register_enterprise_routes(users_bp)
```

### Option C: Direct Release
```bash
# For established systems with high confidence
git checkout main
git pull
python -m alembic upgrade head
systemctl restart gueinsight
```

---

## ✅ Pre-Launch Checklist

### Code
- [ ] All syntax validated
- [ ] All imports working
- [ ] No merge conflicts
- [ ] Tests passing (if available)

### Database
- [ ] Migrations applied to staging
- [ ] Schema verified
- [ ] Backups created
- [ ] Rollback plan documented

### Environment
- [ ] All API keys configured
- [ ] Celery worker running
- [ ] Redis operational
- [ ] PostgreSQL healthy

### Integration
- [ ] VirusTotal API key valid
- [ ] AbuseIPDB API key valid
- [ ] RapidAPI keys configured
- [ ] Slack webhook URL valid

### Monitoring
- [ ] Logs configured
- [ ] Error tracking enabled (Sentry/etc)
- [ ] Performance monitoring active
- [ ] Alert thresholds set

### Testing
- [ ] Sub-user creation works
- [ ] Batch jobs process
- [ ] Analytics data generated
- [ ] Alert rules trigger
- [ ] Integrations tested

---

## 🚀 Launch Procedure

```bash
# 1. Verify all checks passed
echo "Checking prerequisites..."
python -m py_compile app/routes/users_enterprise_routes.py
python -m py_compile app/tasks/celery_tasks.py

# 2. Apply database migrations
python -m alembic upgrade head

# 3. Start/restart services
systemctl restart gueinsight
systemctl restart celery_worker

# 4. Run basic smoke tests
curl -X GET http://localhost:5000/auth/batch-jobs -H "Authorization: Bearer $TOKEN"

# 5. Monitor logs for errors
tail -f /var/log/gueinsight/app.log

echo "✓ Enterprise features deployed successfully!"
```

---

## 🔄 Rollback Procedure (if needed)

```bash
# 1. Stop new deployments
git revert HEAD

# 2. Revert database changes
python -m alembic downgrade -1

# 3. Restart services with previous code
systemctl restart gueinsight
systemctl restart celery_worker

# 4. Verify system stable
curl -X GET http://localhost:5000/health

echo "✓ Rollback complete"
```

---

## 📞 Support & Escalation

**During Deployment Issues:**

1. Check application logs: `/var/log/gueinsight/app.log`
2. Check Celery logs: `/var/log/celery/worker.log`
3. Verify database connectivity: `psql $DATABASE_URL`
4. Check Redis: `redis-cli ping`

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Celery tasks not starting | Verify Redis running, check broker URL |
| Database migrations fail | Check PostgreSQL version, disk space |
| API key errors | Verify keys in .env, test with curl |
| Webhook timeouts | Check firewall rules, external connectivity |
| Memory leaks in batch | Check file sizes, implement pagination |

---

**Status**: Ready for deployment  
**Estimated Time**: 8-12 hours total  
**Risk Level**: Medium (new features, async processing)  
**Rollback Time**: 30 minutes
