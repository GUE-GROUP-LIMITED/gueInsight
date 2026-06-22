# Enterprise Features Implementation Guide

**Status**: ✅ Fully Implemented  
**Date**: 2026-06-23  
**Coverage**: 5 Major Features + Integration Framework

---

## 📋 Overview

This implementation adds 5 critical missing features to GueInsight:

1. ✅ **Admin Sub-User Management** - Enterprise team collaboration
2. ✅ **Batch File Processing** - Process multiple files asynchronously
3. ✅ **Advanced Analytics** - Detailed usage and threat metrics
4. ✅ **Real-Time Alert Processing** - Async alert delivery (email, webhook, Slack, SMS)
5. ✅ **External Security Tool Integrations** - VirusTotal, AbuseIPDB, RapidAPI, Slack

---

## 1️⃣ Admin Sub-User Management

### Overview
Enterprise customers (SME, Large Enterprise plans) can now manage sub-users with role-based permissions.

### API Endpoints

#### Get Sub-Users
```
GET /auth/sub-users
```
**Response:**
```json
{
  "sub_users": [
    {
      "id": 1,
      "parent_user_id": 100,
      "sub_user_id": 101,
      "sub_user_email": "analyst@company.com",
      "role": "analyst",
      "permissions": "read,export",
      "is_active": true,
      "added_at": "2026-06-23T10:00:00"
    }
  ],
  "total": 1
}
```

#### Add Sub-User
```
POST /auth/sub-users
Content-Type: application/json

{
  "email": "analyst@company.com",
  "role": "analyst",
  "permissions": "read,export,share"
}
```

**Roles:**
- `analyst` - Can view and run analyses
- `manager` - Can manage team analyses and exports
- `admin` - Can manage sub-users and settings

#### Update Sub-User
```
PATCH /auth/sub-users/<sub_user_id>
Content-Type: application/json

{
  "role": "manager",
  "permissions": "read,export,share,admin"
}
```

#### Remove Sub-User
```
DELETE /auth/sub-users/<sub_user_id>
```

### Models
- **SubUser**: Tracks parent-child user relationships, roles, and permissions
- **Enforced on enterprise plans only** (compliance_pro, enterprise_risk, enterprise_elite)

---

## 2️⃣ Batch File Processing

### Overview
Process multiple files in parallel using Celery async tasks. Perfect for analyzing large file collections.

### API Endpoints

#### Create Batch Job
```
POST /auth/batch-jobs
Content-Type: application/json

{
  "job_name": "Q1 Incident Analysis",
  "files": [
    "/uploads/incident_logs_2026_01.zip",
    "/uploads/incident_logs_2026_02.zip",
    "/uploads/incident_logs_2026_03.zip"
  ]
}
```

**Response:**
```json
{
  "id": 42,
  "user_id": 100,
  "job_name": "Q1 Incident Analysis",
  "status": "queued",
  "total_files": 3,
  "processed_files": 0,
  "failed_files": 0,
  "progress_percentage": 0,
  "created_at": "2026-06-23T10:00:00"
}
```

#### Get Batch Job Details
```
GET /auth/batch-jobs/<job_id>
```

**Response includes:**
- Job metadata
- Progress information
- Per-file status and results
- Individual analysis transaction IDs

#### List Batch Jobs
```
GET /auth/batch-jobs?limit=10&offset=0&status=completed
```

#### Cancel Batch Job
```
POST /auth/batch-jobs/<job_id>/cancel
```

### Features
- **Max 100 files per batch** for stability
- **Async processing** using Celery task queue
- **Progress tracking** with percentage updates
- **Per-file status** (pending, processing, completed, failed)
- **Error handling** with retry logic
- **Linked to analysis transactions** for reporting

### Models
- **BatchFileJob**: Tracks batch job metadata and progress
- **BatchFileItem**: Individual files within a batch job
- **Celery Task**: `process_batch_files` handles async execution

---

## 3️⃣ Advanced Analytics

### Overview
Comprehensive analytics dashboards showing usage patterns, threat trends, and performance metrics.

### API Endpoints

#### Get Analytics Summary
```
GET /auth/analytics/summary?days=30
```

**Response:**
```json
{
  "period_days": 30,
  "total_analyses": 150,
  "successful": 145,
  "failed": 5,
  "success_rate": 96.67,
  "total_items_processed": 8500,
  "avg_processing_ms": 4230
}
```

