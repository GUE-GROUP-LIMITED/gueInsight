import io
import types
from datetime import datetime

import pytest
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.models import AnalysisStatus, AnalysisTransaction, User, UserRole
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
        is_active=True,
        email_verified_at=datetime.utcnow(),
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


class _UploadFormTrue:
    def __init__(self):
        self.file = _Field(None)

    def validate_on_submit(self):
        return True


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


def test_upload_file_success_returns_redirect_payload(client, monkeypatch, tmp_path):
    user = _create_user(email="uploadsuccess@example.com")
    _login(client, email=user.email)

    _patch_upload_runtime(
        monkeypatch,
        client,
        _UploadFormTrue,
        _UrlFormFalse,
        _TextFormFalse,
        max_text_chars=2000,
        max_url_length=400,
    )
    monkeypatch.setattr(subscription_service_module, "get_subscription_status", lambda _: "Freemium")

    import app.src.ingestion.file_ingestion as ingestion_module
    import app.src.analysis.file_analysis as analysis_module

    def _fake_save_uploaded_file(uploaded_file, user_id):
        saved_path = tmp_path / f"user_{user_id}_{uploaded_file.filename}"
        saved_path.write_bytes(uploaded_file.read())
        uploaded_file.seek(0)
        return str(saved_path)

    monkeypatch.setattr(ingestion_module, "save_uploaded_file", _fake_save_uploaded_file)
    monkeypatch.setattr(
        analysis_module.Analyzer,
        "analyze",
        lambda self, file_path: {
            "file_type": "text/plain",
            "metadata": {"size": 12, "last_modified": None},
            "indicators_of_compromise": [],
            "suspicious_patterns": [],
            "alerts_triggered": [],
            "enrichment": {},
            "threat_level": "Low",
        },
    )

    upload_view = client.application.view_functions["users.upload_file"]
    wrapped_upload_view = getattr(upload_view, "__wrapped__", upload_view)
    route_globals = wrapped_upload_view.__globals__
    monkeypatch.setitem(route_globals, "generate_report", lambda _: str(tmp_path / "report.pdf"))
    monkeypatch.setattr(
        route_globals["OutputHandler"],
        "save_to_user_dashboard",
        staticmethod(lambda user_id, report_file, file_path=None: report_file),
        raising=False,
    )

    response = client.post(
        "/upload",
        data={
            "file": (io.BytesIO(b"hello world"), "sample.txt"),
            "source": "manual",
            "confidence": "medium",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["status"] == AnalysisStatus.SUCCESS.value
    assert payload["redirect_url"].startswith("/analysis/")

    tx = AnalysisTransaction.query.filter_by(user_id=user.id, source_type="file").order_by(AnalysisTransaction.id.desc()).first()
    assert tx is not None
    assert tx.status == AnalysisStatus.SUCCESS


def test_upload_file_processing_exception_returns_json_error(client, monkeypatch):
    user = _create_user(email="uploadfailure@example.com")
    _login(client, email=user.email)

    _patch_upload_runtime(
        monkeypatch,
        client,
        _UploadFormTrue,
        _UrlFormFalse,
        _TextFormFalse,
        max_text_chars=2000,
        max_url_length=400,
    )
    monkeypatch.setattr(subscription_service_module, "get_subscription_status", lambda _: "Freemium")

    import app.src.ingestion.file_ingestion as ingestion_module

    def _raise_save_uploaded_file(uploaded_file, user_id):
        raise RuntimeError("ingestion exploded")

    monkeypatch.setattr(ingestion_module, "save_uploaded_file", _raise_save_uploaded_file)

    response = client.post(
        "/upload",
        data={
            "file": (io.BytesIO(b"boom"), "sample.txt"),
            "source": "manual",
            "confidence": "medium",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    payload = response.get_json()
    assert "error" in payload
    assert "Error processing file" in payload["error"]
    assert "ingestion exploded" in payload["error"]

    tx = AnalysisTransaction.query.filter_by(user_id=user.id, source_type="file").order_by(AnalysisTransaction.id.desc()).first()
    assert tx is not None
    assert tx.status == AnalysisStatus.FAILED
    assert "ingestion exploded" in (tx.error_message or "")
