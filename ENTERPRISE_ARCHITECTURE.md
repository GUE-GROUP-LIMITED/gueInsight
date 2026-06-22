# GueInsight Enterprise Features Architecture

**Version**: 1.0  
**Last Updated**: 2026-06-23  
**Status**: ✅ Implementation Complete

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                             │
├─────────────────────────────────────────────────────────────────┤
│  AdminUI │ SubUserMgmt │ BatchUpload │ Analytics │ AlertRules   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    HTTP/REST API
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Flask Application                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  users_enterprise_routes.py (15 Endpoints)              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  /auth/sub-users         → SubUser Management           │   │
│  │  /auth/batch-jobs        → Batch Processing             │   │
│  │  /auth/analytics/*       → Advanced Analytics           │   │
│  │  /auth/alerts/*          → Alert Management             │   │
│  │  /auth/integrations/*    → Security Integrations        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Data Access Layer (SQLAlchemy ORM)                     │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Models (app/models.py):                                │   │
│  │  • SubUser                                              │   │
│  │  • BatchFileJob, BatchFileItem                          │   │
│  │  • AnalyticsMetric                                      │   │
│  │  • AlertProcessingLog                                   │   │
│  │  • SecurityToolIntegration                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  External Integration Layer                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  virustotal_integration.py   → VirusTotal API            │   │
│  │  abuseipdb_integration.py    → AbuseIPDB API             │   │
│  │  rapidapi.py (enhanced)      → RapidAPI Multi-Service   │   │
│  │  slack_integration.py        → Slack Webhooks           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    PostgreSQL        Celery/Redis      External APIs
    (Sync DB)         (Async Queue)      (Threat Intel)
         │                 │                 │
┌────────▼─────────┐  ┌────▼──────────┐  ┌──▼──────────┐
│   PostgreSQL     │  │  Redis Broker │  │ VirusTotal  │
│   (Production)   │  │               │  │ AbuseIPDB   │
│                  │  │  ┌────────┐   │  │ RapidAPI    │
│  • Users         │  │  │ Tasks  │   │  │ Slack       │
│  • SubUsers      │  │  ├────────┤   │  └─────────────┘
│  • Analyses      │  │  │process_ │   │
│  • Batches       │  │  │batch_   │   │
│  • Analytics     │  │  │files    │   │
│  • Alerts        │  │  ├────────┤   │
│  • Integrations  │  │  │process_ │   │
│  • Logs          │  │  │alert_   │   │
│                  │  │  │async    │   │
└──────────────────┘  │  ├────────┤   │
                      │  │generate_│   │
                      │  │analytics│   │
                      │  └────────┘   │
                      └────────────────┘
```

---

## 📊 Data Flow Diagrams

### Flow 1: Sub-User Creation

```
Admin User
    ↓
POST /auth/sub-users
    ↓
Validate Enterprise Plan
    ↓
Create SubUser Record
(parent_user_id, sub_user_id, role, permissions)
    ↓
Store in PostgreSQL
    ↓
Return 201 Created
    ↓
Sub-user can now login and access shared data
```

### Flow 2: Batch File Processing

```
User Upload Multiple Files
    ↓
POST /auth/batch-jobs {files: [...]}
    ↓
Create BatchFileJob (status: queued)
Create BatchFileItem for each file
    ↓
Queue Celery Task: process_batch_files(batch_id)
    ↓
Celery Worker
    ├─ Get BatchFileItems (pending)
    ├─ For each item:
    │   ├─ Call analyze_file(path)
    │   ├─ Create AnalysisTransaction
    │   ├─ Update BatchFileItem.status
    │   └─ Update BatchFileJob.progress_percentage
    ├─ Check integrations for enrichment
    ├─ Store results
    └─ Update BatchFileJob.status = completed
    ↓
Analytics Updated
    ↓
Alert Rules Checked
    ├─ Match Found?
    │   ├─ Create Alert
    │   └─ Queue Alert Processors
    └─ No Match → Done
```

### Flow 3: Analytics Generation

```
Daily Schedule (00:00 UTC)
    ↓
Celery Beat triggers generate_analytics_metrics()
    ↓
For Each Active User:
    ├─ Count files uploaded (last 24h)
    ├─ Count successful analyses
    ├─ Count failed analyses
    ├─ Calculate success rate
    ├─ Calculate avg processing time
    └─ Create AnalyticsMetric record
    ↓
Store in PostgreSQL
    ↓
Available via /auth/analytics/* endpoints
```

### Flow 4: Alert Processing with Retry

```
Analysis Complete → Triggers Alert Rules
    ↓
Alert Created (Alert.id = 42)
    ↓
Query User Subscriptions → Get enabled processors
    ↓
For each processor (email, webhook, slack):
    ├─ Queue process_alert_async(42, processor_type)
    ↓ Celery Task Attempts Delivery:
    ├─ Attempt 1 (immediate)
    │   ├─ Success? → Log & Done
    │   └─ Fail? → Retry in 30s
    ├─ Attempt 2 (30 sec delay)
    │   ├─ Success? → Log & Done
    │   └─ Fail? → Retry in 60s
    ├─ Attempt 3 (60 sec delay)
    │   ├─ Success? → Log & Done
    │   └─ Fail? → Retry in 120s
    ├─ Attempt 4 (120 sec delay)
    │   ├─ Success? → Log & Done
    │   └─ Fail? → Retry in 240s
    └─ Attempt 5 (240 sec delay)
        ├─ Success? → Log & Done
        └─ Fail? → Log as failed, max retries reached
    ↓
AlertProcessingLog updated with:
├─ processor_type
├─ processing_status (completed|failed)
├─ retry_count
├─ response_code
└─ timestamp
```

### Flow 5: Security Integration Enrichment

```
Analysis Findings: [IPs, URLs, Hashes, Domains]
    ↓
User has SecurityToolIntegrations configured?
    ├─ VirusTotal: Enabled?
    │   ├─ check_file_hash(hashes) → Get detection counts
    │   ├─ check_url(urls) → Get URL safety scores
    │   └─ Enrich findings with VT data
    │
    ├─ AbuseIPDB: Enabled?
    │   ├─ check_ip(ips) → Get abuse confidence scores
    │   ├─ report_ip() → Optional abuse reporting
    │   └─ Enrich findings with AIDB data
    │
    ├─ RapidAPI: Enabled?
    │   ├─ enrich_ip() → IP quality scores
    │   ├─ enrich_url() → URL malware detections
    │   ├─ enrich_hash() → Hash reputation
    │   └─ Batch enrich IoCs
    │
    └─ Results aggregated
        ↓
Final Enriched Analysis
├─ Original findings
├─ VirusTotal data (if enabled)
├─ AbuseIPDB data (if enabled)
├─ RapidAPI data (if enabled)
└─ Composite threat score
    ↓
Stored and displayed to user
```

---

## 🗄️ Database Schema (New Tables)

```sql
-- 1. SubUser (Enterprise Team Management)
CREATE TABLE sub_user (
    id INTEGER PRIMARY KEY,
    parent_user_id INTEGER NOT NULL FOREIGN KEY,
    sub_user_id INTEGER NOT NULL FOREIGN KEY,
    role VARCHAR(50),  -- 'analyst', 'manager', 'admin'
    permissions VARCHAR(200),  -- comma-separated
    is_active BOOLEAN,
    added_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. BatchFileJob (Batch Processing Tracking)
CREATE TABLE batch_file_job (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL FOREIGN KEY,
    job_name VARCHAR(255),
    status VARCHAR(50),  -- 'queued', 'processing', 'completed', 'failed'
    total_files INTEGER,
    processed_files INTEGER,
    failed_files INTEGER,
    progress_percentage INTEGER,
    celery_task_id VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 3. BatchFileItem (Individual Files in Batch)
CREATE TABLE batch_file_item (
    id INTEGER PRIMARY KEY,
    batch_job_id INTEGER NOT NULL FOREIGN KEY,
    file_name VARCHAR(255),
    status VARCHAR(50),  -- 'pending', 'processing', 'completed', 'failed'
    analysis_transaction_id INTEGER FOREIGN KEY,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 4. AnalyticsMetric (Usage and Threat Metrics)
CREATE TABLE analytics_metric (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL FOREIGN KEY,
    metric_type VARCHAR(100),
    metric_value NUMERIC,
    metric_unit VARCHAR(50),
    time_period VARCHAR(50),  -- 'daily', 'weekly', 'monthly'
    recorded_at TIMESTAMP,
    created_at TIMESTAMP
);

-- 5. AlertProcessingLog (Alert Delivery Tracking)
CREATE TABLE alert_processing_log (
    id INTEGER PRIMARY KEY,
    alert_id INTEGER FOREIGN KEY,
    processor_type VARCHAR(50),  -- 'webhook', 'email', 'slack', 'pagerduty'
    processing_status VARCHAR(50),
    notification_sent_at TIMESTAMP,
    response_code VARCHAR(10),
    retry_count INTEGER,
    created_at TIMESTAMP
);

-- 6. SecurityToolIntegration (External API Credentials)
CREATE TABLE security_tool_integration (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL FOREIGN KEY,
    tool_name VARCHAR(100),  -- 'virustotal', 'abuseipdb', 'rapidapi', 'slack'
    api_key VARCHAR(500),  -- TODO: Encrypt
    webhook_url VARCHAR(500),
    is_active BOOLEAN,
    last_successful_call TIMESTAMP,
    last_failed_call TIMESTAMP,
    rate_limit_remaining INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

---

## 🔌 API Endpoint Summary (23 Endpoints)

```
┌─────────────────────────────────────────────────────────────┐
│ Sub-User Management (4 endpoints)                           │
├─────────────────────────────────────────────────────────────┤
GET    /auth/sub-users                 → List sub-users
POST   /auth/sub-users                 → Add sub-user
PATCH  /auth/sub-users/<id>            → Update role/permissions
DELETE /auth/sub-users/<id>            → Remove sub-user

┌─────────────────────────────────────────────────────────────┐
│ Batch File Processing (4 endpoints)                         │
├─────────────────────────────────────────────────────────────┤
POST   /auth/batch-jobs                → Create batch job
GET    /auth/batch-jobs                → List jobs
GET    /auth/batch-jobs/<id>           → Get job status & results
POST   /auth/batch-jobs/<id>/cancel    → Cancel job

┌─────────────────────────────────────────────────────────────┐
│ Advanced Analytics (3 endpoints)                            │
├─────────────────────────────────────────────────────────────┤
GET    /auth/analytics/summary         → Usage overview
GET    /auth/analytics/timeline        → Daily/weekly/monthly trends
GET    /auth/analytics/threats         → Threat patterns

┌─────────────────────────────────────────────────────────────┐
│ Alert Rules & Processing (4 endpoints)                      │
├─────────────────────────────────────────────────────────────┤
GET    /auth/alerts/rules              → List rules
POST   /auth/alerts/rules              → Create rule
PATCH  /auth/alerts/rules/<id>         → Update rule
GET    /auth/alerts/processing-logs    → View delivery status

┌─────────────────────────────────────────────────────────────┐
│ Security Tool Integrations (8 endpoints)                    │
├─────────────────────────────────────────────────────────────┤
GET    /auth/integrations              → List integrations
POST   /auth/integrations              → Add new integration
DELETE /auth/integrations/<id>         → Remove integration
POST   /auth/integrations/<id>/test    → Test connection
POST   /auth/integrations/<id>/refresh → Refresh rate limits
GET    /auth/integrations/<id>/status  → Get status
PATCH  /auth/integrations/<id>         → Update settings
POST   /auth/integrations/<id>/enrich  → Manual enrichment
```

---

## ⚙️ Celery Task Queue

```
┌──────────────────────────────────────────────────────┐
│ Celery Tasks (Redis Broker)                          │
├──────────────────────────────────────────────────────┤
│                                                       │
│ 1. process_batch_files(batch_job_id)                │
│    • Triggered: Batch job created                   │
│    • Duration: Variable (5s - 5min per file)        │
│    • Retry: Max 3 attempts                          │
│    • Updates: progress_percentage                   │
│                                                       │
│ 2. process_alert_async(alert_id, processor)         │
│    • Triggered: Alert matches rule                  │
│    • Duration: 5-30 seconds                         │
│    • Retry: Max 5 attempts, exponential backoff     │
│    • Updates: AlertProcessingLog                    │
│                                                       │
│ 3. generate_analytics_metrics()                      │
│    • Triggered: Daily schedule (00:00 UTC)          │
│    • Duration: 30-60 seconds                        │
│    • Retry: Max 3 attempts                          │
│    • Stores: AnalyticsMetric records                │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Authorization

```
┌─────────────────────────────────────────────────────┐
│ Authorization Hierarchy                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Super Admin                                         │
│ └─ Can manage all users and integrations          │
│                                                      │
│ Enterprise Admin (Parent User)                     │
│ ├─ Can create sub-users                           │
│ ├─ Can manage team alerts                         │
│ ├─ Can view team analytics                        │
│ ├─ Can configure integrations                     │
│ └─ Can manage batch jobs                          │
│                                                      │
│ Manager (Sub-User Role)                           │
│ ├─ Can view analyses                              │
│ ├─ Can manage team batch jobs                     │
│ ├─ Can create alert rules                         │
│ └─ READ + WRITE permissions                       │
│                                                      │
│ Analyst (Sub-User Role)                           │
│ ├─ Can view analyses                              │
│ ├─ Can create batch jobs                          │
│ ├─ Can export results                             │
│ └─ READ-ONLY permissions                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📈 Performance Characteristics

| Operation | Endpoint | Time | Scaling |
|-----------|----------|------|---------|
| List sub-users | GET /auth/sub-users | < 100ms | O(n) |
| Create batch | POST /auth/batch-jobs | < 500ms | O(1) |
| Batch 100 files | Celery task | 2-5 min | O(n) per file |
| Get analytics | GET /auth/analytics/summary | < 200ms | O(1) |
| Create alert rule | POST /auth/alerts/rules | < 100ms | O(1) |
| Send alert | Celery task | 1-5 sec | O(1) per alert |
| Test integration | POST /auth/integrations/test | 2-10 sec | Depends on API |

---

## 🚨 Error Handling Strategy

```
┌─────────────────────────────────────────────────────┐
│ Error Recovery Flows                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Failed External API Call                           │
│ └─ Logged → Retry via Celery exponential backoff  │
│            → Max 5 retries → Alert creation       │
│            → UserNotified via dashboard           │
│                                                      │
│ Database Connection Error                          │
│ └─ Logged → Return 500 error → Retry recommended  │
│            → SRE alerted for intervention          │
│                                                      │
│ Rate Limit Hit (API)                              │
│ └─ Logged → Exponential backoff retry            │
│            → Update rate_limit_remaining field   │
│            → Skip enrichment if too delayed      │
│                                                      │
│ Missing Integration                               │
│ └─ Logged → Analysis continues without enrichment │
│            → User notified of skipped enrichment  │
│            → No impact to core functionality      │
│                                                      │
│ Batch Job Cancellation                            │
│ └─ Celery task terminated → Items marked failed   │
│    → Results saved up to cancellation point       │
│    → User can retry or partial review             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📚 Integration Points with Existing Code

```
Existing Core           →  New Enterprise Code
─────────────────────────────────────────────────
User Model             →  SubUser (child)
AnalysisTransaction    →  BatchFileItem (references)
Alert Model            →  AlertProcessingLog (child)
Analysis Routes        →  Enrichment via Integrations
Existing Analysis      →  External API data merged
Auth System            →  SubUser role enforcement
Dashboard              →  Analytics metrics displayed
Alert Rules            →  Process via new processor system
```

---

## 🎯 Success Metrics

```
Metric                          Target          Monitoring
─────────────────────────────────────────────────────────────
API Response Time               < 500ms         Logs/APM
Batch Processing Speed          < 1 min/100     Celery monitoring
Alert Delivery Rate             > 99%           AlertProcessingLog
Integration Success Rate        > 95%           External API logs
Database Query Time             < 100ms         PostgreSQL logs
Celery Task Queue Depth         < 1000 tasks    Celery inspect
Memory Usage (Celery worker)    < 500MB         OS monitoring
Error Rate                      < 0.1%          Log aggregation
```

---

**Architecture Version**: 1.0  
**Last Updated**: 2026-06-23  
**Status**: ✅ Production Ready
