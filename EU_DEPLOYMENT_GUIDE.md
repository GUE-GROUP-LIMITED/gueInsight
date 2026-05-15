# EU Compliance Platform — Deployment Guide

## Overview

This guide covers the complete deployment of **gueInsight** as a GDPR/NIS2-compliant threat detection and compliance platform for the European market. It includes:

- EU-only data residency enforcement
- Microsoft 365 & Google Workspace security integrations
- NIS2 incident reporting for critical infrastructure
- Compliance-focused pricing tiers (Starter, Compliance Pro, Enterprise Risk, Enterprise Elite)
- Audit logging and GDPR export/deletion workflows

---

## 1. Environment Configuration

### Required Environment Variables

```bash
# ==== Core Flask/Database ====
FLASK_ENV=production
SECRET_KEY=<generate-with-secrets.token_hex(32)>
DATABASE_ENGINE=postgres
DATABASE_HOST=<eu-db-host>
DATABASE_USER=<db_user>
DATABASE_PASSWORD=<db_password>
DATABASE_NAME=gueinsight_prod

# ==== EU Data Residency ====
EU_ONLY_DATA_RESIDENCY=true        # Enforces EU-only data storage
PREFERRED_DATA_REGION=eu-west-1    # AWS Frankfurt (default)
# Valid regions: eu-west-1 (Frankfurt), eu-central-1, eu-west-2 (London),
#               eu-north-1 (Stockholm), germanycentral (Azure), westeurope (Azure),
#               europe-west1 (GCP Brussels), europe-west4 (GCP Netherlands)

# ==== Microsoft 365 Integration ====
M365_TENANT_ID=<azure-ad-tenant-id>
M365_CLIENT_ID=<azure-app-registration-id>
M365_CLIENT_SECRET=<azure-app-secret>

# ==== Google Workspace Integration ====
GWS_SERVICE_ACCOUNT_PATH=/secrets/gws-service-account.json
# Create via Google Cloud Console → Service Accounts → Enable Directory API

# ==== Stripe (Compliance-Focused Pricing) ====
STRIPE_API_KEY=<stripe-secret-key>
STRIPE_PUBLIC_KEY=<stripe-public-key>

# ==== Session & Security ====
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax
PERMANENT_SESSION_LIFETIME=86400  # 24 hours in seconds

# ==== GDPR/Compliance ====
GDPR_POLICY_VERSION=1.0
DATA_RETENTION_DAYS=180
TERMS_VERSION=1.0

# ==== Admin ====
SUPER_ADMIN_EMAIL=admin@your-company.eu
```

---

## 2. Database Setup

### PostgreSQL (Recommended for EU)

```bash
# Option A: AWS RDS (Frankfurt)
# Endpoint: <instance>.eu-west-1.rds.amazonaws.com
# Region: eu-west-1

# Option B: Azure PostgreSQL (Germany/Netherlands)
# Server: <instance>.postgres.database.azure.com
# Region: germanywestcentral or westeurope

# Option C: Self-hosted (On-premises EU data center)
# Ensure database location is within EU boundaries
```

### Initialize Database Schema

```bash
# Run migrations
flask db upgrade

# Verify tables created
psql -h <db_host> -U <db_user> -d gueinsight_prod -c "\dt"
```

### Create Admin User

```bash
flask shell
>>> from app.models import User, UserRole
>>> from werkzeug.security import generate_password_hash
>>> admin = User(
...     email='admin@your-company.eu',
...     password=generate_password_hash('strong-password-here'),
...     first_name='Admin',
...     last_name='User',
...     phone_number='+49123456789',
...     role=UserRole.ADMIN
... )
>>> db.session.add(admin)
>>> db.session.commit()
```

---

## 3. Microsoft 365 Integration Setup

### Prerequisites

- Azure AD tenant (Microsoft Entra ID)
- App Registration with delegated permissions

### Azure AD Configuration

1. **Navigate to Azure Portal** → Azure AD → App Registrations → New Registration
   - Name: `gueInsight Security Connector`
   - Supported Account Types: `Accounts in this organizational directory only`
   - Redirect URI: `https://your-domain.eu/auth/m365/callback`

2. **Grant API Permissions:**
   - Microsoft Graph → Delegated Permissions:
     - `User.Read.All`
     - `Directory.Read.All`
     - `SecurityEvents.Read.All`
     - `Mail.Read`
     - `DeviceManagementServiceConfig.Read.All`
     - `AuditLog.Read.All`

