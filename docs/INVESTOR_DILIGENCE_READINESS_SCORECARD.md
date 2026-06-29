# Investor Diligence Readiness Scorecard

## Scope

This scorecard maps common software and cybersecurity investor diligence criteria to operational evidence in GueInsight.

## 1. Security and AI Tailwinds

Status: Meets

Evidence:

- AI-enabled detection and scoring workflows in product architecture and messaging.
- Compliance-first security platform positioning.

## 2. Credible AI Strategy

Status: Meets with active controls

Evidence:

- Governance framework: `docs/AI_STRATEGY_GOVERNANCE_FRAMEWORK.md`.
- Model registry: `ops/ai/model_registry.json`.
- Benchmark gates: `ops/ai/benchmarks.json`.
- Drift baseline and thresholds: `ops/ai/drift_baseline.json`.
- Automated governance report script: `scripts/generate_ai_governance_report.py`.

## 3. Vertical SaaS Positioning

Status: Meets

Evidence:

- NIS2/GDPR-focused workflow ownership and compliance deliverables.
- Sector-focused packages and tiering with compliance and incident operations.

## 4. Compliance as an Asset

Status: Meets

Evidence:

- GDPR export/deletion workflows
- NIS2 incident reporting
- SOC2 readiness and evidence artifact mapping
- EU data residency controls

## 5. Independence from Founder

Status: Partial

Current risk:

- Premium messaging remains tied to founder-led vCISO delivery.

Required operational controls:

- assign named non-founder operational owners for delivery and support
- publish standard operating procedures and escalation matrix
- add service coverage SLA independent of founder availability

## 6. Operational Quality

Status: Partial

Evidence:

- deployment and release process documentation present
- security and compliance workflows present

Required improvements:

- increase low-coverage modules to target threshold
- strengthen webhook and billing reliability test depth
- maintain quarterly resilience drills and restore tests

## 7. Financial Quality and Profitability Proof

Status: Gap

Required artifacts:

- trailing 12-month KPI pack
- audited or finance-reviewed EBITDA bridge
- retention, gross margin, and expansion metrics by segment

## 90-Day Action Plan

- Month 1:
  - operationalize governance reporting in release cadence
  - publish founder-independence operating model and backup coverage
- Month 2:
  - improve reliability test coverage and incident runbooks
  - launch monthly AI governance review memo
- Month 3:
  - produce finance and retention KPI pack for diligence room

## Governance Owners

- Product and AI governance: Head of Product
- Security model risk: Security Detection Lead
- Compliance evidence and controls: Compliance Lead
- Service reliability and release quality: Engineering Manager
- Diligence finance metrics: Finance Owner
