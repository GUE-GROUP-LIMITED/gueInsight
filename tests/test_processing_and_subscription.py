import types
from datetime import datetime, timedelta

import pytest
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.models import AnalysisStatus, Subscription, User, UserRole
from app.src.analysis import file_analysis as fa
from app.src.preprocessing import preprocess as pp
from app.subscription_service import (
    SubscriptionService,
    get_compliance_level,
    get_subscription_duration,
    get_subscription_status,
    get_tier_info,
)


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


def _create_user(email="unit@example.com", role=UserRole.USER):
    user = User(
        email=email,
        password=generate_password_hash("password"),
        first_name="Unit",
        last_name="Tester",
        phone_number="+1234567890",
        role=role,
    )
    db.session.add(user)
    db.session.commit()
    return user


def test_preprocess_and_clean_text_basics():
    assert pp.preprocess_text("  HeLLo!!!  ") == "hello"
    assert pp.preprocess_cloud_link("HTTP://Example.COM/A?x=1") == "httpexamplecomax1"
    assert pp.clean_text("  A-B_C!  ") == "abc"


def test_preprocess_file_reads_and_cleans(tmp_path):
    p = tmp_path / "sample.txt"
    p.write_text("Hello, WORLD!!!")
    assert pp.preprocess_file(str(p)) == "hello world"


def test_entropy_and_hash(tmp_path):
    p = tmp_path / "bytes.bin"
    p.write_bytes(b"abcabcabc")
    entropy = pp.calculate_entropy(str(p))
    digest = pp.generate_file_hash(str(p))
    assert entropy > 0
    assert len(digest) == 64


