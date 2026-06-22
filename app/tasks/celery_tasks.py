from .celery_app import celery
from datetime import datetime

@celery.task(bind=True)
def run_evidence_collection(self):
    """Celery task wrapper to run the EvidenceGatherer.gather_once()"""
    from app.utils.evidence_gatherer import EvidenceGatherer
    from app import create_app

    app = create_app()
    with app.app_context():
        gatherer = EvidenceGatherer()
        return gatherer.gather_once()


@celery.task(bind=True, default_retry_delay=60, max_retries=3)
def process_batch_files(self, batch_job_id):
    """Process batch file job asynchronously."""
    from app import create_app, db
    from app.models import BatchFileJob, BatchFileItem, AnalysisTransaction, AnalysisStatus
    from app.routes.users_routes import _get_active_plan_key, _get_analysis_limits_for_plan
    import logging
    
    app = create_app()
    logger = logging.getLogger(__name__)
    
    with app.app_context():
        batch_job = BatchFileJob.query.get(batch_job_id)
        if not batch_job:
            logger.error(f"Batch job {batch_job_id} not found")
            return {'status': 'failed', 'message': 'Batch job not found'}
        
        try:
            batch_job.status = 'processing'
            batch_job.started_at = datetime.utcnow()
            db.session.commit()
            
            items = BatchFileItem.query.filter_by(batch_job_id=batch_job_id).all()
            total_items = len(items)
            processed = 0
            failed = 0
            
            plan_key = _get_active_plan_key(batch_job.user_id)
            analysis_limits = _get_analysis_limits_for_plan(plan_key)
            
            for item in items:
                try:
                    item.status = 'processing'
                    item.processing_started_at = datetime.utcnow()
                    db.session.commit()
                    
                    # Create analysis transaction
                    from app.src.analysis.file_analysis import analyze_file
                    
                    analysis = AnalysisTransaction(
                        user_id=batch_job.user_id,
                        source_type='file',
                        input_ref=item.file_path,
                        plan_at_time=plan_key
                    )
                    db.session.add(analysis)
                    db.session.flush()
                    
                    # Process file (stub - actual implementation needed)
                    result = analyze_file(item.file_path)
                    
                    analysis.status = AnalysisStatus.SUCCESS
                    analysis.result_summary = str(result)[:2000]
                    item.status = 'completed'
                    item.analysis_transaction_id = analysis.id
                    item.processing_completed_at = datetime.utcnow()
                    
                    processed += 1
                    
                except Exception as e:
                    logger.error(f"Error processing file {item.file_path}: {e}")
                    item.status = 'failed'
                    item.error_message = str(e)[:500]
                    failed += 1
                
                db.session.commit()
                
                # Update progress
                batch_job.processed_files = processed
                batch_job.failed_files = failed
                batch_job.progress_percentage = int((processed + failed) / total_items * 100)
                db.session.commit()
                
                # Update task state
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': processed + failed,
                        'total': total_items,
                        'status': f'Processed {processed}/{total_items} files'
                    }
                )
            
            # Mark job as completed
            batch_job.status = 'completed'
            batch_job.completed_at = datetime.utcnow()
            batch_job.progress_percentage = 100
            db.session.commit()
            
            logger.info(f"Batch job {batch_job_id} completed: {processed} success, {failed} failed")
            return {
                'status': 'success',
                'processed': processed,
                'failed': failed
            }
        
        except Exception as e:
            logger.error(f"Batch job {batch_job_id} failed: {e}")
            batch_job.status = 'failed'
            batch_job.error_message = str(e)[:500]
            batch_job.completed_at = datetime.utcnow()
            db.session.commit()
            
            # Retry
            raise self.retry(exc=e)


