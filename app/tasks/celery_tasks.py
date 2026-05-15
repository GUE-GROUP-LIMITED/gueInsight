from .celery_app import celery

@celery.task(bind=True)
def run_evidence_collection(self):
    """Celery task wrapper to run the EvidenceGatherer.gather_once()"""
    from app.utils.evidence_gatherer import EvidenceGatherer
    from app import create_app

    app = create_app()
    with app.app_context():
        gatherer = EvidenceGatherer()
        return gatherer.gather_once()