#### Get Analytics Timeline
```
GET /auth/analytics/timeline?days=30
```

**Returns daily metrics:**
```json
{
  "metrics": [
    {
      "id": 1,
      "user_id": 100,
      "metric_type": "files_uploaded",
      "metric_value": 45,
      "metric_unit": "count",
      "time_period": "daily",
      "recorded_at": "2026-06-23T00:00:00"
    }
  ]
}
```

#### Get Threat Analytics
```
GET /auth/analytics/threats?days=30
```

**Returns threat patterns:**
```json
{
  "threat_patterns": [
    {
      "type": "Ransomware",
      "count": 15
    },
    {
      "type": "Phishing",
      "count": 8
    }
  ]
}
```

### Metrics Tracked
- Total analyses and success rates
- Items processed and processing time
- Threats detected by type
- File type distribution
- Analysis trends over time
- Resource utilization

### Models
- **AnalyticsMetric**: Stores metric data with user_id, type, value, and time period

### Auto-Generation
- Celery task `generate_analytics_metrics` runs daily (scheduled)
- Calculates metrics for all active users
- Stores in AnalyticsMetric table for trending

---

## 4️⃣ Real-Time Alert Processing

### Overview
Async alert delivery with retry logic, supporting multiple notification channels.

### Alert Rules

#### List Alert Rules
```
GET /auth/alerts/rules
```

#### Create Alert Rule
```
POST /auth/alerts/rules
Content-Type: application/json

{
  "rule_type": "keyword",
  "value": "ransomware",
  "severity": "high"
}
```

**Rule Types:**
- `keyword` - Match text in analysis results
- `ioc` - Match on detected IoCs
- `severity` - Match on alert severity
- `threat_type` - Match on specific threat

#### Update Alert Rule
```
PATCH /auth/alerts/rules/<rule_id>

{
  "enabled": false,
  "severity": "critical"
}
```

### Alert Processing

#### Get Processing Logs
```
GET /auth/alerts/processing-logs?limit=20
```

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "alert_id": 42,
      "processing_status": "completed",
      "processor_type": "email",
      "notification_sent_at": "2026-06-23T10:05:30",
      "response_code": "200",
      "retry_count": 0,
      "created_at": "2026-06-23T10:05:00"
    }
  ]
}
```

### Notification Channels

#### 1. **Webhook**
- Sends HTTP POST to configured webhook URL
- Includes alert metadata as JSON
- Retry on failure (3 max)

#### 2. **Email**
- Direct email to user account
- HTML formatted with alert details
- Supports custom email templates

#### 3. **Slack**
- Posts to configured Slack channel
- Formatted messages with threat level colors
- Action buttons for quick access

#### 4. **PagerDuty** (Framework Ready)
- Incident creation via PagerDuty API
- Severity mapping to incident urgency

### Models
- **Alert**: Triggered alerts from rules
- **AlertRule**: User-defined alert conditions
- **AlertProcessingLog**: Tracks delivery status and retries

### Celery Task
- `process_alert_async`: Handles async delivery with retries
- Exponential backoff for failed deliveries
- Max 5 retry attempts per alert

### Retry Logic
```
Retry Delays (exponential):
- Attempt 1: Immediate
- Attempt 2: 30 seconds
- Attempt 3: 60 seconds (2^1 * 30)
- Attempt 4: 120 seconds (2^2 * 30)
- Attempt 5: 240 seconds (2^3 * 30)
```

---

## 5️⃣ External Security Tool Integrations

### Overview
Connect to leading cybersecurity APIs for threat intelligence enrichment.

### API Endpoints

#### List Integrations
```
GET /auth/integrations
```

#### Add Integration
```
POST /auth/integrations
Content-Type: application/json

