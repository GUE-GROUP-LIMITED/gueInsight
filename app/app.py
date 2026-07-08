import os
import datetime

from flask import render_template, send_from_directory, request, jsonify
from flask_login import LoginManager
from flask_mail import Mail
from app import create_app, db
from app.models import User
from app.utils.utils import get_serializer

# Initialize the Flask app
app = create_app()  # Use the create_app function to initialize the app

#csrf = CSRFProtect(app)
mail = Mail(app)
# Serializer for generating and verifying tokens
app.serializer = get_serializer(app.config['SECRET_KEY'], app.config['SECURITY_PASSWORD_SALT'])
# Initialize login manager
login_manager = LoginManager(app)
login_manager.login_view = 'users.user_login'  # Redirect to login page if not authenticated
login_manager.login_view = 'admin.admin_login' # Redirect to login page if not authenticated

# User loader function
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

print(app.url_map)


def get_frontend_dist_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))


def serve_frontend_index(status_code=200):
    response = send_from_directory(get_frontend_dist_dir(), 'index.html')
    response.status_code = status_code
    # Avoid stale SPA shell caching during local updates.
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Serve static assets for React
@app.route('/assets/<path:filename>')
def serve_react_assets(filename):
    assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist', 'assets'))
    return send_from_directory(assets_dir, filename)

# Serve React frontend for all non-API, non-auth routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # API requests should stay JSON-based.
    if path.startswith('api'):
        return jsonify({'error': 'Not found'}), 404

    # Known backend form endpoints should not be routed through the SPA shell.
    if path.startswith('user_') or path.startswith('admin_'):
        return jsonify({'error': 'Not found'}), 404

    # Otherwise, serve the React app using an absolute path.
    return serve_frontend_index()


@app.errorhandler(404)
def handle_not_found(error):
    if request.path.startswith('/api'):
        return jsonify({'error': 'Not found'}), 404
    return serve_frontend_index(404)


@app.errorhandler(500)
def handle_server_error(error):
    if request.path.startswith('/api'):
        return jsonify({'error': 'Internal server error'}), 500
    return serve_frontend_index(500)

if __name__ == "__main__":
    app.run(debug=(os.getenv('FLASK_DEBUG', '').strip() == '1'))


# --- Real-Time Event Ingestion API ---
from flask import request, jsonify
from app.security import require_api_key, rate_limit

# --- Live Dashboard Route ---
from flask import render_template


from app import db
from app.models import Event

@app.route('/live_dashboard')
def live_dashboard():
    return render_template('users/live_dashboard.html')


@app.route('/api/live_events')
def api_live_events():
    import datetime
    # Query last 50 events from DB
    events = Event.query.order_by(Event.timestamp.desc()).limit(50).all()
    event_dicts = [
        {
            'timestamp': e.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'summary': f"{e.raw_data} | Enrichment: {e.enrichment}"
        }
        for e in events
    ]
    # Trend: count per minute
    buckets = {}
    for e in events:
        minute = e.timestamp.strftime('%Y-%m-%d %H:%M')
        buckets[minute] = buckets.get(minute, 0) + 1
    trend = {
        'timestamps': list(buckets.keys()),
        'counts': list(buckets.values())
    }
    return jsonify({'events': event_dicts, 'trend': trend})

@app.route('/api/ingest_event', methods=['POST'])
@require_api_key
@rate_limit
def ingest_event():
    """
    Accepts JSON payloads (e.g., logs, alerts, events) from external tools for real-time ingestion.
    """
    if not request.is_json:
        return jsonify({'status': 'error', 'message': 'Request must be JSON.'}), 400
    if request.content_length and request.content_length > 1024 * 1024:
        return jsonify({'status': 'error', 'message': 'Payload too large. Max size is 1MB.'}), 413

    event = request.get_json(silent=True)
    if not isinstance(event, dict):
        return jsonify({'status': 'error', 'message': 'Event payload must be a JSON object.'}), 400

    allowed_types = {'alert', 'log', 'event', 'ioc', 'threat', 'generic'}
    event_type = str(event.get('type', 'generic')).strip().lower()
    if event_type not in allowed_types:
        return jsonify({'status': 'error', 'message': f'Unsupported event type. Allowed: {", ".join(sorted(allowed_types))}'}), 400

    source = str(event.get('source', 'api')).strip()
    if not source:
        return jsonify({'status': 'error', 'message': 'source is required.'}), 400

    # --- Enrichment & Analysis ---
    try:
        from app.integrations.rapidapi import enrich_event
        enrichment = enrich_event(event)
    except Exception as e:
        enrichment = {'error': str(e)}

    if not isinstance(enrichment, dict):
        enrichment = {'result': enrichment}


    # --- Store event in DB for live dashboard ---
    import json
    from sqlalchemy.exc import SQLAlchemyError
    try:
        db_event = Event(
            timestamp=datetime.datetime.utcnow(),
            source='api',
            event_type=event_type,
            raw_data=json.dumps(event),
            enrichment=json.dumps(enrichment),
            threat_detected=any(isinstance(v, dict) and v.get('malicious') for v in enrichment.values())
        )
        db.session.add(db_event)
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()

    # Optionally, call analysis here
    # from app.src.analysis.file_analysis import analyze_event
    # analysis_result = analyze_event(enrichment)

    # --- Alerting (Slack/Teams) if threat detected ---
    try:
        from app.notifications.alerts import send_slack_alert, send_teams_alert
        # Simple example: if enrichment contains a known threat verdict
        threat_detected = False
        threat_summary = None
        for key, value in enrichment.items():
            if isinstance(value, dict) and value.get('malicious'):
                threat_detected = True
                threat_summary = f"Threat detected in {key}: {value}"
        if threat_detected:
            send_slack_alert(threat_summary or 'Threat detected in event!')
            send_teams_alert(threat_summary or 'Threat detected in event!')
    except Exception as e:
        pass  # Don't block API on alert failure

    return jsonify({'status': 'success', 'received_event': event, 'enrichment': enrichment}), 200

