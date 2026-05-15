"""
Access Control Matrix generator

Generates a CSV mapping principals (users) to groups/resources using
Microsoft365 and Google Workspace connectors and persists as an EvidenceArtifact.
"""
import csv
import io
import json
from datetime import datetime

from app.integrations.microsoft365 import create_m365_connector
from app.integrations.googleworkspace import create_gws_connector
from app.models import EvidenceArtifact, db


def generate_access_control_matrix():
    """Fetch users and groups from M365/GWS and build an access control CSV.

    Returns a dict summary with artifact id and filename.
    """
    rows = []

    # Header
    header = ["source", "principal_email", "group_id", "group_displayName", "role"]
    rows.append(header)

    # Microsoft 365
    try:
        m365 = create_m365_connector()
        if m365 and m365.authenticate():
            users_resp = m365.get_users(limit=200)
            groups_resp = m365.get_groups(limit=200)

            users = {}
            for u in (users_resp.get('value') or []):
                users[u.get('id')] = u

            for g in (groups_resp.get('value') or []):
                group_id = g.get('id')
                display = g.get('displayName') or g.get('mailNickname') or ''
                # Try to fetch members
                try:
                    members_resp = m365.get_group_members(group_id, limit=500)
                except Exception:
                    members_resp = None

                members = (members_resp.get('value') if isinstance(members_resp, dict) else []) or []
                if members:
                    for m in members:
                        principal = m.get('mail') or m.get('userPrincipalName') or m.get('id')
                        rows.append(['m365', principal or '', group_id or '', display, m.get('@odata.type') or 'member'])
                else:
                    rows.append(['m365', '', group_id or '', display, ''])

    except Exception:
        pass

    # Google Workspace
    try:
        gws = create_gws_connector()
        if gws and gws.authenticate(subject='admin@domain.com'):
            users_resp = gws.get_users(limit=200) or {}
            groups_resp = gws.get_groups(limit=200) or {}

            for g in (groups_resp.get('groups') or groups_resp.get('value') or []):
                rows.append(['gws', '', g.get('id') or '', g.get('name') or g.get('email') or '', ''])
    except Exception:
        pass

    # Render CSV to text
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerows(rows)
    csv_text = buffer.getvalue()

    # Persist as EvidenceArtifact
    artifact = EvidenceArtifact(
        source='access_control_generator',
        artifact_type='access_control_matrix',
        raw_payload=csv_text,
        indexed_fields=json.dumps({'rows': len(rows)-1}),
        control_mappings=None,
        processed=False,
        collected_at=datetime.utcnow(),
    )
    db.session.add(artifact)
    db.session.commit()

    return {'artifact_id': artifact.id, 'rows': len(rows)-1}
