#!/usr/bin/env python3
"""Generate a simple AI governance status report from governance artifacts."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_REGISTRY_PATH = ROOT / "ops" / "ai" / "model_registry.json"
BENCHMARKS_PATH = ROOT / "ops" / "ai" / "benchmarks.json"
DRIFT_BASELINE_PATH = ROOT / "ops" / "ai" / "drift_baseline.json"
OUTPUT_PATH = ROOT / "docs" / "AI_GOVERNANCE_STATUS.md"


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing required artifact: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _validate_registry(data: dict) -> tuple[bool, list[str]]:
    issues: list[str] = []
    models = data.get("models") or []
    if not models:
        issues.append("No models defined in registry")
        return False, issues

    for model in models:
        for field in ("name", "current_version", "rollback_version", "criticality"):
            if not model.get(field):
                issues.append(f"Model '{model.get('name', 'unknown')}' missing field: {field}")
    return len(issues) == 0, issues


def _validate_benchmarks(data: dict) -> tuple[bool, list[str]]:
    issues: list[str] = []
    metrics = data.get("metrics") or {}
    required = [
        "ioc_precision_min",
        "ioc_recall_min",
        "threat_scoring_auc_min",
        "false_positive_rate_max",
        "critical_false_negative_rate_max",
        "p95_analysis_latency_ms_max",
    ]
    for key in required:
        if key not in metrics:
            issues.append(f"Missing benchmark metric: {key}")
    return len(issues) == 0, issues


def _validate_drift(data: dict) -> tuple[bool, list[str]]:
    issues: list[str] = []
    baselines = data.get("baselines") or {}
    thresholds = data.get("drift_thresholds") or {}
    for key in ("source_distribution", "ioc_type_distribution", "alert_severity_distribution"):
        if key not in baselines:
            issues.append(f"Missing drift baseline: {key}")
    for key in ("psi_warning", "psi_critical", "distribution_delta_warning", "distribution_delta_critical"):
        if key not in thresholds:
            issues.append(f"Missing drift threshold: {key}")
    return len(issues) == 0, issues


def main() -> int:
    registry = _load_json(MODEL_REGISTRY_PATH)
    benchmarks = _load_json(BENCHMARKS_PATH)
    drift = _load_json(DRIFT_BASELINE_PATH)

    checks = []

    registry_ok, registry_issues = _validate_registry(registry)
    checks.append(("Model registry integrity", registry_ok, registry_issues))

    benchmarks_ok, benchmark_issues = _validate_benchmarks(benchmarks)
    checks.append(("Benchmark gate definitions", benchmarks_ok, benchmark_issues))

    drift_ok, drift_issues = _validate_drift(drift)
    checks.append(("Drift baseline definitions", drift_ok, drift_issues))

    overall_ok = all(item[1] for item in checks)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        "# AI Governance Status",
        "",
        f"Generated: {timestamp}",
        f"Overall status: {'PASS' if overall_ok else 'FAIL'}",
        "",
        "## Checks",
        "",
    ]

    for name, ok, issues in checks:
        lines.append(f"- {name}: {'PASS' if ok else 'FAIL'}")
        for issue in issues:
            lines.append(f"  - {issue}")

    lines.extend([
        "",
        "## Source Artifacts",
        "",
        f"- {MODEL_REGISTRY_PATH.relative_to(ROOT)}",
        f"- {BENCHMARKS_PATH.relative_to(ROOT)}",
        f"- {DRIFT_BASELINE_PATH.relative_to(ROOT)}",
    ])

    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Overall status: {'PASS' if overall_ok else 'FAIL'}")
    return 0 if overall_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