{
  "tool_name": "virustotal",
  "api_key": "YOUR_VT_API_KEY"
}
```

**Supported Tools:**
- `virustotal` - File and URL reputation
- `abuseipdb` - IP address reputation
- `shodan` - Network device discovery
- `rapidapi` - Multi-service IoC enrichment

#### Test Integration
```
POST /auth/integrations/<integration_id>/test
```

**Response:**
```json
{
  "status": "success",
  "message": "Integration test passed"
}
```

#### Remove Integration
```
DELETE /auth/integrations/<integration_id>
```

### Integrations Included

#### VirusTotal (`virustotal_integration.py`)
- **Functions:**
  - `test_connection()` - Verify API connectivity
  - `check_file_hash()` - Check MD5/SHA1/SHA256 reputation
  - `check_url()` - URL safety checking
  - `enrich_analysis_results()` - Auto-enrich with VT data

- **Threat Score:** 0-100 detection count
- **Rate Limits:** 4 req/min (free), higher with paid API

#### AbuseIPDB (`abuseipdb_integration.py`)
- **Functions:**
  - `test_connection()` - Verify API connectivity
  - `check_ip()` - IP reputation scoring
  - `report_ip()` - Report malicious IP
  - `check_ips_batch()` - Batch check up to 100 IPs
  - `enrich_analysis_results()` - Auto-enrich with AIDB data

- **Abuse Score:** 0-100 confidence
- **Categories:** 18 abuse types (DNS Compromise, DDoS, SSH Brute-Force, etc.)

#### RapidAPI Enhanced (`rapidapi.py`)
- **Functions:**
  - `test_connection()` - Verify API connectivity
  - `enrich_ip()` - IP quality and reputation score
  - `enrich_url()` - URL safety and malware detection
  - `enrich_hash()` - File hash reputation
  - `batch_enrich_iocs()` - Batch IoC checking
  - `enrich_event()` - Full event enrichment

- **Services:** IP Quality Score, Threat Jammer, and others via RapidAPI

#### Slack Integration (`slack_integration.py`)
- **Functions:**
  - `send_alert_to_slack()` - Send security alerts
  - `send_analysis_summary_to_slack()` - Report summaries
  - `test_webhook()` - Verify webhook configuration

- **Features:** Rich formatting, action buttons, threat level colors

### Integration Flow

```
Analysis Detected → Check Alert Rules → Create Alert
                        ↓
                Query User Integrations
                        ↓
            For each Enabled Integration:
                - VirusTotal: Check file hashes/URLs
                - AbuseIPDB: Check source IPs
                - RapidAPI: Batch IoC enrichment
                        ↓
            Enhanced Analysis Results
                        ↓
            Trigger Notifications:
                - Webhook: POST to configured URL
                - Email: Send to user
                - Slack: Post to channel
                - SMS: Via webhook provider
```

### Environment Variables
```bash
# VirusTotal
VIRUSTOTAL_API_KEY=your_vt_api_key

# AbuseIPDB  
ABUSEIPDB_API_KEY=your_aidb_api_key

# RapidAPI
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST_IP_QUALITY=ipqualityscore-ip-reputation-database.p.rapidapi.com
RAPIDAPI_HOST_THREAT_JAMMER=threat-jammer-api.p.rapidapi.com

# Slack (optional, can be set per-user)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

---

## 🔧 Integration with Existing Analysis

### Automatic Enrichment

When a user has integrations enabled, analysis results are automatically enriched:

```python
# In analysis_routes.py
from app.integrations.virustotal_integration import enrich_analysis_results as vt_enrich
from app.integrations.abuseipdb_integration import enrich_analysis_results as aidb_enrich
from app.integrations.rapidapi import enrich_event

# After file analysis completes:
result = analyze_file(file_path)

# Enrich with enabled integrations
for integration in user.tool_integrations:
    if integration.is_active:
        if integration.tool_name == 'virustotal':
            result = vt_enrich(result, integration.api_key_encrypted)
        elif integration.tool_name == 'abuseipdb':
            result = aidb_enrich(result, integration.api_key_encrypted)
        elif integration.tool_name == 'rapidapi':
            result = enrich_event(result, integration.api_key_encrypted)
```

---

## 🚀 Usage Examples

### Example 1: Enterprise Team Analysis

```bash
# Admin creates sub-users
curl -X POST https://api.gueinsight.com/auth/sub-users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@company.com",
    "role": "analyst",
    "permissions": "read,export"
  }'

# Analyst logs in and accesses shared analyses
curl -X GET https://api.gueinsight.com/auth/sub-users \
  -H "Authorization: Bearer $ANALYST_TOKEN"
```

### Example 2: Batch Analysis

```bash
# Create batch job with multiple files
curl -X POST https://api.gueinsight.com/auth/batch-jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_name": "Quarterly Incident Report",
    "files": ["file1.pcap", "file2.log", "file3.bin"]
  }'

# Monitor progress
curl -X GET https://api.gueinsight.com/auth/batch-jobs/42 \
  -H "Authorization: Bearer $TOKEN"
```

