from flask import request
from flask_login import current_user, login_required


def register_admin_security_routes(admin_bp):
    from app.routes import admin_routes as ar

    @admin_bp.route('/admin/security_events', methods=['GET'])
    @login_required
    def admin_security_events():
        ar.check_admin_role(current_user)

        severity_filter = (request.args.get('severity') or '').strip().lower()
        limit = request.args.get('limit', default=100, type=int)
        limit = max(1, min(limit, 500))

        query = ar.SecurityEvent.query
        if severity_filter:
            query = query.filter(ar.SecurityEvent.severity == severity_filter)

        events = query.order_by(ar.SecurityEvent.created_at.desc()).limit(limit).all()
        return {'security_events': [ar._serialize_security_event(event) for event in events]}, 200

    @admin_bp.route('/admin/deletion_requests', methods=['GET'])
    @login_required
    def admin_deletion_requests():
        ar.check_admin_role(current_user)
        status_filter = (request.args.get('status') or '').strip().lower()

        query = ar.DataDeletionRequest.query
        if status_filter:
            query = query.filter(ar.DataDeletionRequest.status == status_filter)

        rows = query.order_by(ar.DataDeletionRequest.requested_at.desc()).all()
        return {'deletion_requests': [ar._serialize_deletion_request(row) for row in rows]}, 200

    @admin_bp.route('/admin/deletion_requests/<int:request_id>', methods=['PATCH'])
    @login_required
    def admin_update_deletion_request(request_id):
        ar.check_admin_role(current_user)
        payload = request.get_json(silent=True) or {}
        new_status = (payload.get('status') or '').strip().lower()
        allowed_statuses = {'pending', 'in_review', 'rejected', 'processed'}

        if new_status not in allowed_statuses:
            return {'error': 'Invalid status.'}, 400

        deletion_request = ar.DataDeletionRequest.query.get_or_404(request_id)
        deletion_request.status = new_status
        if new_status == 'processed':
            deletion_request.processed_at = ar._utc_now()
            deletion_request.processed_by_user_id = current_user.id

        ar.db.session.commit()
        ar.Logs.log_action(current_user, f"Updated deletion request #{deletion_request.id} to {new_status}")
        return {'message': 'Deletion request updated.', 'request': ar._serialize_deletion_request(deletion_request)}, 200