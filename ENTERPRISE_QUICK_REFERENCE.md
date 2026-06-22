# Enterprise Features Quick Reference

**Version**: 1.0  
**Last Updated**: 2026-06-23  
**Components**: 5 Major Features + 4 Security Integrations

---

## 📌 1-Minute Overview

```
SubUser Management      → Invite team members with specific roles
Batch Processing       → Upload 100+ files, process asynchronously  
Advanced Analytics     → Track usage, threats, and performance
Alert Rules            → Trigger notifications on threat patterns
Security Integrations  → VirusTotal, AbuseIPDB, RapidAPI, Slack
```

---

## 🔧 For Backend Developers

### Adding a New Sub-User

```python
from app.models import SubUser, User

# Get current user and new sub-user email
parent_user = current_user  # Flask-Login
sub_user_email = "analyst@company.com"

# Verify enterprise subscription
if parent_user.subscription_tier not in ['compliance_pro', 'enterprise_risk', 'enterprise_elite']:
    return {"error": "Enterprise plan required"}, 403

# Find or create sub-user account
sub_user = User.query.filter_by(email=sub_user_email).first()
if not sub_user:
    sub_user = User(email=sub_user_email, username=sub_user_email.split('@')[0])
    db.session.add(sub_user)
    db.session.commit()

# Create relationship
relationship = SubUser(
    parent_user_id=parent_user.id,
    sub_user_id=sub_user.id,
    role='analyst',  # analyst, manager, or admin
    permissions='read,export'
)
db.session.add(relationship)
db.session.commit()
```

### Creating a Batch Job

```python
from app.models import BatchFileJob, BatchFileItem
from app.tasks.celery_tasks import process_batch_files

# Create batch job
batch = BatchFileJob(
    user_id=current_user.id,
    job_name="Q2 Incident Analysis",
    status="queued"
)
db.session.add(batch)
db.session.commit()

# Add files to batch
for file_path in ["file1.pcap", "file2.log"]:
    item = BatchFileItem(
        batch_job_id=batch.id,
        file_name=file_path,
        status="pending"
    )
    db.session.add(item)
db.session.commit()

# Trigger async processing
process_batch_files.delay(batch.id)
```

### Adding a Security Integration

```python
from app.models import SecurityToolIntegration
from app.integrations.virustotal_integration import test_connection

# Create integration
integration = SecurityToolIntegration(
    user_id=current_user.id,
    tool_name='virustotal',
    api_key='your_vt_api_key',  # TODO: encrypt this
    is_active=True
)

# Test connection before saving
try:
    test_connection(integration.api_key)
    db.session.add(integration)
    db.session.commit()
except Exception as e:
    return {"error": f"Integration test failed: {str(e)}"}, 400
```

### Using Integrations in Analysis

```python
from app.integrations.virustotal_integration import enrich_analysis_results as vt_enrich
from app.integrations.abuseipdb_integration import enrich_analysis_results as aidb_enrich

def analyze_file_with_enrichment(file_path, user_id):
    # Run standard analysis
    result = run_standard_analysis(file_path)
    
    # Get user's active integrations
    integrations = SecurityToolIntegration.query.filter_by(
        user_id=user_id, 
        is_active=True
    ).all()
    
    # Apply enrichments
    for integration in integrations:
        try:
            if integration.tool_name == 'virustotal':
                result = vt_enrich(result, integration.api_key)
            elif integration.tool_name == 'abuseipdb':
                result = aidb_enrich(result, integration.api_key)
        except Exception as e:
            logger.warning(f"Enrichment failed: {e}")
    
    return result
```

---

## 🎯 For Frontend Developers

### Sub-User Management UI

```javascript
// Fetch sub-users
const response = await fetch('/auth/sub-users', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { sub_users } = await response.json();

// Add new sub-user
const formData = {
  email: 'analyst@company.com',
  role: 'analyst',
  permissions: 'read,export'
};

const addResponse = await fetch('/auth/sub-users', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(formData)
});
```

### Batch Job Upload UI

