"""
Simple runner for EvidenceGatherer to be invoked by cron or supervisor in staging/production.

Usage:
    python -m app.tasks.run_evidence_collector

This will perform a single gather_once() run and print the summary.
"""
import os
import sys

from app import create_app

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        from app.utils.evidence_gatherer import EvidenceGatherer
        gatherer = EvidenceGatherer()
        summary = gatherer.gather_once()
        print('Evidence gather summary:')
        print(summary)
