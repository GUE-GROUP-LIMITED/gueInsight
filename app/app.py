from flask import render_template, send_from_directory, request
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

# Serve static assets for React
@app.route('/assets/<path:filename>')
def serve_react_assets(filename):
    import os
    assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist', 'assets'))
    return send_from_directory(assets_dir, filename)

# Serve React frontend for all non-API, non-auth routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # If the request is for an API or known Flask route, let Flask handle it
    if path.startswith('api') or path.startswith('user_') or path.startswith('admin_') or path in ['user_login', 'user_signup', 'admin_login']:
        return render_template('404.html'), 404
    # Otherwise, serve the React app using an absolute path
    import os
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
    return send_from_directory(dist_dir, 'index.html')

if __name__ == "__main__":
    app.run(debug=True)


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
    event = request.get_json()
    # TODO: Validate event structure as needed

    # --- Enrichment & Analysis ---
    try:
        from app.integrations.rapidapi import enrich_event
        enrichment = enrich_event(event)
    except Exception as e:
        enrichment = {'error': str(e)}


    # --- Store event in DB for live dashboard ---
    import json
    from sqlalchemy.exc import SQLAlchemyError
    try:
        db_event = Event(
            timestamp=datetime.datetime.utcnow(),
            source='api',
            event_type=event.get('type', 'generic'),
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