```javascript
// Create batch job
const createBatch = async (files) => {
  const response = await fetch('/auth/batch-jobs', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      job_name: 'Incident Analysis',
      files: files.map(f => f.path)
    })
  });
  
  const { id } = await response.json();
  return id;
};

// Monitor progress
const pollProgress = async (jobId) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/auth/batch-jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { progress_percentage, status } = await response.json();
    
    console.log(`Progress: ${progress_percentage}%`);
    
    if (status === 'completed' || status === 'failed') {
      clearInterval(interval);
    }
  }, 2000);
};
```

### Analytics Dashboard

```javascript
// Fetch summary metrics
const fetchAnalytics = async (days = 30) => {
  const response = await fetch(`/auth/analytics/summary?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Display threat trends
const fetchThreats = async (days = 30) => {
  const response = await fetch(`/auth/analytics/threats?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { threat_patterns } = await response.json();
  
  // Plot with Chart.js or similar
  const data = threat_patterns.map(t => ({
    label: t.type,
    value: t.count
  }));
};
```

### Alert Rules UI

```javascript
// Create alert rule
const createRule = async (rule) => {
  const response = await fetch('/auth/alerts/rules', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rule_type: 'keyword',
      value: 'ransomware',
      severity: 'high'
    })
  });
  return response.json();
};

// Get alert delivery status
const getAlertLogs = async () => {
  const response = await fetch('/auth/alerts/processing-logs?limit=20', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { logs } = await response.json();
  
  // Display delivery status
  logs.forEach(log => {
    console.log(`Alert ${log.alert_id}: ${log.processor_type} - ${log.processing_status}`);
  });
};
```

---

## 🚀 For DevOps/SRE

### Environment Variables Required

```bash
# File: .env or /etc/gueinsight/.env

# VirusTotal
VIRUSTOTAL_API_KEY=YOUR_VT_API_KEY

# AbuseIPDB
ABUSEIPDB_API_KEY=YOUR_AIDB_API_KEY

# RapidAPI
RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY
RAPIDAPI_HOST_IP_QUALITY=ipqualityscore-ip-reputation-database.p.rapidapi.com
RAPIDAPI_HOST_THREAT_JAMMER=threat-jammer-api.p.rapidapi.com

# Celery & Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Database
DATABASE_URL=postgresql://user:password@host:5432/gueinsight
```

### Celery Configuration

```bash
# Start Celery worker
celery -A app.celery_app worker --loglevel=info

# Start Celery beat (for scheduled tasks)
celery -A app.celery_app beat --loglevel=info

# Monitor Celery
celery -A app.celery_app inspect active
celery -A app.celery_app inspect stats
```

### Systemd Service Files

```ini
# /etc/systemd/system/gueinsight-celery-worker.service
[Unit]
Description=GueInsight Celery Worker
After=network.target redis-server.service

[Service]
Type=forking
User=gueinsight
WorkingDirectory=/home/gueinsight/gueInsight
ExecStart=/home/gueinsight/.venv/bin/celery -A app.celery_app worker --logfile=/var/log/celery/worker.log

[Install]
WantedBy=multi-user.target
```

### Health Checks

```bash
# Application health
curl -X GET http://localhost:5000/health

# Celery health
celery -A app.celery_app inspect ping

# Redis health
redis-cli ping

# Database health
psql $DATABASE_URL -c "SELECT 1"
```

### Monitoring Queries

```sql
-- Count pending batch jobs
SELECT COUNT(*) FROM batch_file_job WHERE status = 'queued';

-- Check alert processing delays
SELECT AVG(EXTRACT(EPOCH FROM (notification_sent_at - created_at)))
FROM alert_processing_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Monitor analytics metric generation
SELECT COUNT(*) FROM analytics_metric 
WHERE recorded_at > NOW() - INTERVAL '24 hours';

-- Failed integrations
SELECT tool_name, COUNT(*) 
FROM alert_processing_log 
WHERE processing_status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY tool_name;
```

---

## 🐛 Troubleshooting

### Batch Jobs Not Processing

```bash
# Check 1: Celery worker running?
ps aux | grep celery

# Check 2: Redis accessible?
redis-cli ping  # Should return PONG

# Check 3: Check Celery logs
tail -f /var/log/celery/worker.log

# Check 4: Look for stuck tasks
celery -A app.celery_app inspect active

# Solution: Restart worker
systemctl restart gueinsight-celery-worker
```

### API Keys Not Working

```bash
# Test VirusTotal key
curl -H "x-apikey: YOUR_KEY" \
  "https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8"

# Test AbuseIPDB key
curl -H "Key: YOUR_KEY" \
  "https://api.abuseipdb.com/api/v2/check?ipAddress=8.8.8.8"

# Solution: Update .env and restart app
source /etc/gueinsight/.env
systemctl restart gueinsight
```

### Analytics Not Generating

```bash
# Check if Celery Beat is running
ps aux | grep "celery.*beat"

# Check schedule in celery config
python -c "from app.celery_app import app; print(app.conf.beat_schedule)"

# Manually trigger metrics generation
celery -A app.celery_app call app.tasks.celery_tasks.generate_analytics_metrics

# Check results in database
psql $DATABASE_URL -c "SELECT * FROM analytics_metric ORDER BY recorded_at DESC LIMIT 10;"
```

---

## 📚 File Structure

```
app/
├── models.py                          # ✓ Enterprise models added
├── routes/
│   ├── users_enterprise_routes.py     # ✓ 15 new endpoints
│   └── users_routes.py                # ✓ Registration updated
├── integrations/
│   ├── virustotal_integration.py      # ✓ New file
│   ├── abuseipdb_integration.py       # ✓ New file
│   ├── slack_integration.py           # ✓ New file
│   ├── rapidapi.py                    # ✓ Enhanced
│   └── microsoft365.py                # Existing
├── tasks/
│   └── celery_tasks.py                # ✓ 3 new async tasks
└── app.py                             # Existing

docs/
├── ENTERPRISE_FEATURES_GUIDE.md       # ✓ New comprehensive guide
└── ENTERPRISE_DEPLOYMENT_CHECKLIST.md # ✓ New deployment steps
```

---

## ✅ Testing Commands

```bash
# Test all new imports
python -c "
from app.models import SubUser, BatchFileJob, AnalyticsMetric, AlertProcessingLog, SecurityToolIntegration
from app.routes.users_enterprise_routes import register_enterprise_routes
from app.integrations.virustotal_integration import test_connection
from app.integrations.abuseipdb_integration import check_ip
from app.integrations.slack_integration import send_alert_to_slack
from app.tasks.celery_tasks import process_batch_files, process_alert_async, generate_analytics_metrics
print('✓ All imports successful')
"

# Run quick functionality test
python -c "
from app.integrations.virustotal_integration import ABUSE_CATEGORIES
from app.integrations.abuseipdb_integration import ABUSE_CATEGORIES as AIDB_CATS
print('✓ Integration modules loaded')
print(f'  - VirusTotal API available')
print(f'  - AbuseIPDB categories: {len(AIDB_CATS)}')
"
```

---

## 🎓 Learning Resources

### Understanding the Architecture

1. **Models** → Database layer (`models.py`)
2. **Routes** → API endpoints (`users_enterprise_routes.py`)
3. **Tasks** → Async processing (`celery_tasks.py`)
4. **Integrations** → External APIs (`integrations/`)

### Recommended Reading Order

1. `ENTERPRISE_FEATURES_GUIDE.md` - Feature overview
2. `app/models.py` - See new models
3. `app/routes/users_enterprise_routes.py` - See endpoints
4. `app/tasks/celery_tasks.py` - See async tasks
5. `app/integrations/*.py` - See integration patterns

---

## 🔗 Related Documentation

- **Full Feature Guide**: `ENTERPRISE_FEATURES_GUIDE.md`
- **Deployment Checklist**: `ENTERPRISE_DEPLOYMENT_CHECKLIST.md`
- **API Reference**: Check `/auth/` endpoints in code
- **Architecture**: See flow diagrams in feature guide

---

**Quick Links:**
- 📧 API: `/auth/sub-users`, `/auth/batch-jobs`, `/auth/analytics/`, `/auth/alerts/`, `/auth/integrations`
- 🔗 Integration Docs: In each `*_integration.py` file
- 📊 Database Schema: See models.py line ~400+
- ⚙️ Celery Tasks: See celery_tasks.py

---

**Status**: ✅ Ready for Development  
**Last Verified**: 2026-06-23
