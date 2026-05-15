"""
Celery app scaffold for background tasks (evidence gatherer).

Configure with env VAR `CELERY_BROKER_URL` (e.g., redis://redis:6379/0)
"""
import os
from celery import Celery

CELERY_BROKER = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_BACKEND = os.getenv('CELERY_RESULT_BACKEND', CELERY_BROKER)

celery = Celery('gueinsight', broker=CELERY_BROKER, backend=CELERY_BACKEND)
celery.conf.update(task_serializer='json', result_serializer='json', accept_content=['json'])

# Autodiscover tasks in app.tasks
celery.autodiscover_tasks(['app.tasks'])

# Default beat schedule: run evidence collection hourly. Can be overridden via
# environment variable `EVIDENCE_COLLECTION_CRON` (cron string) or by editing
# celery beat configuration in production.
celery.conf.beat_schedule = {
	'run-evidence-collection-every-hour': {
		'task': 'app.tasks.celery_tasks.run_evidence_collection',
		'schedule': 3600.0,  # seconds
		'args': ()
	}
}