### Example 3: Real-Time Alerts

```bash
# Create alert rule
curl -X POST https://api.gueinsight.com/auth/alerts/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_type": "keyword",
    "value": "ransomware",
    "severity": "high"
  }'

# When ransomware detected, alert automatically sent to:
# - Configured webhook
# - User email
# - Slack channel
# - With automatic retries if delivery fails
```

### Example 4: Threat Intelligence

```bash
# Add VirusTotal integration
curl -X POST https://api.gueinsight.com/auth/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "virustotal",
    "api_key": "YOUR_VT_API_KEY"
  }'

# Test integration
curl -X POST https://api.gueinsight.com/auth/integrations/1/test \
  -H "Authorization: Bearer $TOKEN"

# Subsequent file analysis now includes VirusTotal enrichment
```

---

## 📊 Database Models

### New Models Added

```python
# Enterprise
- SubUser (parent_user_id, sub_user_id, role, permissions)

# Batch Processing
- BatchFileJob (job_name, status, progress, celery_task_id)
- BatchFileItem (batch_job_id, file_name, status, analysis_transaction_id)

# Analytics
- AnalyticsMetric (user_id, metric_type, metric_value, time_period)

# Alerts
- AlertProcessingLog (alert_id, processor_type, processing_status, retries)

# Integrations
- SecurityToolIntegration (user_id, tool_name, api_key, webhook_url, status)
```

---

## ⚙️ Celery Tasks

### New Async Tasks

1. **`process_batch_files(batch_job_id)`**
   - Processes all files in batch asynchronously
   - Updates progress percentage
   - Creates individual analysis transactions

2. **`process_alert_async(alert_id, processor_type)`**
   - Sends alert via specified channel
   - Implements retry with exponential backoff
   - Tracks delivery status and response codes

3. **`generate_analytics_metrics()`**
   - Daily scheduled task
   - Calculates metrics for all users
   - Stores in AnalyticsMetric table

---

## 🔒 Security Considerations

### API Key Encryption
- ⚠️ **TODO**: Encrypt API keys before storing in database
- Current implementation stores in plain text
- Recommendation: Use `cryptography` library

### Authorization
- All endpoints require `@login_required`
- Sub-user endpoints verify enterprise plan
- Integration endpoints enforce user ownership

### Rate Limiting
- External APIs have their own rate limits (documented per integration)
- Batch processing limited to 100 files max
- Batch IoC checking limited to 20 per call

### Data Privacy
- Integration API keys never returned in API responses
- Alert processing logs don't include sensitive data
- User integrations scoped to owner only

---

## 🧪 Testing

### Unit Tests Needed
```
tests/test_enterprise_routes.py
- test_add_sub_user_enterprise_only
- test_batch_job_creation
- test_alert_rule_creation
- test_integration_connection_test

tests/test_celery_tasks.py
- test_process_batch_files
- test_process_alert_async_retry
- test_generate_analytics_metrics

tests/test_integrations/
- test_virustotal_check_hash
- test_abuseipdb_check_ip
- test_rapidapi_enrich_event
- test_slack_send_alert
```

---

## 📚 Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - How to deploy with Celery
- [Production Readiness](./PRODUCTION_READINESS.md) - Production deployment checklist
- [API Documentation](./API.md) - Full API reference

---

## ✅ Completion Checklist

- [x] Sub-User Management implemented
- [x] Batch File Processing with Celery
- [x] Advanced Analytics endpoints
- [x] Real-Time Alert Processing with retries
- [x] VirusTotal integration
- [x] AbuseIPDB integration
- [x] RapidAPI enhanced integration
- [x] Slack integration
- [x] Database models created
- [x] Routes registered
- [x] Documentation complete

---

## 🚦 Next Steps

1. **Testing**: Create comprehensive unit tests for all features
2. **API Keys**: Set up environment variables for integrations
3. **Celery Setup**: Configure Redis/RabbitMQ for task queue
4. **API Key Encryption**: Implement encryption for stored API keys
5. **Webhook Testing**: Test external webhook delivery
6. **Load Testing**: Validate batch processing performance

---

**Implementation Complete** ✅  
All 5 missing features are now fully implemented and ready for testing and deployment.
