"""
Evidence Gatherer

Minimal implementation to pull audit logs and user/group data from connectors
and persist as EvidenceArtifact records for ISO27001 evidence collection.

This is intentionally lightweight: in production use a background worker (Celery)
and robust pagination, retries, and rate-limit handling.
"""
import json
import traceback
import time
from datetime import datetime
from typing import Dict, Callable

from app.integrations.microsoft365 import create_m365_connector
from app.integrations.googleworkspace import create_gws_connector
from app.models import EvidenceArtifact, db


def retry(func: Callable, retries: int = 3, backoff: float = 0.5, exceptions=(Exception,)):
    last_exc = None
    for attempt in range(retries):
        try:
            return func()
        except exceptions as e:
            last_exc = e
            time.sleep(backoff * (2 ** attempt))
    raise last_exc


class EvidenceGatherer:
    def __init__(self, current_user=None):
        self.current_user = current_user

    def _persist_artifact(self, source: str, artifact_type: str, payload: Dict):
        try:
            raw = json.dumps(payload)
        except Exception:
            raw = str(payload)

        artifact = EvidenceArtifact(
            source=source,
            artifact_type=artifact_type,
            raw_payload=raw,
            indexed_fields=None,
            control_mappings=None,
            processed=False,
            collected_at=datetime.utcnow(),
        )
        db.session.add(artifact)
        db.session.commit()
        return artifact.id

    def gather_once(self) -> Dict:
        """Perform a single collection cycle from available connectors.

        Returns a summary dict with counts and errors.
        """
        summary = {
            'm365': {'artifacts': 0, 'errors': []},
            'gws': {'artifacts': 0, 'errors': []},
            'timestamp': datetime.utcnow().isoformat(),
        }

        # Microsoft 365 (with retries)
        try:
            m365 = create_m365_connector()
            if m365 and retry(lambda: m365.authenticate(), retries=3, backoff=1):
                users = retry(lambda: m365.get_users(limit=500), retries=3, backoff=1)
                if isinstance(users, dict):
                    _id = self._persist_artifact('m365', 'users_list', users)
                    summary['m365']['artifacts'] += 1

                groups = retry(lambda: m365.get_groups(limit=500), retries=3, backoff=1)
                if isinstance(groups, dict):
                    _id = self._persist_artifact('m365', 'groups_list', groups)
                    summary['m365']['artifacts'] += 1

                audit = retry(lambda: m365.get_audit_logs(limit=1000), retries=3, backoff=1)
                if isinstance(audit, dict):
                    _id = self._persist_artifact('m365', 'audit_logs', audit)
                    summary['m365']['artifacts'] += 1
            else:
                summary['m365']['errors'].append('m365 authentication failed or connector not configured')
        except Exception as e:
            summary['m365']['errors'].append(str(e))
            summary['m365']['errors'].append(traceback.format_exc())

        # Google Workspace
        # Google Workspace (with retries)
        try:
            import os as _os

            gws = create_gws_connector()
            if gws and retry(lambda: gws.authenticate(subject=_os.getenv('GWS_ADMIN_SUBJECT', 'admin@domain.com')), retries=3, backoff=1):
                users = retry(lambda: gws.get_users(limit=500), retries=3, backoff=1)
                if isinstance(users, dict):
                    _id = self._persist_artifact('gws', 'users_list', users)
                    summary['gws']['artifacts'] += 1

                groups = retry(lambda: gws.get_groups(limit=500), retries=3, backoff=1)
                if isinstance(groups, dict):
                    _id = self._persist_artifact('gws', 'groups_list', groups)
                    summary['gws']['artifacts'] += 1

                devices = retry(lambda: gws.get_mobile_devices(), retries=3, backoff=1)
                if isinstance(devices, dict):
                    _id = self._persist_artifact('gws', 'mobile_devices', devices)
                    summary['gws']['artifacts'] += 1
            else:
                summary['gws']['errors'].append('gws authentication failed or connector not configured')
        except Exception as e:
            summary['gws']['errors'].append(str(e))
            summary['gws']['errors'].append(traceback.format_exc())

        return summary
