from app import create_app
from app.config import Config
from app.notifications import alerts


def _build_app():
    Config.APP_ENV = 'development'
    Config.IS_PRODUCTION = False
    Config.AUTO_CREATE_SCHEMA = True
    Config.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    Config.SECRET_KEY = 'test-secret-key'
    Config.SECURITY_PASSWORD_SALT = 'test-salt'

    app = create_app()
    app.config.update(
        TESTING=False,
        MAIL_SUPPRESS_SEND=False,
        MAIL_SENDER_NAME='GueInsight',
        MAIL_DEFAULT_SENDER='no-reply@guecyber.com',
        MAIL_SUPPORT_SENDER='support@guecyber.com',
        MAIL_BILLING_SENDER='billing@guecyber.com',
        MAIL_SUPPORT_REPLY_TO='support@guecyber.com',
        MAIL_BILLING_REPLY_TO='billing@guecyber.com',
    )
    return app


def test_send_email_uses_support_sender_profile(monkeypatch):
    app = _build_app()
    captured = {}

    def _capture_send(message):
        captured['message'] = message

    monkeypatch.setattr(alerts.mail, 'send', _capture_send)

    with app.app_context():
        result = alerts.send_email(
            'client@example.com',
            'Support acknowledgement',
            'Ticket received',
            sender_profile='support',
        )

    assert result['status'] == 'sent'
    msg = captured['message']
    assert msg.sender == 'GueInsight <support@guecyber.com>'
    assert msg.reply_to == 'support@guecyber.com'



def test_send_email_uses_billing_sender_profile(monkeypatch):
    app = _build_app()
    captured = {}

    def _capture_send(message):
        captured['message'] = message

    monkeypatch.setattr(alerts.mail, 'send', _capture_send)

    with app.app_context():
        result = alerts.send_email(
            'client@example.com',
            'Receipt',
            'Payment received',
            sender_profile='billing',
        )

    assert result['status'] == 'sent'
    msg = captured['message']
    assert msg.sender == 'GueInsight <billing@guecyber.com>'
    assert msg.reply_to == 'billing@guecyber.com'
