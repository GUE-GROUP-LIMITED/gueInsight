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
