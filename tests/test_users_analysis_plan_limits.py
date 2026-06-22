import types

import pytest
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.models import User, UserRole
import app.subscription_service as subscription_service_module


@pytest.fixture()
def app():
    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_user(email="limit@example.com", password="password", role=UserRole.USER):
    user = User(
        email=email,
        password=generate_password_hash(password),
        first_name="Limit",
        last_name="Tester",
        phone_number="+1234567890",
        role=role,
    )
    db.session.add(user)
    db.session.commit()
    return user


def _login(client, email, password="password"):
    return client.post(
        "/auth/login",
        data={"email": email, "password": password},
        follow_redirects=True,
    )


class _Field:
    def __init__(self, data):
        self.data = data


class _UploadFormFalse:
    def __init__(self):
        self.file = _Field(None)

    def validate_on_submit(self):
        return False


class _UrlFormFalse:
    def __init__(self):
        self.cloud_link = _Field(None)

    def validate_on_submit(self):
        return False


class _TextFormTooLong:
    def __init__(self):
        self.pasted_input = _Field("x" * 300)

    def validate_on_submit(self):
        return True


class _UrlFormTooLong:
    def __init__(self):
        self.cloud_link = _Field("https://example.com/" + ("a" * 300))

    def validate_on_submit(self):
        return True


class _TextFormFalse:
    def __init__(self):
        self.pasted_input = _Field(None)

    def validate_on_submit(self):
        return False


class _StubSubscriptionService:
    def __init__(self, user_id):
        self.subscription = types.SimpleNamespace(plan="starter")

    def get_subscription_status(self, current_user):
        return "Freemium"


def _patch_upload_runtime(monkeypatch, client, upload_form, url_form, text_form, max_text_chars, max_url_length):
    upload_view = client.application.view_functions["users.upload_file"]
    wrapped_upload_view = getattr(upload_view, "__wrapped__", upload_view)
    route_globals = wrapped_upload_view.__globals__

    monkeypatch.setattr(subscription_service_module, "SubscriptionService", _StubSubscriptionService)
    monkeypatch.setattr(
        route_globals["OutputHandler"],
        "count_uploads_in_month",
        staticmethod(lambda user_id, month: 0),
        raising=False,
    )
    monkeypatch.setattr(route_globals["ur"], "_get_active_plan_key", lambda user_id: "starter")
    monkeypatch.setattr(
        route_globals["ur"],
        "_get_analysis_limits_for_plan",
        lambda _: {
            "max_file_size_mb": 2,
            "max_text_chars": max_text_chars,
            "max_items_per_analysis": 5,
            "max_url_length": max_url_length,
        },
    )

    monkeypatch.setitem(route_globals, "UploadFileForm", upload_form)
    monkeypatch.setitem(route_globals, "SubmitCloudLinkForm", url_form)
    monkeypatch.setitem(route_globals, "SubmitTextForm", text_form)


def test_upload_text_plan_limit_branch_returns_400(client, monkeypatch):
    user = _create_user(email="textlimit@example.com")
    _login(client, email=user.email)

    _patch_upload_runtime(
        monkeypatch,
        client,
        _UploadFormFalse,
        _UrlFormFalse,
        _TextFormTooLong,
        max_text_chars=50,
        max_url_length=400,
    )

    response = client.post("/upload")
    assert response.status_code == 400
    data = response.get_json()
    assert data["status"] == "error"
    assert "exceeds your plan limit" in data["message"]


def test_upload_url_plan_limit_branch_returns_400(client, monkeypatch):
    user = _create_user(email="urllimit@example.com")
    _login(client, email=user.email)

    _patch_upload_runtime(
        monkeypatch,
        client,
        _UploadFormFalse,
        _UrlFormTooLong,
        _TextFormFalse,
        max_text_chars=1000,
        max_url_length=80,
    )

    response = client.post("/upload")
    assert response.status_code == 400
    data = response.get_json()
    assert data["status"] == "error"
    assert "URL input exceeds your plan limit" in data["message"]
