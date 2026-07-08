from flask import request
from flask_login import current_user, login_required
import logging

from app.notifications.alerts import send_email


logger = logging.getLogger(__name__)


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

        # Acknowledge receipt to the customer from the support mailbox.
        try:
            send_email(
                current_user.email,
                f"Support Ticket Received - #{ticket.id}",
                (
                    f"Hello {current_user.first_name or 'there'},\n\n"
                    "We have received your support request and created a ticket.\n\n"
                    f"Ticket ID: {ticket.id}\n"
                    f"Subject: {ticket.subject}\n"
                    f"Priority: {ticket.priority}\n\n"
                    "Our support team will review your request and respond as soon as possible."
                ),
                sender_profile='support',
            )
        except Exception as exc:
            logger.error('Failed to send customer support acknowledgement for ticket %s: %s', ticket.id, exc)

        # Notify support mailbox internally for operational follow-up.
        try:
            support_inbox = (
                ur.current_app.config.get('MAIL_SUPPORT_SENDER')
                or ur.current_app.config.get('MAIL_DEFAULT_SENDER')
            )
            send_email(
                support_inbox,
                f"New Support Ticket - #{ticket.id}",
                (
                    f"New support ticket submitted by {current_user.email}\n\n"
                    f"Ticket ID: {ticket.id}\n"
                    f"Subject: {ticket.subject}\n"
                    f"Category: {ticket.category or 'general'}\n"
                    f"Priority: {ticket.priority}\n\n"
                    f"Description:\n{ticket.description}"
                ),
                sender_profile='support',
                reply_to=current_user.email,
            )
        except Exception as exc:
            logger.error('Failed to send internal support mailbox notification for ticket %s: %s', ticket.id, exc)

        return {'message': 'Support ticket created.', 'ticket': ticket.to_dict()}, 201
