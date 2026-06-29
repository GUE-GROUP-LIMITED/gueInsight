"""
Admin operations and compliance routes for user management, logging, and incident reporting.
Extracted from admin_routes.py to reduce monolith complexity.
"""
import json
import logging
import io
import zipfile
from flask import Blueprint, request, redirect, url_for, send_file, current_app, jsonify
from flask_login import login_required, current_user, logout_user
from datetime import datetime
from werkzeug.security import generate_password_hash
from sqlalchemy import or_

from app.models import (
    User,
    Logs,
    NIS2IncidentReport,
    SecurityEvent,
    DataDeletionRequest,
    Subscription,
    EvidenceArtifact,
    db,
)

# Import helper functions and decorators from parent module
from app.routes import admin_routes as ar


SOC2_CONTROL_BASELINE = [
    {
        'control_id': 'CC1.2',
        'title': 'Board and management oversight',
        'framework_area': 'Control Environment',
        'evidence_hint': 'Policy attestations, management review logs',
        'required_artifact_types': ['policy_attestation', 'management_review'],
    },
    {
        'control_id': 'CC3.2',
        'title': 'Risk identification and analysis',
        'framework_area': 'Risk Assessment',
        'evidence_hint': 'Risk register, incident trend analysis',
        'required_artifact_types': ['risk_register', 'incident_summary'],
    },
    {
        'control_id': 'CC6.1',
        'title': 'Logical and physical access controls',
        'framework_area': 'Logical and Physical Access',
        'evidence_hint': 'Access matrix, provisioning logs',
        'required_artifact_types': ['access_control_matrix', 'access_review'],
    },
    {
        'control_id': 'CC7.2',
        'title': 'Security monitoring and incident response',
        'framework_area': 'System Operations',
        'evidence_hint': 'Security events, triage and response records',
        'required_artifact_types': ['security_event_log', 'incident_summary'],
    },
    {
        'control_id': 'CC8.1',
        'title': 'Change management process',
        'framework_area': 'Change Management',
        'evidence_hint': 'Approved change tickets and deployment logs',
        'required_artifact_types': ['change_log', 'deployment_log'],
    },
    {
        'control_id': 'CC9.2',
        'title': 'Vendor and third-party risk oversight',
        'framework_area': 'Risk Mitigation',
        'evidence_hint': 'Vendor assessments and contract controls',
        'required_artifact_types': ['vendor_assessment', 'vendor_contract_review'],
    },
]


def _parse_json_payload(raw_value, fallback):
    if not raw_value:
        return fallback
    try:
        return json.loads(raw_value)
    except Exception:
        return fallback


def _artifact_extension(artifact):
    payload = artifact.raw_payload or ''
    try:
        json.loads(payload)
        return '.json', 'application/json'
    except Exception:
        if any(token in str(artifact.artifact_type or '') for token in ['csv', 'matrix', 'access_control']):
            return '.csv', 'text/csv'
        return '.txt', 'text/plain'


def _soc2_controls_snapshot(security_events_count, control_counts):
    controls = []
    for control in SOC2_CONTROL_BASELINE:
        required_types = control.get('required_artifact_types', [])
        mapped_count = 0
        for art_type in required_types:
            mapped_count += int(control_counts.get(art_type, 0))

        if control['control_id'] == 'CC7.2':
            mapped_count += int(security_events_count > 0)

        status = 'not_started'
        if mapped_count > 0:
            status = 'partial'
        if mapped_count >= max(1, len(required_types)):
            status = 'implemented'

        controls.append({
            'control_id': control['control_id'],
            'title': control['title'],
            'framework_area': control['framework_area'],
            'status': status,
            'evidence_hint': control['evidence_hint'],
            'required_artifact_types': required_types,
            'evidence_count': mapped_count,
        })
    return controls


def _soc2_control_ids():
    return {item['control_id'] for item in SOC2_CONTROL_BASELINE}