def test_ioc_extractors_and_keywords():
    texts = [
        "contact me@a.com from 1.2.3.4 and visit https://example.com",
        "send bitcoin to 1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    ]
    assert "me@a.com" in pp.extract_email_addresses(texts)
    assert "1.2.3.4" in pp.extract_ip_addresses(texts)
    assert any(url.startswith("https://") for url in pp.extract_urls(texts))
    assert pp.extract_bitcoin_addresses(texts)
    counts = pp.extract_keywords(texts, keywords=["bitcoin", "visit"])
    assert counts["bitcoin"] >= 1
    assert counts["visit"] >= 1


def test_extract_iocs_dict_structure():
    result = pp.extract_iocs("ip 8.8.8.8 hash d41d8cd98f00b204e9800998ecf8427e url https://a.com")
    assert "ip" in result
    assert "hash" in result
    assert "url" in result


def test_ingest_uploaded_files_text_only(tmp_path):
    p = tmp_path / "log.txt"
    p.write_text("email a@b.com and ip 9.9.9.9")
    out = pp.ingest_uploaded_files([str(p)])
    assert out["texts"]
    assert "a@b.com" in out["emails"]
    assert "9.9.9.9" in out["ip_addresses"]


def test_ingest_uploaded_files_missing_file(app):
    with app.app_context():
        out = pp.ingest_uploaded_files(["does-not-exist.txt"])
    assert out["texts"] == []


def test_analyzer_text_helpers(tmp_path):
    txt = tmp_path / "evidence.txt"
    txt.write_text("exec eval and url https://x.io from 1.1.1.1")

    a = fa.Analyzer()
    assert a.get_file_extension(str(txt)) == "txt"
    assert a.get_file_type(str(txt))
    metadata = a.get_file_metadata(str(txt))
    assert metadata["size"] > 0
    content = a.extract_text_from_txt(str(txt))
    assert "exec" in content
    assert a.detect_suspicious_patterns(content)
    assert a.detect_iocs(content)


def test_analyzer_binary_and_missing_paths(app, tmp_path):
    b = tmp_path / "blob.bin"
    b.write_bytes(b"abc\x00\x01")
    a = fa.Analyzer()
    assert isinstance(a.extract_text_from_binary(str(b)), str)
    with app.app_context():
        assert a.extract_text_from_txt(str(tmp_path / "missing.txt")) == ""


def test_analyzer_analyze_happy_path(monkeypatch, tmp_path):
    p = tmp_path / "doc.txt"
    p.write_text("eval 4.4.4.4 https://ok.com")

    a = fa.Analyzer()
    monkeypatch.setattr(a, "evaluate_alert_rules", lambda content, file_path, results: results)
    out = a.analyze(str(p))
    assert out["file_path"].endswith("doc.txt")
    assert isinstance(out["suspicious_patterns"], list)
    assert isinstance(out["indicators_of_compromise"], list)


def test_analyzer_analyze_error_branch(app, monkeypatch, tmp_path):
    a = fa.Analyzer()
    p = tmp_path / "any.txt"
    p.write_text("ok")
    monkeypatch.setattr(a, "get_file_extension", lambda _: (_ for _ in ()).throw(RuntimeError("boom")))
    with app.app_context():
        out = a.analyze(str(p))
    assert "error" in out


def test_extract_iocs_helpers_in_analysis_module():
    text = "mail x@y.com ip 7.7.7.7 hash d41d8cd98f00b204e9800998ecf8427e https://z.dev"
    iocs = fa.extract_iocs(text)
    assert "ip" in iocs and iocs["ip"]
    assert "hash" in iocs and iocs["hash"]
    assert "url" in iocs and iocs["url"]


def test_extract_features_when_vectorizer_missing(monkeypatch):
    monkeypatch.setattr(fa, "CountVectorizer", None)
    assert fa.extract_features_from_entity(["one", "two"]) == []


def test_train_classifier_missing_sklearn(monkeypatch):
    monkeypatch.setattr(fa, "CountVectorizer", None)
    monkeypatch.setattr(fa, "RandomForestClassifier", None)
    with pytest.raises(RuntimeError):
        fa.train_classifier(["a"], [1])


def test_classify_text_and_analyze_text_for_security_with_mocks(monkeypatch):
    monkeypatch.setattr(
        fa,
        "get_classifier_pipeline",
        lambda: (lambda text, labels: {"labels": labels, "scores": [0.8] * len(labels)}),
    )
    monkeypatch.setattr(
        fa,
        "get_ner_pipeline",
        lambda: (lambda text: [{"word": "entity"}]),
    )
    monkeypatch.setattr(fa, "extract_features_from_entity", lambda entities: [len(entities)])

    cls = fa.classify_text("abc", ["normal"])
    assert cls["labels"] == ["normal"]

    iocs, entities, features, classification = fa.analyze_text_for_security("mail a@b.com")
    assert isinstance(iocs, dict)
    assert entities and entities[0]["word"] == "entity"
    assert features == [1]
    assert "labels" in classification


def test_subscription_service_starter_and_cancel(app):
    user = _create_user("starter@example.com")
    svc = SubscriptionService(user.id)
    msg = svc.create_subscription("starter")
    assert "Starter subscription" in msg
    assert svc.cancel_subscription() is True


def test_subscription_service_invalid_plan_and_missing_user(app):
    user = _create_user("invalidplan@example.com")
    svc = SubscriptionService(user.id)
    with pytest.raises(ValueError):
        svc.create_subscription("nope")

    missing = SubscriptionService(999999)
    with pytest.raises(ValueError):
        missing.create_subscription("starter")


def test_subscription_helpers_and_tier_mapping(app):
    user = _create_user("tier@example.com")
    now = datetime.utcnow()
    sub = Subscription(
        user_id=user.id,
        plan="compliance_pro",
        start_date=now - timedelta(days=1),
        end_date=now + timedelta(days=10),
        is_trial=True,
    )
    db.session.add(sub)
    db.session.commit()

    assert get_tier_info("freemium")["name"] == "Starter"
    assert get_tier_info("compliance_pro")["gdpr_ready"] is True
    assert get_tier_info("unknown") is None

    assert get_subscription_duration(user) >= 0
    assert get_subscription_status(user) in {"Trial", "Premium", "Starter"}
    assert get_compliance_level(user) == "GDPR Article 5"