3. **Create Client Secret:**
   - Certificates & Secrets → New Client Secret
   - Copy `Client ID` and `Client Secret` to `.env` file

4. **Enable Multi-Tenant Admin Consent:**
   - API permissions → Grant admin consent for your organization

### Environment Variables

```bash
M365_TENANT_ID=<from Azure AD > Tenant ID>
M365_CLIENT_ID=<from Azure AD > App Registration > Application (client) ID>
M365_CLIENT_SECRET=<from Azure AD > Certificates & Secrets>
```

### Verify Integration

```bash
# Test M365 connector
flask shell
>>> from app.integrations.microsoft365 import create_m365_connector
>>> m365 = create_m365_connector()
>>> m365.authenticate()
True
>>> users = m365.get_users(limit=5)
>>> print(users)
```

---

## 4. Google Workspace Integration Setup

### Prerequisites

- Google Cloud Project with Google Workspace
- Service Account with Domain-Wide Delegation

### Google Cloud Configuration

1. **Create Service Account:**
   - Google Cloud Console → Service Accounts → Create Service Account
   - Name: `gueInsight Workspace Auditor`
   - Grant roles: `Editor` (for testing; restrict to minimal scopes in prod)

2. **Create Key:**
   - Service Account → Keys → Create key → JSON
   - Save as `/secrets/gws-service-account.json`

3. **Enable Domain-Wide Delegation:**
   - Service Account → Details → Show domain-wide delegation
   - Copy `Client ID` for delegation setup

4. **Configure Workspace Domain-Wide Delegation:**
   - Google Admin Console → Security → Access and data control → API controls → Manage third-party app access
   - Add Client ID with scopes:
     - `https://www.googleapis.com/auth/admin.directory.user`
     - `https://www.googleapis.com/auth/admin.directory.group`
     - `https://www.googleapis.com/auth/admin.directory.device.mobile`

5. **Set Admin User Email:**
   ```bash
   export GWS_ADMIN_EMAIL=admin@your-workspace.com  # For domain-wide delegation
   ```

### Environment Variables

```bash
GWS_SERVICE_ACCOUNT_PATH=/secrets/gws-service-account.json
GWS_ADMIN_EMAIL=admin@your-workspace.com  # Workspace admin for delegation
```

### Verify Integration

```bash
# Test GWS connector
flask shell
>>> from app.integrations.googleworkspace import create_gws_connector
>>> gws = create_gws_connector()
>>> gws.authenticate(subject='admin@your-workspace.com')
True
>>> groups = gws.get_groups(limit=5)
>>> print(groups)
```

---

## 5. EU Data Residency Enforcement

### Configuration

Enable EU-only data residency in production:

```bash
EU_ONLY_DATA_RESIDENCY=true
PREFERRED_DATA_REGION=eu-west-1  # Change as needed
```

### Supported EU Regions

| Provider | Region Code | Location |
|----------|-------------|----------|
| **AWS** | eu-west-1 | Frankfurt, Germany |
| **AWS** | eu-central-1 | Frankfurt, Germany |
| **AWS** | eu-west-2 | London, UK |
| **AWS** | eu-north-1 | Stockholm, Sweden |
| **Azure** | germanycentral | Frankfurt, Germany |
| **Azure** | germanywestcentral | Magdeburg, Germany |
| **Azure** | westeurope | Amsterdam, Netherlands |
| **Azure** | northeurope | Dublin, Ireland |
| **GCP** | europe-west1 | Brussels, Belgium |
| **GCP** | europe-west4 | Eemshaven, Netherlands |

### Middleware Activation

The EU residency middleware is automatically activated in `app.py`:

```python
from app.middleware.eu_residency import init_eu_residency

# In app creation
app = Flask(__name__)
init_eu_residency(app)
```

### Verify Enforcement

```bash
# Test that non-EU region is rejected
export EU_ONLY_DATA_RESIDENCY=true
export PREFERRED_DATA_REGION=us-east-1
flask run
# Error: EU_ONLY_DATA_RESIDENCY enabled but region 'us-east-1' is non-EU.
```

---

## 6. GDPR Compliance Configuration

### Data Export & Deletion Workflows

Enable GDPR Article 5 compliance:

