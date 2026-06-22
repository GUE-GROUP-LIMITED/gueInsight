"""
Enterprise features routes: sub-user management, batch processing, advanced analytics, and real-time alerts.
Extracted module for scalability and team collaboration.
"""
import json
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import func, and_

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
)

logger = logging.getLogger(__name__)


def register_enterprise_routes(users_bp):
    """Register enterprise feature endpoints to user blueprint."""
    
    # ===== SUB-USER MANAGEMENT (Enterprise Plans) =====
    
    @users_bp.route('/auth/sub-users', methods=['GET'])
    @login_required
    def list_sub_users():
        """Get all sub-users for current user (enterprise only)."""
        subscription = Subscription.query.filter_by(user_id=current_user.id).first()
        
        # Verify enterprise plan
        if not subscription or subscription.plan not in ['enterprise_risk', 'enterprise_elite', 'premium_small_business', 'premium_large_business']:
            return jsonify({'error': 'Enterprise plan required'}), 403
        
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
        subscription = Subscription.query.filter_by(user_id=current_user.id).first()
        
        if not subscription or subscription.plan not in ['enterprise_risk', 'enterprise_elite', 'premium_small_business', 'premium_large_business']:
            return jsonify({'error': 'Enterprise plan required'}), 403
        
        data = request.get_json()
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
        sub_user = SubUser.query.filter_by(
            parent_user_id=current_user.id,
            sub_user_id=sub_user_id
        ).first_or_404()
        
        data = request.get_json()
        
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
        data = request.get_json()
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
    
    
    # ===== REAL-TIME ALERT PROCESSING =====
    
    @users_bp.route('/auth/alerts/rules', methods=['GET'])
    @login_required
    def list_alert_rules():
        """Get all alert rules for current user."""
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
        data = request.get_json()
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
        rule = AlertRule.query.filter_by(id=rule_id, user_id=current_user.id).first_or_404()
        
        data = request.get_json()
        
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
        integrations = SecurityToolIntegration.query.filter_by(user_id=current_user.id).all()
        
        return jsonify({
            'integrations': [i.to_dict() for i in integrations]
        }), 200
    
    
    @users_bp.route('/auth/integrations', methods=['POST'])
    @login_required
    def add_integration():
        """Add a new security tool integration."""
        data = request.get_json()
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
        
        # TODO: Encrypt API key before storing
        integration = SecurityToolIntegration(
            user_id=current_user.id,
            tool_name=tool_name,
            api_key_encrypted=api_key  # Should be encrypted!
        )
        
        db.session.add(integration)
        db.session.commit()
        
        logger.info(f"Integration {tool_name} added for {current_user.email}")
        return jsonify(integration.to_dict()), 201
    
    
    @users_bp.route('/auth/integrations/<int:integration_id>', methods=['DELETE'])
    @login_required
    def remove_integration(integration_id):
        """Remove a security tool integration."""
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
        integration = SecurityToolIntegration.query.filter_by(
            user_id=current_user.id,
            id=integration_id
        ).first_or_404()
        
        # Test based on tool type
        try:
            if integration.tool_name == 'virustotal':
                from app.integrations.virustotal_integration import test_connection
                result = test_connection(integration.api_key_encrypted)
            elif integration.tool_name == 'abuseipdb':
                from app.integrations.abuseipdb_integration import test_connection
                result = test_connection(integration.api_key_encrypted)
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
