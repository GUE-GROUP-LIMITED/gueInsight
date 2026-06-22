from flask import request
from flask_login import current_user, login_required


def register_support_routes(users_bp):
    from app.routes import users_routes as ur

    @users_bp.route('/support_tickets', methods=['GET', 'POST'])
    @login_required
    def support_tickets():
        if request.method == 'GET':
            tickets = (
                ur.SupportTicket.query
                .filter_by(user_id=current_user.id)
                .order_by(ur.SupportTicket.created_at.desc())
                .all()
            )
            return {
                'tickets': [ticket.to_dict() for ticket in tickets],
            }, 200

        payload = request.get_json(silent=True) or request.form
        subject = (payload.get('subject') or '').strip()
        description = (payload.get('description') or '').strip()
        category = (payload.get('category') or '').strip() or None
        priority = (payload.get('priority') or 'medium').strip().lower()

        if not subject or not description:
            return {'error': 'Subject and description are required.'}, 400

        if priority not in {'low', 'medium', 'high', 'urgent'}:
            return {'error': 'Priority must be low, medium, high, or urgent.'}, 400

        ticket = ur.SupportTicket(
            user_id=current_user.id,
            subject=subject,
            description=description,
            category=category,
            priority=priority,
            status=ur.SupportTicketStatus.OPEN,
        )
        ur.db.session.add(ticket)
        ur.db.session.commit()

        return {'message': 'Support ticket created.', 'ticket': ticket.to_dict()}, 201