1. **User initiates export:**
   ```bash
   POST /auth/privacy_export
   Response: { "download_url": "..." }  # Token valid for 24h
   ```

2. **User downloads export:**
   ```bash
   GET /auth/privacy_export_download/<token>
   Response: JSON file with user data
   # Audit logged automatically
   ```

3. **User requests deletion:**
   ```bash
   POST /auth/privacy_delete_request
   Payload: { "reason": "..." }
   # Account deactivated; data queued for deletion
   ```

### Audit Logging

All GDPR actions are logged in `security_event` table:

- `auth_privacy_export_initiated` — User requested data export
- `auth_privacy_export_downloaded` — User downloaded export file
- `auth_privacy_delete_requested` — User requested account deletion

Query audit logs:

```bash
flask shell
>>> from app.models import SecurityEvent
>>> events = SecurityEvent.query.filter(
...     SecurityEvent.event_type.like('auth_privacy%')
... ).all()
>>> for e in events:
...     print(e.to_dict())
```

---

## 7. NIS2 Compliance Setup

### Incident Reporting Endpoint

NIS2 critical infrastructure incidents are reported via:

```bash
POST /api/incidents/report-nis2
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "incident_type": "ransomware",  # or: data_breach, ddos, supply_chain
  "severity": "critical",          # or: high, medium, low
  "affected_systems": "Email, VPN, File Share",
  "initial_detection_at": "2026-05-15T14:30:00",
  "description": "Ransomware detected on Exchange servers",
  "actions_taken": "Isolated affected servers; restored from backup",
  "notification_recipient": "incident@bsi.de"  # Competent authority
}
```

### Compliance Dashboard Endpoint

Fetch compliance readiness summary:

```bash
GET /api/compliance/readiness
Authorization: Bearer <admin_token>

Response:
{
  "compliance_overview": {
    "gdpr": { "status": "compliant", "export_requests": 5, ... },
    "nis2": { "status": "active", "incident_reports": 2, "critical_incidents": 0, ... },
    "iso27001": { "status": "in_progress", "audit_trail_events": 145, ... }
  },
  "tier_distribution": { "compliance_pro": {...}, "enterprise_risk": {...} },
  "deployment_info": { "eu_residency_enforced": true, "preferred_region": "eu-west-1" }
}
```

---

## 8. Pricing Model Configuration

### Compliance Tiers

The new pricing model uses compliance-focused tiers:

| Tier | Price/Month | GDPR | NIS2 | M365 | GWS | Storage |
|------|------------|------|------|------|-----|---------|
| Starter | €0 | ✗ | ✗ | ✗ | ✗ | 1 GB |
| Compliance Pro | €29.90 | ✓ | ✗ | Basic | ✗ | 10 GB |
| Enterprise Risk | €499 | ✓ | ✓ | Full | ✓ | 100 GB |
| Enterprise Elite | €999 | ✓ | ✓ | Full | ✓ | 1 TB + EU-only |

### Stripe Product Configuration

Update Stripe products with metadata:

```python
# In your Stripe dashboard or via API
stripe.Product.create(
    name="Compliance Pro",
    description="GDPR Article 5 + audit logging",
    metadata={
        "tier": "compliance_pro",
        "gdpr_ready": "true",
        "nis2_ready": "false",
        "integrations": "m365_basic"
    }
)
```

---

## 9. Deployment Checklist

### Pre-Launch

- [ ] Database migrated to EU region (PostgreSQL RDS Frankfurt or Azure Germany)
- [ ] `EU_ONLY_DATA_RESIDENCY=true` configured
- [ ] Microsoft 365 integration credentials validated
- [ ] Google Workspace service account configured
- [ ] Stripe products created with compliance tier metadata
- [ ] GDPR policy version specified (`GDPR_POLICY_VERSION`)
- [ ] Admin user created with `SUPER_ADMIN_EMAIL`

### Security

- [ ] SECRET_KEY is strong (32+ bytes, random)
- [ ] `SESSION_COOKIE_SECURE=true` in production
- [ ] `SESSION_COOKIE_HTTPONLY=true` (no JavaScript access)
- [ ] HTTPS/TLS enforced (minimum TLS 1.2)
- [ ] M365 & GWS credentials stored securely (not in git)
- [ ] Database backups enabled (daily, EU region)

### Compliance

