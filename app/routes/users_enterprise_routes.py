"""
Enterprise features routes: sub-user management, batch processing, advanced analytics, and real-time alerts.
Extracted module for scalability and team collaboration.
"""
import json
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_

from app.models import (
    db,
    User,
    SubUser,
    Subscription,
    BatchFileJob,
    BatchFileItem,
    AnalysisTransaction,
    AnalyticsMetric,
    AlertProcessingLog,
    Alert,
    AlertRule,
    SecurityToolIntegration,
    AnalysisStatus,
    DataExportRequest,
    DataDeletionRequest,
    SecurityEvent,
    NIS2IncidentReport,
    VcisoUpdate,
)
from app.subscription_service import COMPLIANCE_TIERS
from app.security import encrypt_sensitive_value, decrypt_sensitive_value

logger = logging.getLogger(__name__)


def register_enterprise_routes(users_bp):
    """Register enterprise feature endpoints to user blueprint."""

    def _get_latest_subscription(user_id):
        return (
            Subscription.query
            .filter_by(user_id=user_id)
            .order_by(Subscription.end_date.desc())
            .first()
        )

    def _is_subscription_active(subscription):
        if not subscription:
            return False
        if subscription.end_date is None:
            return True
        return subscription.end_date >= datetime.utcnow()

    def _normalize_plan(plan_like):
        value = str(plan_like or 'free').strip().lower()
        legacy_map = {
            'premium_individual': 'compliance_pro',
            'premium_small_business': 'enterprise_risk',
            'premium_large_business': 'enterprise_elite',
            'premium': 'compliance_pro',
            'freemium': 'free',
        }
        return legacy_map.get(value, value if value in COMPLIANCE_TIERS else 'free')

    def _get_user_plan(user_id):
        latest = _get_latest_subscription(user_id)
        if not _is_subscription_active(latest):
            return 'free'
        return _normalize_plan(getattr(latest, 'plan', None)) if latest else 'free'

    def _plan_access(plan_key):
        if plan_key in ['enterprise_professional', 'enterprise_risk', 'enterprise_elite']:
            return 'enterprise'
        if plan_key == 'compliance_pro':
            return 'compliance'
        return 'free'

    def _require_plan(access_level):
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)
        if access_level == 'enterprise' and tier != 'enterprise':
            return None, None, jsonify({'error': 'Enterprise plan required'}), 403
        if access_level == 'compliance' and tier == 'free':
            return None, None, jsonify({'error': 'Compliance plan required'}), 403
        return plan_key, tier, None, None

    def _safe_json_load(value, fallback=None):
        if not value:
            return {} if fallback is None else fallback
        try:
            return json.loads(value)
        except Exception:
            return {} if fallback is None else fallback

    def _latest_compliance_intake(user_id):
        return (
            SecurityEvent.query
            .filter_by(user_id=user_id, event_type='compliance.intake.submitted')
            .order_by(SecurityEvent.created_at.desc())
            .first()
        )

    def _compute_compliance_score(payload):
        controls = payload.get('controls') or []
        incidents = payload.get('incidents') or []

        required_controls = max(1, len(controls))
        implemented = sum(1 for c in controls if str((c or {}).get('status', '')).lower() in {'implemented', 'done', 'effective'})
        evidenced = sum(
            1
            for c in controls
            if str((c or {}).get('status', '')).lower() in {'implemented', 'done', 'effective'} and (c or {}).get('evidence_url')
        )

        coverage_score = round((implemented / required_controls) * 100)
        evidence_score = round((evidenced / max(1, implemented)) * 100)

        reportable = [
            inc for inc in incidents
            if str((inc or {}).get('classification', '')).lower() == 'nis2_reportable'
            or str((inc or {}).get('severity', '')).lower() in {'critical', 'high'}
        ]
        sla_ok = [
            inc for inc in reportable
            if bool((inc or {}).get('reported_24h')) and bool((inc or {}).get('reported_72h'))
        ]
        incident_response_score = round((len(sla_ok) / max(1, len(reportable))) * 100)

        overall = round((0.5 * coverage_score) + (0.3 * evidence_score) + (0.2 * incident_response_score))

        return {
            'coverage_score': coverage_score,
            'evidence_score': evidence_score,
            'incident_response_score': incident_response_score,
            'overall_score': overall,
            'details': {
                'required_controls': required_controls,
                'implemented_controls': implemented,
                'controls_with_evidence': evidenced,
                'reportable_incidents': len(reportable),
                'incidents_with_sla_met': len(sla_ok),
            },
        }
    
    # ===== SUB-USER MANAGEMENT (Enterprise Plans) =====
    
    @users_bp.route('/auth/sub-users', methods=['GET'])
    @login_required
    def list_sub_users():
        """Get all sub-users for current user (enterprise only)."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code
        
        sub_users = SubUser.query.filter_by(
            parent_user_id=current_user.id,
            is_active=True
        ).all()
        
        return jsonify({
            'sub_users': [su.to_dict() for su in sub_users],
            'total': len(sub_users)
        }), 200
    
    
    @users_bp.route('/auth/sub-users', methods=['POST'])
    @login_required
    def add_sub_user():
        """Add a new sub-user to enterprise account."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code
        
        data = request.get_json() or {}
        email = data.get('email')
        role = data.get('role', 'analyst')  # analyst, manager, admin
        permissions = data.get('permissions', '')  # comma-separated
        
        if not email:
            return jsonify({'error': 'Email required'}), 400
        
        # Check if user exists
        sub_user = User.query.filter_by(email=email).first()
        if not sub_user:
            return jsonify({'error': f'User {email} not found'}), 404
        
        # Check if already a sub-user
        existing = SubUser.query.filter_by(
            parent_user_id=current_user.id,
            sub_user_id=sub_user.id
        ).first()
        
        if existing:
            if existing.is_active:
                return jsonify({'error': 'User already added'}), 409
            else:
                # Reactivate if previously deactivated
                existing.is_active = True
                existing.removed_at = None
                db.session.commit()
                return jsonify(existing.to_dict()), 200
        
        # Create new sub-user relationship
        new_sub_user = SubUser(
            parent_user_id=current_user.id,
            sub_user_id=sub_user.id,
            role=role,
            permissions=permissions
        )
        
        db.session.add(new_sub_user)
        db.session.commit()
        
        logger.info(f"Sub-user {email} added to {current_user.email}")
        return jsonify(new_sub_user.to_dict()), 201
    
    
    @users_bp.route('/auth/sub-users/<int:sub_user_id>', methods=['PATCH'])
    @login_required
    def update_sub_user(sub_user_id):
        """Update sub-user role or permissions."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        sub_user = SubUser.query.filter_by(
            parent_user_id=current_user.id,
            sub_user_id=sub_user_id
        ).first_or_404()
        
        data = request.get_json() or {}
        
        if 'role' in data:
            sub_user.role = data['role']
        if 'permissions' in data:
            sub_user.permissions = data['permissions']
        
        db.session.commit()
        return jsonify(sub_user.to_dict()), 200
    
    
    @users_bp.route('/auth/sub-users/<int:sub_user_id>', methods=['DELETE'])
    @login_required
    def remove_sub_user(sub_user_id):
        """Remove (deactivate) a sub-user."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        sub_user = SubUser.query.filter_by(
            parent_user_id=current_user.id,
            sub_user_id=sub_user_id
        ).first_or_404()
        
        sub_user.is_active = False
        sub_user.removed_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Sub-user {sub_user_id} removed from {current_user.email}")
        return jsonify({'message': 'Sub-user removed'}), 200
    
    
    # ===== BATCH FILE PROCESSING =====
    
    @users_bp.route('/auth/batch-jobs', methods=['POST'])
    @login_required
    def create_batch_job():
        """Create a new batch file processing job."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        data = request.get_json() or {}
        job_name = data.get('job_name', 'Batch Job')
        files = data.get('files', [])  # List of file paths to process
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        if len(files) > 100:  # Limit batch size
            return jsonify({'error': 'Maximum 100 files per batch'}), 400
        
        # Create batch job
        batch_job = BatchFileJob(
            user_id=current_user.id,
            job_name=job_name,
            total_files=len(files)
        )
        
        db.session.add(batch_job)
        db.session.flush()  # Get the ID
        
        # Add individual file items
        for file_path in files:
            item = BatchFileItem(
                batch_job_id=batch_job.id,
                file_name=file_path.split('/')[-1],
                file_path=file_path
            )
            db.session.add(item)
        
        db.session.commit()
        
        # Trigger async batch processing
        from app.tasks.celery_tasks import process_batch_files
        task = process_batch_files.delay(batch_job.id)
        
        batch_job.celery_task_id = task.id
        db.session.commit()
        
        logger.info(f"Batch job {batch_job.id} created by {current_user.email}")
        return jsonify(batch_job.to_dict()), 201
    
    
    @users_bp.route('/auth/batch-jobs/<int:job_id>', methods=['GET'])
    @login_required
    def get_batch_job(job_id):
        """Get batch job status and progress."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        batch_job = BatchFileJob.query.filter_by(
            user_id=current_user.id,
            id=job_id
        ).first_or_404()
        
        return jsonify({
            **batch_job.to_dict(),
            'items': [item.to_dict() for item in batch_job.items]
        }), 200
    
    
    @users_bp.route('/auth/batch-jobs', methods=['GET'])
    @login_required
    def list_batch_jobs():
        """List all batch jobs for current user."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)
        status = request.args.get('status')  # Optional filter
        
        query = BatchFileJob.query.filter_by(user_id=current_user.id)
        
        if status:
            query = query.filter_by(status=status)
        
        total = query.count()
        jobs = query.order_by(BatchFileJob.created_at.desc()).limit(limit).offset(offset).all()
        
        return jsonify({
            'jobs': [job.to_dict() for job in jobs],
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
    
    
    @users_bp.route('/auth/batch-jobs/<int:job_id>/cancel', methods=['POST'])
    @login_required
    def cancel_batch_job(job_id):
        """Cancel a batch job."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        batch_job = BatchFileJob.query.filter_by(
            user_id=current_user.id,
            id=job_id
        ).first_or_404()
        
        if batch_job.status in ['completed', 'failed']:
            return jsonify({'error': 'Cannot cancel completed job'}), 400
        
        # Revoke celery task if running
        if batch_job.celery_task_id:
            from app.celery_app import celery
            celery.control.revoke(batch_job.celery_task_id, terminate=True)
        
        batch_job.status = 'failed'
        batch_job.error_message = 'Job cancelled by user'
        db.session.commit()
        
        return jsonify(batch_job.to_dict()), 200
    
    
    # ===== ADVANCED ANALYTICS =====
    
    @users_bp.route('/auth/analytics/summary', methods=['GET'])
    @login_required
    def get_analytics_summary():
        """Get analytics summary for current user."""
        _, _, error_response, error_code = _require_plan('compliance')
        if error_response:
            return error_response, error_code

        days = request.args.get('days', 30, type=int)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Total analyses
        total_analyses = AnalysisTransaction.query.filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.created_at >= cutoff_date
            )
        ).count()
        
        # Successful analyses
        successful = AnalysisTransaction.query.filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.status == AnalysisStatus.SUCCESS,
                AnalysisTransaction.created_at >= cutoff_date
            )
        ).count()
        
        # Failed analyses
        failed = AnalysisTransaction.query.filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.status == AnalysisStatus.FAILED,
                AnalysisTransaction.created_at >= cutoff_date
            )
        ).count()
        
        # Total items processed
        total_items = db.session.query(func.sum(AnalysisTransaction.items_count)).filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.created_at >= cutoff_date
            )
        ).scalar() or 0
        
        # Average processing time
        avg_processing_ms = db.session.query(func.avg(AnalysisTransaction.processing_ms)).filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.status == AnalysisStatus.SUCCESS,
                AnalysisTransaction.created_at >= cutoff_date
            )
        ).scalar() or 0
        
        return jsonify({
            'period_days': days,
            'total_analyses': total_analyses,
            'successful': successful,
            'failed': failed,
            'success_rate': (successful / total_analyses * 100) if total_analyses > 0 else 0,
            'total_items_processed': total_items,
            'avg_processing_ms': int(avg_processing_ms) if avg_processing_ms else 0
        }), 200
    
    
    @users_bp.route('/auth/analytics/timeline', methods=['GET'])
    @login_required
    def get_analytics_timeline():
        """Get analytics timeline (daily breakdown)."""
        _, _, error_response, error_code = _require_plan('compliance')
        if error_response:
            return error_response, error_code

        days = request.args.get('days', 30, type=int)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        metrics = AnalyticsMetric.query.filter(
            and_(
                AnalyticsMetric.user_id == current_user.id,
                AnalyticsMetric.recorded_at >= cutoff_date,
                AnalyticsMetric.time_period == 'daily'
            )
        ).order_by(AnalyticsMetric.recorded_at.desc()).all()
        
        return jsonify({
            'metrics': [m.to_dict() for m in metrics]
        }), 200
    
    
    @users_bp.route('/auth/analytics/threats', methods=['GET'])
    @login_required
    def get_threat_analytics():
        """Get threat detection analytics."""
        _, _, error_response, error_code = _require_plan('compliance')
        if error_response:
            return error_response, error_code

        days = request.args.get('days', 30, type=int)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Query threat detection patterns
        threat_summary = db.session.query(
            AnalysisTransaction.result_summary,
            func.count(AnalysisTransaction.id).label('count')
        ).filter(
            and_(
                AnalysisTransaction.user_id == current_user.id,
                AnalysisTransaction.status == AnalysisStatus.SUCCESS,
                AnalysisTransaction.created_at >= cutoff_date,
                AnalysisTransaction.result_summary != None
            )
        ).group_by(AnalysisTransaction.result_summary).all()
        
        return jsonify({
            'threat_patterns': [
                {'type': summary, 'count': count}
                for summary, count in threat_summary
            ]
        }), 200


    # ===== DASHBOARD COMPLIANCE & VCISO PORTAL =====

    @users_bp.route('/auth/compliance/intake', methods=['POST'])
    @login_required
    def submit_compliance_intake():
        """Store compliance intake payload for scoring and recommendation generation."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)
        if tier == 'free':
            return jsonify({'error': 'Compliance plan required'}), 403

        payload = request.get_json(silent=True) or {}
        organization = payload.get('organization') or {}
        controls = payload.get('controls') or []

        if not organization.get('legal_name'):
            return jsonify({'error': 'organization.legal_name is required'}), 400
        if not isinstance(controls, list) or len(controls) == 0:
            return jsonify({'error': 'controls must be a non-empty list'}), 400

        evidence = SecurityEvent(
            user_id=current_user.id,
            event_type='compliance.intake.submitted',
            severity='info',
            details=json.dumps({
                'schema_version': '1.0',
                'submitted_at': datetime.utcnow().isoformat(),
                'payload': payload,
            }),
        )
        db.session.add(evidence)
        db.session.commit()

        return jsonify({
            'message': 'Compliance intake stored',
            'intake_id': evidence.id,
            'summary': {
                'controls_count': len(controls),
                'incidents_count': len(payload.get('incidents') or []),
                'assets_count': len(payload.get('assets') or []),
            },
        }), 201

    @users_bp.route('/auth/compliance/score', methods=['GET'])
    @login_required
    def get_compliance_score():
        """Compute compliance score from latest intake payload."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)
        if tier == 'free':
            return jsonify({'error': 'Compliance plan required'}), 403

        intake = _latest_compliance_intake(current_user.id)
        if not intake:
            return jsonify({'error': 'No compliance intake found. Submit /auth/compliance/intake first.'}), 404

        details = _safe_json_load(intake.details)
        payload = details.get('payload') or {}
        score = _compute_compliance_score(payload)

        return jsonify({
            'plan_key': plan_key,
            'tier': tier,
            'intake_id': intake.id,
            'scored_at': datetime.utcnow().isoformat(),
            **score,
        }), 200

    @users_bp.route('/auth/vciso/recommendations', methods=['POST'])
    @login_required
    def generate_vciso_recommendations():
        """Generate actionable vCISO recommendations using intake + recent security signals."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)
        if tier != 'enterprise':
            return jsonify({'error': 'Enterprise plan required'}), 403

        body = request.get_json(silent=True) or {}
        persist = bool(body.get('persist', False))

        intake = _latest_compliance_intake(current_user.id)
        intake_payload = {}
        if intake:
            intake_payload = (_safe_json_load(intake.details).get('payload') or {})

        score = _compute_compliance_score(intake_payload) if intake_payload else {
            'overall_score': 0,
            'coverage_score': 0,
            'evidence_score': 0,
            'incident_response_score': 0,
            'details': {
                'required_controls': 0,
                'implemented_controls': 0,
                'controls_with_evidence': 0,
                'reportable_incidents': 0,
                'incidents_with_sla_met': 0,
            },
        }

        org = intake_payload.get('organization') or {}
        identities = intake_payload.get('identities') or {}
        mfa_pct = int(identities.get('mfa_enabled_percent') or 0)

        recommendations = []

        if score['overall_score'] < 70:
            recommendations.append({
                'title': 'Raise baseline control coverage',
                'priority': 'high',
                'type': 'action',
                'body': 'Compliance score is below target. Prioritize implementation of missing NIS2/GDPR controls and assign owners with due dates.',
                'action_items': [
                    'Map all missing controls to owners',
                    'Set remediation deadlines for next 30 days',
                    'Run weekly control closure review',
                ],
            })

        if mfa_pct and mfa_pct < 100:
            recommendations.append({
                'title': 'Close MFA coverage gap',
                'priority': 'high' if mfa_pct < 95 else 'medium',
                'type': 'recommendation',
                'body': f'MFA coverage is {mfa_pct}%. Raise to 100% for privileged and remote-access accounts.',
                'action_items': [
                    'Identify non-MFA users and owners',
                    'Enforce conditional access policy',
                    'Re-audit admin accounts after rollout',
                ],
            })

        if score['details']['reportable_incidents'] > score['details']['incidents_with_sla_met']:
            recommendations.append({
                'title': 'Improve incident reporting SLA compliance',
                'priority': 'critical',
                'type': 'action',
                'body': 'Some reportable incidents did not meet full 24h/72h reporting obligations.',
                'action_items': [
                    'Run incident timeline postmortem',
                    'Define escalation matrix for reportable incidents',
                    'Automate 24h and 72h notification reminders',
                ],
            })

        if not recommendations:
            recommendations.append({
                'title': 'Maintain monthly compliance operating cadence',
                'priority': 'low',
                'type': 'advisory',
                'body': 'Current posture is stable. Continue monthly control reviews and quarterly tabletop exercises.',
                'action_items': [
                    'Schedule monthly control review',
                    'Run quarterly incident tabletop drill',
                    'Refresh evidence bundle for audit readiness',
                ],
            })

        persisted = 0
        if persist:
            for rec in recommendations:
                update = VcisoUpdate(
                    user_id=current_user.id,
                    title=rec['title'],
                    note=rec['body'],
                    action_items='\n'.join(rec['action_items']),
                    author_name='GueInsight vCISO Engine',
                    created_by_admin_id=None,
                    is_active=True,
                )
                db.session.add(update)
                persisted += 1
            db.session.commit()

        return jsonify({
            'organization': org.get('legal_name') or current_user.company or current_user.email,
            'plan_key': plan_key,
            'tier': tier,
            'intake_found': bool(intake),
            'score': {
                'overall_score': score['overall_score'],
                'coverage_score': score['coverage_score'],
                'evidence_score': score['evidence_score'],
                'incident_response_score': score['incident_response_score'],
            },
            'recommendations': recommendations,
            'persisted': persisted,
        }), 200

    @users_bp.route('/auth/security_events', methods=['GET'])
    @login_required
    def get_user_security_events():
        """Return security events visible to the current user for dashboard incidents feed."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)

        if tier != 'enterprise':
            return jsonify({'error': 'Enterprise plan required'}), 403

        limit = request.args.get('limit', 20, type=int)
        if limit is None:
            limit = 20
        limit = max(1, min(limit, 100))

        events = (
            SecurityEvent.query
            .filter(or_(SecurityEvent.user_id == current_user.id, SecurityEvent.user_id.is_(None)))
            .order_by(SecurityEvent.created_at.desc())
            .limit(limit)
            .all()
        )

        return jsonify({'security_events': [event.to_dict() for event in events]}), 200

    @users_bp.route('/auth/dashboard/compliance', methods=['GET'])
    @login_required
    def get_dashboard_compliance():
        """Return compliance overview data with plan-tier gating for dashboard tab."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)
        access_level = 'locked' if tier == 'free' else ('basic' if tier == 'compliance' else 'full')

        config = COMPLIANCE_TIERS.get(plan_key, COMPLIANCE_TIERS['free'])

        export_completed = DataExportRequest.query.filter_by(user_id=current_user.id, status='completed').count()
        deletion_processed = DataDeletionRequest.query.filter_by(user_id=current_user.id, status='processed').count()
        nis2_reports = NIS2IncidentReport.query.filter_by(user_id=current_user.id).count()

        base_score = {
            'locked': 0,
            'basic': 72,
            'full': 88,
        }.get(access_level, 0)
        score = min(98, base_score + (2 if export_completed > 0 else 0) + (2 if deletion_processed > 0 else 0) + (3 if nis2_reports > 0 else 0))

        nis2_checklist = [
            {'item': 'Incident detection and response process documented', 'status': 'done' if tier == 'enterprise' else ('in_progress' if tier == 'compliance' else 'locked')},
            {'item': 'Critical asset inventory updated and reviewed monthly', 'status': 'done' if tier == 'enterprise' else ('in_progress' if tier == 'compliance' else 'locked')},
            {'item': 'Supplier and third-party risk review cadence defined', 'status': 'done' if tier == 'enterprise' else ('todo' if tier == 'compliance' else 'locked')},
            {'item': 'Executive-level risk register linked to mitigation owners', 'status': 'done' if tier == 'enterprise' else ('todo' if tier == 'compliance' else 'locked')},
        ]

        gdpr_checklist = [
            {'item': 'Data processing inventory and lawful basis mapped', 'status': 'done' if config.get('gdpr_ready') else ('todo' if access_level != 'locked' else 'locked')},
            {'item': 'Data subject request workflow and response SLA configured', 'status': 'done' if export_completed > 0 else ('in_progress' if access_level != 'locked' else 'locked')},
            {'item': 'Retention and deletion policy enforced for account records', 'status': 'done' if deletion_processed > 0 else ('in_progress' if access_level != 'locked' else 'locked')},
            {'item': 'Audit trail available for consent, export, and deletion actions', 'status': 'done' if access_level == 'full' else ('in_progress' if access_level == 'basic' else 'locked')},
        ]

        return jsonify({
            'plan_key': plan_key,
            'tier': tier,
            'access_level': access_level,
            'compliance_score': score,
            'gdpr_status': 'Advanced' if access_level == 'full' else ('Baseline' if access_level == 'basic' else 'Locked'),
            'nis2_status': 'Operational' if access_level == 'full' else ('In Progress' if access_level == 'basic' else 'Locked'),
            'stats': {
                'exports_completed': export_completed,
                'deletion_requests_processed': deletion_processed,
                'nis2_reports_submitted': nis2_reports,
            },
            'nis2_checklist': nis2_checklist,
            'gdpr_checklist': gdpr_checklist,
        }), 200

    @users_bp.route('/auth/dashboard/vciso', methods=['GET'])
    @login_required
    def get_dashboard_vciso_updates():
        """Return vCISO portal updates for enterprise users (or lock state for non-enterprise)."""
        plan_key = _get_user_plan(current_user.id)
        tier = _plan_access(plan_key)

        if tier != 'enterprise':
            return jsonify({
                'plan_key': plan_key,
                'tier': tier,
                'access_level': 'locked',
                'updates': [],
                'message': 'vCISO Portal is available on Enterprise tiers only.',
            }), 200

        updates = (
            VcisoUpdate.query
            .filter(
                and_(
                    VcisoUpdate.is_active == True,
                    or_(VcisoUpdate.user_id == current_user.id, VcisoUpdate.user_id == None),
                )
            )
            .order_by(VcisoUpdate.created_at.desc())
            .limit(20)
            .all()
        )

        if not updates:
            seed = [
                {
                    'title': 'Priority recommendation: tighten identity controls',
                    'note': 'Enable conditional access for privileged accounts and enforce MFA coverage checks across admin scopes.',
                    'action_items': [
                        'Enable conditional access for admin scopes',
                        'Audit MFA coverage for all privileged users',
                    ],
                    'author_name': 'Gabriel Aloho',
                    'created_at': datetime.utcnow().isoformat(),
                },
                {
                    'title': 'Action item: patch exposure window reduction',
                    'note': 'Critical patch SLAs should move to 72 hours. Current average is above target based on latest telemetry.',
                    'action_items': [
                        'Set 72-hour SLA for critical vulnerabilities',
                        'Track weekly patch aging trend by business unit',
                    ],
                    'author_name': 'Gabriel Aloho',
                    'created_at': datetime.utcnow().isoformat(),
                },
            ]
            return jsonify({
                'plan_key': plan_key,
                'tier': tier,
                'access_level': 'full',
                'updates': seed,
            }), 200

        return jsonify({
            'plan_key': plan_key,
            'tier': tier,
            'access_level': 'full',
            'updates': [item.to_dict() for item in updates],
        }), 200
    
    
    # ===== REAL-TIME ALERT PROCESSING =====
    
    @users_bp.route('/auth/alerts/rules', methods=['GET'])
    @login_required
    def list_alert_rules():
        """Get all alert rules for current user."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        rules = AlertRule.query.filter_by(user_id=current_user.id).all()
        
        return jsonify({
            'rules': [
                {
                    'id': r.id,
                    'rule_type': r.rule_type,
                    'value': r.value,
                    'severity': r.severity,
                    'enabled': bool(r.enabled)
                }
                for r in rules
            ]
        }), 200
    
    
    @users_bp.route('/auth/alerts/rules', methods=['POST'])
    @login_required
    def create_alert_rule():
        """Create a new alert rule."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        data = request.get_json() or {}
        rule_type = data.get('rule_type')  # keyword, ioc, severity, etc.
        value = data.get('value')
        severity = data.get('severity', 'medium')
        
        if not rule_type or not value:
            return jsonify({'error': 'rule_type and value required'}), 400
        
        rule = AlertRule(
            user_id=current_user.id,
            rule_type=rule_type,
            value=value,
            severity=severity
        )
        
        db.session.add(rule)
        db.session.commit()
        
        logger.info(f"Alert rule created for {current_user.email}")
        return jsonify({
            'id': rule.id,
            'rule_type': rule.rule_type,
            'value': rule.value,
            'severity': rule.severity
        }), 201
    
    
    @users_bp.route('/auth/alerts/rules/<int:rule_id>', methods=['PATCH'])
    @login_required
    def update_alert_rule(rule_id):
        """Update an alert rule."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        rule = AlertRule.query.filter_by(id=rule_id, user_id=current_user.id).first_or_404()
        
        data = request.get_json() or {}
        
        if 'enabled' in data:
            rule.enabled = data['enabled']
        if 'severity' in data:
            rule.severity = data['severity']
        if 'value' in data:
            rule.value = data['value']
        
        db.session.commit()
        return jsonify({'message': 'Rule updated'}), 200
    
    
    @users_bp.route('/auth/alerts/processing-logs', methods=['GET'])
    @login_required
    def get_alert_processing_logs():
        """Get alert processing logs for debugging."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        limit = request.args.get('limit', 20, type=int)
        
        # Get recent alert processing logs
        logs = db.session.query(AlertProcessingLog).join(
            Alert, AlertProcessingLog.alert_id == Alert.id
        ).filter(
            Alert.id.in_(
                db.session.query(Alert.id).join(
                    AlertRule, Alert.rule_id == AlertRule.id
                ).filter(AlertRule.user_id == current_user.id)
            )
        ).order_by(AlertProcessingLog.created_at.desc()).limit(limit).all()
        
        return jsonify({
            'logs': [log.to_dict() for log in logs]
        }), 200
    
    
    # ===== EXTERNAL SECURITY TOOL INTEGRATIONS =====
    
    @users_bp.route('/auth/integrations', methods=['GET'])
    @login_required
    def list_integrations():
        """List all security tool integrations for current user."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        integrations = SecurityToolIntegration.query.filter_by(user_id=current_user.id).all()
        
        return jsonify({
            'integrations': [i.to_dict() for i in integrations]
        }), 200
    
    
    @users_bp.route('/auth/integrations', methods=['POST'])
    @login_required
    def add_integration():
        """Add a new security tool integration."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        data = request.get_json() or {}
        tool_name = data.get('tool_name')  # virustotal, abuseipdb, shodan, etc.
        api_key = data.get('api_key')
        
        if not tool_name or not api_key:
            return jsonify({'error': 'tool_name and api_key required'}), 400
        
        # Validate tool is supported
        supported_tools = ['virustotal', 'abuseipdb', 'shodan', 'rapidapi']
        if tool_name not in supported_tools:
            return jsonify({'error': f'Unsupported tool. Supported: {", ".join(supported_tools)}'}), 400
        
        # Check if already configured
        existing = SecurityToolIntegration.query.filter_by(
            user_id=current_user.id,
            tool_name=tool_name
        ).first()
        
        if existing:
            return jsonify({'error': f'{tool_name} already configured'}), 409
        
        try:
            encrypted_api_key = encrypt_sensitive_value(api_key)
        except Exception:
            logger.exception('Failed to encrypt integration API key for user_id=%s', current_user.id)
            return jsonify({'error': 'Unable to securely store integration key at this time.'}), 500

        integration = SecurityToolIntegration(
            user_id=current_user.id,
            tool_name=tool_name,
            api_key_encrypted=encrypted_api_key
        )
        
        db.session.add(integration)
        db.session.commit()
        
        logger.info(f"Integration {tool_name} added for {current_user.email}")
        return jsonify(integration.to_dict()), 201
    
    
    @users_bp.route('/auth/integrations/<int:integration_id>', methods=['DELETE'])
    @login_required
    def remove_integration(integration_id):
        """Remove a security tool integration."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        integration = SecurityToolIntegration.query.filter_by(
            user_id=current_user.id,
            id=integration_id
        ).first_or_404()
        
        db.session.delete(integration)
        db.session.commit()
        
        logger.info(f"Integration {integration.tool_name} removed for {current_user.email}")
        return jsonify({'message': 'Integration removed'}), 200
    
    
    @users_bp.route('/auth/integrations/<int:integration_id>/test', methods=['POST'])
    @login_required
    def test_integration(integration_id):
        """Test a security tool integration."""
        _, _, error_response, error_code = _require_plan('enterprise')
        if error_response:
            return error_response, error_code

        integration = SecurityToolIntegration.query.filter_by(
            user_id=current_user.id,
            id=integration_id
        ).first_or_404()
        
        # Test based on tool type
        try:
            # Backwards-compatible: if legacy plaintext records exist, use as-is.
            try:
                api_key = decrypt_sensitive_value(integration.api_key_encrypted)
            except ValueError:
                api_key = integration.api_key_encrypted

            if integration.tool_name == 'virustotal':
                from app.integrations.virustotal_integration import test_connection
                result = test_connection(api_key)
            elif integration.tool_name == 'abuseipdb':
                from app.integrations.abuseipdb_integration import test_connection
                result = test_connection(api_key)
            else:
                return jsonify({'error': f'Test not available for {integration.tool_name}'}), 400
            
            integration.last_successful_call = datetime.utcnow()
            db.session.commit()
            
            return jsonify({'status': 'success', 'message': 'Integration test passed'}), 200
        
        except Exception as e:
            integration.last_failed_call = datetime.utcnow()
            integration.failure_reason = str(e)
            db.session.commit()
            
            logger.error(f"Integration test failed: {e}")
            return jsonify({'status': 'failed', 'message': str(e)}), 400