@celery.task(bind=True, default_retry_delay=30, max_retries=5)
def process_alert_async(self, alert_id, processor_type='webhook'):
    """Process and deliver alert notifications in real-time."""
    from app import create_app, db
    from app.models import Alert, AlertProcessingLog
    import logging
    import time
    
    app = create_app()
    logger = logging.getLogger(__name__)
    
    with app.app_context():
        alert = Alert.query.get(alert_id)
        if not alert:
            logger.error(f"Alert {alert_id} not found")
            return {'status': 'failed', 'message': 'Alert not found'}
        
        try:
            start_time = time.time()
            
            # Create processing log
            log = AlertProcessingLog(
                alert_id=alert_id,
                processor_type=processor_type,
                processing_status='processing'
            )
            db.session.add(log)
            db.session.flush()
            
            # Process based on processor type
            response_code = None
            response_message = None
            
            if processor_type == 'webhook':
                # Send webhook notification
                import requests
                
                # Get user's webhook configuration from preferences
                user_prefs = alert.rule.user.preference if alert.rule.user else None
                webhook_url = getattr(user_prefs, 'webhook_url', None)
                
                if webhook_url:
                    try:
                        resp = requests.post(
                            webhook_url,
                            json={
                                'alert_id': alert.id,
                                'rule_id': alert.rule_id,
                                'event_description': alert.description,
                                'triggered_at': alert.triggered_at.isoformat() if alert.triggered_at else None
                            },
                            timeout=10
                        )
                        response_code = str(resp.status_code)
                        response_message = resp.text[:500]
                        
                        if resp.status_code != 200:
                            raise Exception(f"Webhook returned {resp.status_code}")
                    
                    except Exception as e:
                        logger.error(f"Webhook error: {e}")
                        raise
            
            elif processor_type == 'email':
                # Send email notification
                from flask_mail import Message
                from flask import current_app
                
                user = alert.rule.user
                if user and user.email:
                    try:
                        msg = Message(
                            subject=f"Security Alert: {alert.description}",
                            recipients=[user.email],
                            body=f"Alert triggered at {alert.triggered_at}\n\nDetails: {alert.description}"
                        )
                        from app import mail
                        mail.send(msg)
                        response_code = '200'
                        response_message = 'Email sent successfully'
                    
                    except Exception as e:
                        logger.error(f"Email error: {e}")
                        raise
            
            elif processor_type == 'slack':
                # Send Slack notification (requires Slack webhook configured)
                import requests
                
                # Get user's Slack webhook from integrations
                from app.models import SecurityToolIntegration
                slack_integration = SecurityToolIntegration.query.filter_by(
                    user_id=alert.rule.user_id,
                    tool_name='slack'
                ).first() if alert.rule.user_id else None
                
                if slack_integration and slack_integration.is_active:
                    try:
                        resp = requests.post(
                            slack_integration.api_key_encrypted,  # Store webhook URL as "API key"
                            json={
                                'text': f"🚨 Security Alert: {alert.description}",
                                'attachments': [
                                    {
                                        'color': 'danger',
                                        'fields': [
                                            {'title': 'Alert ID', 'value': str(alert.id), 'short': True},
                                            {'title': 'Triggered', 'value': alert.triggered_at.isoformat() if alert.triggered_at else 'N/A', 'short': True}
                                        ]
                                    }
                                ]
                            },
                            timeout=10
                        )
                        response_code = str(resp.status_code)
                        response_message = 'Slack notification sent'
                    
                    except Exception as e:
                        logger.error(f"Slack error: {e}")
                        raise
            
            # Mark as completed
            processing_time_ms = int((time.time() - start_time) * 1000)
            log.processing_status = 'completed'
            log.notification_sent_at = datetime.utcnow()
            log.response_code = response_code
            log.response_message = response_message
            log.processing_time_ms = processing_time_ms
            
            db.session.commit()
            
            logger.info(f"Alert {alert_id} processed via {processor_type}: {response_code}")
            return {
                'status': 'success',
                'processor_type': processor_type,
                'response_code': response_code,
                'processing_time_ms': processing_time_ms
            }
        
        except Exception as e:
            logger.error(f"Alert processing failed: {e}")
            
            # Update log with failure
            log = AlertProcessingLog.query.filter_by(alert_id=alert_id, processor_type=processor_type).order_by(
                AlertProcessingLog.created_at.desc()
            ).first()
            
            if log:
                log.processing_status = 'failed'
                log.response_message = str(e)[:500]
                log.retry_count += 1
                
                if log.retry_count < log.max_retries:
                    log.last_retry_at = datetime.utcnow()
                    db.session.commit()
                    
                    # Retry with exponential backoff
                    retry_delay = 30 * (2 ** log.retry_count)
                    raise self.retry(exc=e, countdown=retry_delay)
                else:
                    log.processing_status = 'failed'
            
            db.session.commit()
            return {'status': 'failed', 'message': str(e)}


@celery.task
def generate_analytics_metrics():
    """Generate daily analytics metrics for users."""
    from app import create_app, db
    from app.models import (
        User, AnalysisTransaction, AnalyticsMetric, AnalysisStatus
    )
    from sqlalchemy import func
    import logging
    
    app = create_app()
    logger = logging.getLogger(__name__)
    
    with app.app_context():
        try:
            # Get all active users
            users = User.query.filter_by(is_active=True).all()
            
            for user in users:
                # Count analyses
                analysis_count = AnalysisTransaction.query.filter_by(
                    user_id=user.id,
                    status=AnalysisStatus.SUCCESS
                ).count()
                
                # Total items processed
                total_items = db.session.query(func.sum(AnalysisTransaction.items_count)).filter_by(
                    user_id=user.id,
                    status=AnalysisStatus.SUCCESS
                ).scalar() or 0
                
                # Create metrics
                if analysis_count > 0:
                    metric_analyses = AnalyticsMetric(
                        user_id=user.id,
                        metric_type='analyses_completed',
                        metric_value=analysis_count,
                        time_period='daily'
                    )
                    db.session.add(metric_analyses)
                
                if total_items > 0:
                    metric_items = AnalyticsMetric(
                        user_id=user.id,
                        metric_type='items_processed',
                        metric_value=int(total_items),
                        time_period='daily'
                    )
                    db.session.add(metric_items)
            
            db.session.commit()
            logger.info("Daily analytics metrics generated")
            return {'status': 'success', 'users_processed': len(users)}
        
        except Exception as e:
            logger.error(f"Analytics generation failed: {e}")
            return {'status': 'failed', 'message': str(e)}