def register_operations_routes(admin_bp):
    """Register admin operational and compliance endpoints to admin blueprint."""
    
    @admin_bp.route('/view_logs')
    @login_required
    def view_logs():
        ar.check_admin_role(current_user)  # Ensure current user is an admin

        logs = Logs.query.all()
        # API endpoint: return logs as JSON
        return {"logs": [l.to_dict() for l in logs]}


    # View user activity logs (Only accessible to admins)
    @admin_bp.route('/view_user_activity/<int:user_id>')
    @login_required
    def view_user_activity(user_id):
        ar.check_admin_role(current_user)  # Ensure current user is an admin

        logs = Logs.query.filter_by(user_id=user_id).all()
        user = User.query.get_or_404(user_id)
        # API endpoint: return user activity as JSON
        return {"logs": [l.to_dict() for l in logs], "user": user.to_dict()}


    # Delete user (Only accessible to admins)
    @admin_bp.route('/delete_user/<int:user_id>', methods=['POST'])
    @login_required
    def delete_user(user_id):
        ar.check_admin_role(current_user)  # Ensure current user is an admin

        user_to_delete = User.query.get_or_404(user_id)
        db.session.delete(user_to_delete)
        db.session.commit()
        from flask import flash
        flash('User deleted successfully!', 'success')
        return redirect(url_for('admin.admin_dashboard'))


    # Edit user (Only accessible to admins)
    @admin_bp.route('/edit_user/<int:user_id>', methods=['GET', 'POST'])
    @login_required
    def edit_user(user_id):
        ar.check_admin_role(current_user)  # Ensure current user is an admin

        user = User.query.get_or_404(user_id)

        if request.method == 'POST':
            user.email = request.form.get('email', user.email)
            user.first_name = request.form.get('first_name', user.first_name)
            user.last_name = request.form.get('last_name', user.last_name)
            user.role = request.form.get('role', user.role)

            new_password = request.form.get('password')
            if new_password:
                user.password = generate_password_hash(new_password)

            db.session.commit()
            from flask import flash
            flash('User updated successfully!', 'success')
            return redirect(url_for('admin.admin_dashboard'))

        # API endpoint: return user as JSON
        return {"user": user.to_dict()}


    # ==== NIS2 Compliance Incident Reporting ====

    @admin_bp.route('/api/incidents/report-nis2', methods=['POST'])
    @login_required
    def report_nis2_incident():
        """
        Report a critical infrastructure incident for NIS2 compliance.
        Required fields: incident_type, severity, affected_systems, initial_detection_at, description
        """
        ar.check_admin_role(current_user)
        data = request.get_json() or {}

        try:
            incident = NIS2IncidentReport(
                user_id=current_user.id,
                incident_type=data.get('incident_type', ''),
                severity=data.get('severity', 'medium'),
                affected_systems=data.get('affected_systems', ''),
                initial_detection_at=datetime.fromisoformat(data.get('initial_detection_at', ar._utc_now().isoformat())),
                description=data.get('description', ''),
                actions_taken=data.get('actions_taken', ''),
                notification_recipient=data.get('notification_recipient', ''),
                status='draft'  # Admin can mark as 'reported' after review
            )
            db.session.add(incident)
            db.session.commit()

            return {
                'status': 'success',
                'message': 'NIS2 incident report created',
                'incident': incident.to_dict()
            }, 201
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 400


    @admin_bp.route('/api/incidents/nis2', methods=['GET'])
    @login_required
    def list_nis2_incidents():
        """List all NIS2 incident reports."""
        ar.check_admin_role(current_user)
        incidents = NIS2IncidentReport.query.all()
        return {
            'status': 'ok',
            'incidents': [i.to_dict() for i in incidents],
            'count': len(incidents)
        }, 200


    @admin_bp.route('/api/incidents/nis2/<int:incident_id>', methods=['GET', 'PATCH'])
    @login_required
    def manage_nis2_incident(incident_id):
        """Get or update a specific NIS2 incident report."""
        ar.check_admin_role(current_user)
        incident = NIS2IncidentReport.query.get_or_404(incident_id)

        if request.method == 'GET':
            return {
                'status': 'ok',
                'incident': incident.to_dict()
            }, 200

        # PATCH: update the incident
        data = request.get_json() or {}
        incident.incident_type = data.get('incident_type', incident.incident_type)
        incident.severity = data.get('severity', incident.severity)
        incident.affected_systems = data.get('affected_systems', incident.affected_systems)
        incident.description = data.get('description', incident.description)
        incident.actions_taken = data.get('actions_taken', incident.actions_taken)
        incident.notification_recipient = data.get('notification_recipient', incident.notification_recipient)
        incident.status = data.get('status', incident.status)

        db.session.commit()
        return {
            'status': 'success',
            'message': 'NIS2 incident report updated',
            'incident': incident.to_dict()
        }, 200


    @admin_bp.route('/api/incidents/nis2/<int:incident_id>/pdf', methods=['GET'])
    @login_required
    def download_nis2_incident_pdf(incident_id):
        """Download NIS2 incident report as PDF for regulator submission."""
        ar.check_admin_role(current_user)
        from app.utils.nis2_report_generator import NIS2ReportGenerator
        from app.utils.evidence_gatherer import EvidenceGatherer

        incident = NIS2IncidentReport.query.get_or_404(incident_id)

        # Prepare incident data with user info
        incident_data = incident.to_dict()
        incident_data['user'] = {
            'email': incident.user.email,
            'company': incident.user.company or 'N/A',
            'first_name': incident.user.first_name,
            'last_name': incident.user.last_name,
        }

        # Generate PDF
        try:
            generator = NIS2ReportGenerator(incident_data)
            pdf_buffer = generator.generate_pdf()

            # Log the PDF download
            security_event = SecurityEvent(
                user_id=current_user.id,
                event_type='nis2_incident_pdf_downloaded',
                severity=incident.severity,
                details=f"NIS2 incident {incident_id} PDF downloaded for submission"
            )
            db.session.add(security_event)
            db.session.commit()

            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'NIS2_Incident_{incident_id}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.pdf'
            )
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Failed to generate PDF: {str(e)}'
            }, 500


    @admin_bp.route('/api/compliance/readiness', methods=['GET'])
    @login_required
    def get_compliance_readiness():
        """
        Return compliance readiness summary for admin dashboard.
        Includes GDPR, NIS2, ISO27001 status based on current deployments.
        """
        ar.check_admin_role(current_user)
        from app.subscription_service import get_tier_info
        import os

        active_subscriptions = Subscription.query.filter(
            Subscription.end_date > ar._utc_now()
        ).all()

        nis2_incidents = NIS2IncidentReport.query.filter_by(status='reported').all()
        security_events_count = SecurityEvent.query.count()
        data_exports = DataDeletionRequest.query.count()
        soc2_evidence_runs = SecurityEvent.query.filter_by(event_type='evidence_gather_run').count()
        soc2_access_matrix_runs = SecurityEvent.query.filter_by(event_type='access_matrix_generated').count()

        # Assess tier distribution
        tier_distribution = {}
        for sub in active_subscriptions:
            tier = sub.plan
            tier_distribution[tier] = tier_distribution.get(tier, 0) + 1

        tier_compliance = {}
        for tier in tier_distribution.keys():
            tier_info = get_tier_info(tier)
            if tier_info:
                tier_compliance[tier] = {
                    'users': tier_distribution[tier],
                    'gdpr_ready': tier_info.get('gdpr_ready', False),
                    'nis2_ready': tier_info.get('nis2_ready', False)
                }

        return {
            'status': 'ok',
            'compliance_overview': {
                'gdpr': {
                    'status': 'compliant' if security_events_count > 0 else 'configured',
                    'export_requests': DataDeletionRequest.query.count(),
                    'deletion_requests': DataDeletionRequest.query.count(),
                    'audit_events': security_events_count
                },
                'nis2': {
                    'status': 'active' if nis2_incidents else 'configured',
                    'incident_reports': len(nis2_incidents),
                    'critical_incidents': len([i for i in nis2_incidents if i.severity == 'critical']),
                    'high_incidents': len([i for i in nis2_incidents if i.severity == 'high'])
                },
                'iso27001': {
                    'status': 'in_progress',
                    'audit_trail_events': security_events_count,
                    'access_logs': len(active_subscriptions)
                },
                'soc2': {
                    'status': 'active' if (soc2_evidence_runs > 0 and soc2_access_matrix_runs > 0) else 'in_progress',
                    'evidence_gather_runs': soc2_evidence_runs,
                    'access_matrix_runs': soc2_access_matrix_runs,
                    'security_events': security_events_count,
                    'controls_coverage': min(100, 30 + (soc2_evidence_runs * 20) + (soc2_access_matrix_runs * 20))
                }
            },
            'tier_distribution': tier_compliance,
            'deployment_info': {
                'eu_residency_enforced': os.getenv('EU_ONLY_DATA_RESIDENCY', 'false').lower() in {'1', 'true', 'yes'},
                'preferred_region': os.getenv('PREFERRED_DATA_REGION', 'eu-west-1')
            }
        }, 200


    # Evidence gatherer endpoint for ISO27001 automation
    @admin_bp.route('/admin/evidence/gather', methods=['POST'])
    @login_required
    def trigger_evidence_gather():
        """Trigger a one-off evidence collection run (M365/GWS) and persist artifacts."""
        ar.check_admin_role(current_user)
        from app.utils.evidence_gatherer import EvidenceGatherer
        
        gatherer = EvidenceGatherer(current_user=current_user)
        summary = gatherer.gather_once()

        # Log a security event for traceability
        event = SecurityEvent(
            user_id=current_user.id,
            event_type='evidence_gather_run',
            severity='info',
            details=f"Evidence gather run: m365_artifacts={summary['m365']['artifacts']}, gws_artifacts={summary['gws']['artifacts']}"
        )
        db.session.add(event)
        db.session.commit()

        return {'status': 'ok', 'summary': summary}, 200


    @admin_bp.route('/admin/evidence/generate-access-matrix', methods=['POST'])
    @login_required
    def generate_access_matrix():
        """Generate access control matrix and persist as EvidenceArtifact."""
        ar.check_admin_role(current_user)
        from app.utils.access_control import generate_access_control_matrix
        
        try:
            result = generate_access_control_matrix()
            # Log event
            event = SecurityEvent(
                user_id=current_user.id,
                event_type='access_matrix_generated',
                severity='info',
                details=f"Access control matrix generated: artifact_id={result.get('artifact_id')}, rows={result.get('rows')}"
            )
            db.session.add(event)
            db.session.commit()
            return {'status': 'ok', 'result': result}, 200
        except Exception as e:
            current_app.logger.exception('Failed to generate access control matrix')
            return {'status': 'error', 'message': str(e)}, 500


    @admin_bp.route('/admin/export/evidence', methods=['GET'])
    @login_required
    def export_evidence():
        """Export evidence artifacts as a ZIP. Query params: since (ISO8601), type (artifact_type)"""
        ar.check_admin_role(current_user)
        since = request.args.get('since')
        artifact_type = request.args.get('type')

        query = EvidenceArtifact.query
        if since:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(since)
                query = query.filter(EvidenceArtifact.collected_at >= dt)
            except Exception:
                pass
        if artifact_type:
            query = query.filter_by(artifact_type=artifact_type)

        artifacts = query.order_by(EvidenceArtifact.collected_at.desc()).all()

        mem = io.BytesIO()
        with zipfile.ZipFile(mem, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            for art in artifacts:
                filename = f"artifact_{art.id}_{art.source}_{art.artifact_type}"
                # choose extension
                ext = '.json'
                content = art.raw_payload or ''
                try:
                    json.loads(content)
                    ext = '.json'
                except Exception:
                    # not JSON, might be CSV
                    if any(x in art.artifact_type for x in ['csv', 'matrix', 'access_control']):
                        ext = '.csv'
                    else:
                        ext = '.txt'

                zf.writestr(filename + ext, content)

        mem.seek(0)
        return send_file(mem, mimetype='application/zip', as_attachment=True, download_name='evidence_export.zip')


    @admin_bp.route('/api/compliance/soc2/control-map', methods=['GET'])
    @login_required
    def soc2_control_map():
        """Return SOC2 control baseline status mapped to available evidence."""
        ar.check_admin_role(current_user)

        security_events_count = SecurityEvent.query.count()
        artifacts = EvidenceArtifact.query.all()
        control_counts = {}
        for artifact in artifacts:
            key = str(artifact.artifact_type or '').strip()
            if not key:
                continue
            control_counts[key] = control_counts.get(key, 0) + 1

        controls = _soc2_controls_snapshot(security_events_count, control_counts)
        implemented = len([item for item in controls if item['status'] == 'implemented'])
        partial = len([item for item in controls if item['status'] == 'partial'])

        return {
            'status': 'ok',
            'framework': 'SOC2',
            'controls': controls,
            'summary': {
                'implemented': implemented,
                'partial': partial,
                'not_started': len(controls) - implemented - partial,
                'total': len(controls),
            },
        }, 200


    @admin_bp.route('/api/evidence/artifacts', methods=['GET'])
    @login_required
    def list_evidence_artifacts():
        """List evidence artifacts with optional filters: source, type, limit."""
        ar.check_admin_role(current_user)
        source = (request.args.get('source') or '').strip().lower()
        artifact_type = (request.args.get('type') or '').strip().lower()
        control_id = (request.args.get('control') or '').strip().upper()
        search = (request.args.get('search') or '').strip()
        page = max(1, int(request.args.get('page') or 1))
        limit = min(200, max(1, int(request.args.get('limit') or 50)))

        query = EvidenceArtifact.query
        if source:
            query = query.filter_by(source=source)
        if artifact_type:
            query = query.filter_by(artifact_type=artifact_type)
        if control_id:
            query = query.filter(EvidenceArtifact.control_mappings.ilike(f'%{control_id}%'))
        if search:
            pattern = f'%{search}%'
            query = query.filter(or_(
                EvidenceArtifact.source.ilike(pattern),
                EvidenceArtifact.artifact_type.ilike(pattern),
                EvidenceArtifact.control_mappings.ilike(pattern),
                EvidenceArtifact.indexed_fields.ilike(pattern),
            ))

        total = query.count()
        total_pages = max(1, (total + limit - 1) // limit)
        if page > total_pages:
            page = total_pages

        artifacts = query.order_by(EvidenceArtifact.collected_at.desc()).offset((page - 1) * limit).limit(limit).all()
        items = []
        for artifact in artifacts:
            indexed_fields = _parse_json_payload(artifact.indexed_fields, {})
            control_mappings = _parse_json_payload(artifact.control_mappings, [])
            if isinstance(control_mappings, str):
                control_mappings = [control_mappings]

            item = artifact.to_dict()
            item['indexed_fields'] = indexed_fields
            item['control_mappings'] = control_mappings if isinstance(control_mappings, list) else []
            item['download_url'] = f"/api/evidence/artifacts/{artifact.id}/download"
            items.append(item)

        available_sources = [
            row[0] for row in db.session.query(EvidenceArtifact.source).distinct().all() if row[0]
        ]
        available_types = [
            row[0] for row in db.session.query(EvidenceArtifact.artifact_type).distinct().all() if row[0]
        ]
        available_sources = sorted({str(value).strip() for value in available_sources if str(value).strip()})
        available_types = sorted({str(value).strip() for value in available_types if str(value).strip()})

        return {
            'status': 'ok',
            'count': len(items),
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': total_pages,
            'artifacts': items,
            'available_sources': available_sources,
            'available_types': available_types,
        }, 200


    @admin_bp.route('/api/evidence/artifacts/controls/bulk', methods=['PATCH'])
    @login_required
    def bulk_update_evidence_artifact_controls():
        """Bulk update SOC2 control mappings for evidence artifacts."""
        ar.check_admin_role(current_user)
        payload = request.get_json(silent=True) or {}
        artifact_ids = payload.get('artifact_ids') or []
        controls = payload.get('controls') or []
        mode = str(payload.get('mode') or 'replace').strip().lower()

        if isinstance(artifact_ids, str):
            artifact_ids = [token.strip() for token in artifact_ids.split(',') if token.strip()]
        if not isinstance(artifact_ids, list) or not artifact_ids:
            return {'status': 'error', 'message': 'artifact_ids must be a non-empty list'}, 400

        normalized_ids = []
        for item in artifact_ids:
            try:
                value = int(item)
            except Exception:
                return {'status': 'error', 'message': f'invalid artifact id: {item}'}, 400
            if value not in normalized_ids:
                normalized_ids.append(value)

        if len(normalized_ids) > 200:
            return {'status': 'error', 'message': 'artifact_ids cannot exceed 200 entries'}, 400

        if isinstance(controls, str):
            controls = [item.strip() for item in controls.split(',') if item.strip()]
        if not isinstance(controls, list):
            return {'status': 'error', 'message': 'controls must be a list of SOC2 control IDs'}, 400

        normalized_controls = []
        for item in controls:
            token = str(item or '').strip().upper()
            if token and token not in normalized_controls:
                normalized_controls.append(token)

        if mode not in {'replace', 'add', 'remove'}:
            return {'status': 'error', 'message': 'mode must be one of: replace, add, remove'}, 400

        valid_controls = _soc2_control_ids()
        invalid = [item for item in normalized_controls if item not in valid_controls]
        if invalid:
            return {
                'status': 'error',
                'message': f"invalid SOC2 controls: {', '.join(invalid)}",
                'allowed_controls': sorted(valid_controls),
            }, 400

        artifacts = EvidenceArtifact.query.filter(EvidenceArtifact.id.in_(normalized_ids)).all()
        if not artifacts:
            return {'status': 'error', 'message': 'no evidence artifacts found for provided ids'}, 404

        updated = []
        for artifact in artifacts:
            existing = _parse_json_payload(artifact.control_mappings, [])
            if isinstance(existing, str):
                existing = [existing]
            if not isinstance(existing, list):
                existing = []

            existing = [str(item or '').strip().upper() for item in existing if str(item or '').strip()]

            if mode == 'replace':
                merged = normalized_controls
            elif mode == 'add':
                merged = existing[:]
                for control in normalized_controls:
                    if control not in merged:
                        merged.append(control)
            else:
                merged = [control for control in existing if control not in normalized_controls]

            artifact.control_mappings = json.dumps(merged)
            db.session.add(artifact)
            updated.append({'id': artifact.id, 'control_mappings': merged})

        event = SecurityEvent(
            user_id=current_user.id,
            event_type='soc2_artifact_controls_bulk_updated',
            severity='info',
            details=f'Bulk SOC2 mapping update: artifacts={len(updated)}, mode={mode}',
        )
        db.session.add(event)
        db.session.commit()

        return {
            'status': 'ok',
            'updated_count': len(updated),
            'updated': updated,
        }, 200


    @admin_bp.route('/api/evidence/artifacts/<int:artifact_id>/controls', methods=['PATCH'])
    @login_required
    def update_evidence_artifact_controls(artifact_id):
        """Update SOC2 control mappings for a single evidence artifact."""
        ar.check_admin_role(current_user)
        artifact = EvidenceArtifact.query.get_or_404(artifact_id)
        payload = request.get_json(silent=True) or {}
        controls = payload.get('controls') or []

        if isinstance(controls, str):
            controls = [item.strip() for item in controls.split(',') if item.strip()]
        if not isinstance(controls, list):
            return {'status': 'error', 'message': 'controls must be a list of SOC2 control IDs'}, 400

        normalized = []
        for item in controls:
            token = str(item or '').strip().upper()
            if token and token not in normalized:
                normalized.append(token)

        valid_controls = _soc2_control_ids()
        invalid = [item for item in normalized if item not in valid_controls]
        if invalid:
            return {
                'status': 'error',
                'message': f"invalid SOC2 controls: {', '.join(invalid)}",
                'allowed_controls': sorted(valid_controls),
            }, 400

        artifact.control_mappings = json.dumps(normalized)
        db.session.add(artifact)

        event = SecurityEvent(
            user_id=current_user.id,
            event_type='soc2_artifact_controls_updated',
            severity='info',
            details=f'Updated SOC2 control mappings for artifact {artifact.id}: {", ".join(normalized) if normalized else "none"}',
        )
        db.session.add(event)
        db.session.commit()

        return {
            'status': 'ok',
            'artifact': {
                'id': artifact.id,
                'control_mappings': normalized,
            },
        }, 200


    @admin_bp.route('/api/evidence/artifacts/<int:artifact_id>/download', methods=['GET'])
    @login_required
    def download_evidence_artifact(artifact_id):
        """Download a single evidence artifact payload."""
        ar.check_admin_role(current_user)
        artifact = EvidenceArtifact.query.get_or_404(artifact_id)

        ext, mime_type = _artifact_extension(artifact)
        body = io.BytesIO((artifact.raw_payload or '').encode('utf-8'))
        body.seek(0)
        filename = f"artifact_{artifact.id}_{artifact.source}_{artifact.artifact_type}{ext}"
        return send_file(body, mimetype=mime_type, as_attachment=True, download_name=filename)


    @admin_bp.route('/api/compliance/soc2/audit-packet', methods=['GET'])
    @login_required
    def export_soc2_audit_packet():
        """Export a SOC2 audit packet ZIP containing control snapshot and evidence payloads."""
        ar.check_admin_role(current_user)

        artifacts = EvidenceArtifact.query.order_by(EvidenceArtifact.collected_at.desc()).all()
        security_events_count = SecurityEvent.query.count()

        control_counts = {}
        for artifact in artifacts:
            key = str(artifact.artifact_type or '').strip()
            if not key:
                continue
            control_counts[key] = control_counts.get(key, 0) + 1

        controls = _soc2_controls_snapshot(security_events_count, control_counts)
        generated_at = ar._utc_now().isoformat()

        manifest = {
            'generated_at': generated_at,
            'framework': 'SOC2',
            'generated_by_user_id': current_user.id,
            'artifact_count': len(artifacts),
            'controls_total': len(controls),
        }

        mem = io.BytesIO()
        with zipfile.ZipFile(mem, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('manifest.json', json.dumps(manifest, indent=2))
            zf.writestr('soc2_control_map.json', json.dumps({'controls': controls}, indent=2))

            artifact_index = []
            for artifact in artifacts:
                ext, _ = _artifact_extension(artifact)
                filename = f"artifacts/artifact_{artifact.id}_{artifact.source}_{artifact.artifact_type}{ext}"
                zf.writestr(filename, artifact.raw_payload or '')
                artifact_index.append({
                    'id': artifact.id,
                    'source': artifact.source,
                    'artifact_type': artifact.artifact_type,
                    'collected_at': artifact.collected_at.isoformat() if artifact.collected_at else None,
                    'file': filename,
                })

            zf.writestr('artifact_index.json', json.dumps({'artifacts': artifact_index}, indent=2))

        mem.seek(0)
        stamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        return send_file(
            mem,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'soc2_audit_packet_{stamp}.zip',
        )