- [ ] Audit logging active (SecurityEvent model)
- [ ] GDPR export/delete endpoints tested
- [ ] NIS2 incident reporting endpoint verified
- [ ] Data retention policy enforced (180 days default)
- [ ] Privacy policy version updated
- [ ] Terms of service version updated

### Performance

- [ ] Database connection pooling configured (10–20 connections)
- [ ] Redis cache (optional) for session/rate limiting
- [ ] CDN for static assets (with EU edge locations)
- [ ] API rate limiting active (12 requests/min per user)

---

## 10. Deployment Commands

### Development

```bash
# Setup
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt

# Database initialization
export FLASK_APP=app.py
flask db init
flask db migrate
flask db upgrade

# Create admin
flask shell
# ... create admin user (see Section 2)

# Run
flask run
```

### Production (AWS ECS / Docker)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# EU data residency enforcement
ENV EU_ONLY_DATA_RESIDENCY=true
ENV PREFERRED_DATA_REGION=eu-west-1

# GDPR
ENV GDPR_POLICY_VERSION=1.0
ENV DATA_RETENTION_DAYS=180

# Run with gunicorn
CMD ["gunicorn", "--workers=4", "--bind=0.0.0.0:5000", "wsgi:app"]
```

### Deploy with Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: gueinsight_prod
      POSTGRES_PASSWORD: <strong-password>
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: ["-c", "shared_buffers=256MB", "-c", "max_connections=200"]

  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_ENGINE: postgres
      DATABASE_HOST: postgres
      DATABASE_USER: postgres
      DATABASE_PASSWORD: <strong-password>
      DATABASE_NAME: gueinsight_prod
      EU_ONLY_DATA_RESIDENCY: "true"
      PREFERRED_DATA_REGION: eu-west-1
      M365_TENANT_ID: ${M365_TENANT_ID}
      M365_CLIENT_ID: ${M365_CLIENT_ID}
      M365_CLIENT_SECRET: ${M365_CLIENT_SECRET}
      GWS_SERVICE_ACCOUNT_PATH: /secrets/gws-sa.json
    depends_on:
      - postgres
    volumes:
      - ./secrets:/secrets:ro

volumes:
  postgres_data:
```

---

## 11. Monitoring & Alerting

### Key Metrics

Monitor in production:

```sql
-- GDPR compliance
SELECT COUNT(*) FROM data_export_request WHERE requested_at > NOW() - INTERVAL 7 day;
SELECT COUNT(*) FROM data_deletion_request WHERE status = 'pending';

-- NIS2 incidents
SELECT COUNT(*) FROM nis2_incident_report WHERE severity = 'critical' AND created_at > NOW() - INTERVAL 30 day;

-- Security events
SELECT COUNT(*) FROM security_event WHERE severity IN ('high', 'critical') AND created_at > NOW() - INTERVAL 7 day;

-- Subscription health
SELECT tier, COUNT(*) as users FROM subscription GROUP BY plan;
```

### CloudWatch / Datadog Integration

```python
# In app.py
import logging
from watchtower import CloudWatchLogHandler

logger = logging.getLogger(__name__)
logger.addHandler(CloudWatchLogHandler())

# Log compliance events
logger.warning(f"NIS2 incident reported: {incident_id}", extra={
    'incident_type': incident.incident_type,
    'severity': incident.severity
})
```

---

## 12. Support & Troubleshooting

### Common Issues

**Q: EU_ONLY_DATA_RESIDENCY=true but app won't start**
```
Error: EU_ONLY_DATA_RESIDENCY enabled but region 'us-east-1' is non-EU.
Solution: Change PREFERRED_DATA_REGION to an EU region (eu-west-1, eu-central-1, etc.)
```

**Q: M365 authentication fails**
```
Error: M365_TENANT_ID or M365_CLIENT_ID not set
Solution: Verify Azure AD credentials in .env file; test with flask shell
```

**Q: GDPR export download returns 403 Forbidden**
```
Cause: Download token expired (24h limit) or user mismatch
Solution: Request new export from user; regenerate token
```

**Q: NIS2 incident endpoint returns 401**
```
Cause: User is not admin
Solution: Verify @admin_required decorator; check SUPER_ADMIN_EMAIL config
```

---

## Contact & Support

For compliance questions, contact: **compliance@your-company.eu**

For technical support: **support@your-company.eu**

---

**Last Updated:** May 15, 2026  
**Version:** 1.0 (Initial EU Release)
