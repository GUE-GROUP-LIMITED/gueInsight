# AI Strategy and Governance Framework

## Purpose

This document defines how GueInsight runs AI-enabled security workflows with governance, measurable quality, and safety controls suitable for enterprise diligence.

## Strategic AI Positioning

- AI is embedded in core workflows: IoC extraction, suspicious pattern detection, threat scoring, and alert prioritization.
- AI is used in a hybrid architecture (rules + NLP + enrichment) to improve explainability and reduce uncontrolled model risk.
- Product differentiation is tied to security and compliance outcomes, not generic chatbot features.

## Model Governance Operating Model

- Registry source of truth: `ops/ai/model_registry.json`.
- Every model/pipeline has:
  - owner
  - version
  - rollback version
  - criticality classification
- Any production model update must include:
  - benchmark results against release gates
  - risk review
  - rollback procedure
  - change log entry

## Evaluation Benchmarks

- Benchmark thresholds are defined in `ops/ai/benchmarks.json`.
- Required metrics:
  - IoC precision and recall
  - threat scoring AUC
  - false-positive rate
  - critical false-negative rate
  - p95 analysis latency
- Release rule:
  - all thresholds must pass
  - security signoff required
  - compliance signoff required

## Drift Monitoring

- Baselines and thresholds are defined in `ops/ai/drift_baseline.json`.
- Drift is monitored on:
  - source mix
  - IoC type mix
  - severity mix
- Escalation policy:
  - warning threshold: create investigation ticket
  - critical threshold: freeze model promotion and trigger rollback review

## AI Safety Controls

- Input safety:
  - strict file type and size constraints
  - request validation
  - role-based access for privileged actions
- Output safety:
  - bounded threat scores and explicit confidence context
  - explainable score breakdown for analyst review
  - no autonomous destructive actions
- Data safety:
  - audit logging for security and compliance actions
  - GDPR and NIS2 workflow support
  - EU data residency controls for eligible tiers

## Human-in-the-Loop Policy

- High-severity and critical decisions require analyst confirmation before external notification or compliance submission.
- Risk exceptions must be approved by Security Detection Lead and Compliance Lead.

## Evidence and Reporting Cadence

- Weekly:
  - benchmark snapshot
  - drift snapshot
  - false-positive/false-negative review
- Monthly:
  - governance review and policy exceptions
  - model registry attestation
- Quarterly:
  - red-team style validation of AI-assisted detections

## Execution Tooling

- Governance report generator: `scripts/generate_ai_governance_report.py`.
- Generated report artifact: `docs/AI_GOVERNANCE_STATUS.md`.

## Diligence Readiness Outcome

This framework establishes evidence for:

- credible AI strategy
- model governance
- benchmark discipline
- drift monitoring
- AI safety controls
