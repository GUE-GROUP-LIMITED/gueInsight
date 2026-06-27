"""
User analysis and dashboard routes for file upload, text analysis, and URL inspection.
Extracted from users_routes.py to reduce monolith complexity.
"""
import json
import logging
import io
import csv
import os
import re
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from flask_login import login_required, current_user
import datetime
from flask_mail import Message
from flask import send_file
from itsdangerous import URLSafeTimedSerializer
from app.models import (
    Subscription,
    AnalysisTransaction,
    AnalysisStatus,
    UserActivityEvent,
    db,
)
from app.forms import UploadFileForm, SubmitCloudLinkForm, SubmitTextForm, LogoutForm
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename
from app.config import Config
from app.utils.utils import OutputHandler, generate_report
from app import mail

try:
    from app.integrations.virustotal_integration import check_url as vt_check_url, check_file_hash
except Exception:
    vt_check_url = None
    check_file_hash = None

try:
    from app.integrations.abuseipdb_integration import check_ip as abuseipdb_check_ip
except Exception:
    abuseipdb_check_ip = None

# Import helper functions and constants from parent module
from app.routes import users_routes as ur


def _analysis_results_dir():
    results_dir = os.path.join(current_app.instance_path, 'analysis_results')
    os.makedirs(results_dir, exist_ok=True)
    return results_dir


def _analysis_result_file_path(user_id, analysis_id):
    return os.path.join(_analysis_results_dir(), f'user_{user_id}_analysis_{analysis_id}.json')


def _persist_analysis_payload(user_id, analysis_id, payload):
    file_path = _analysis_result_file_path(user_id, analysis_id)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, default=str)
    return file_path


def _load_analysis_payload(user_id, analysis_id):
    file_path = _analysis_result_file_path(user_id, analysis_id)
    if not os.path.exists(file_path):
        return None
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _looks_like_ip(value):
    return bool(re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", value or ''))


def _looks_like_url(value):
    return bool(re.match(r"^https?://", value or '', re.IGNORECASE))


def _looks_like_domain(value):
    return bool(re.fullmatch(r"(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}", value or ''))


def _looks_like_hash(value):
    return bool(re.fullmatch(r"[A-Fa-f0-9]{32,64}", value or ''))


def _normalize_iocs(raw):
    normalized = []
    if isinstance(raw, dict):
        key_type_map = {
            'ips': 'ip',
            'urls': 'url',
            'emails': 'email',
            'hashes': 'hash',
            'bitcoin_addresses': 'btc',
        }
        for key, values in raw.items():
            ioc_type = key_type_map.get(key, key)
            for value in values or []:
                normalized.append({
                    'type': ioc_type,
                    'value': str(value),
                    'severity': 'Medium',
                })
        return normalized

    if isinstance(raw, list):
        for value in raw:
            if isinstance(value, dict):
                normalized.append({
                    'type': str(value.get('type') or 'indicator').lower(),
                    'value': str(value.get('value') or ''),
                    'severity': value.get('severity') or 'Medium',
                    'description': value.get('description'),
                })
                continue

            item = str(value)
            if _looks_like_ip(item):
                item_type = 'ip'
            elif _looks_like_url(item):
                item_type = 'url'
            elif _looks_like_hash(item):
                item_type = 'hash'
            elif '@' in item:
                item_type = 'email'
            elif _looks_like_domain(item):
                item_type = 'domain'
            else:
                item_type = 'indicator'
            normalized.append({'type': item_type, 'value': item, 'severity': 'Medium'})

    return normalized


def _normalize_patterns(raw):
    patterns = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                patterns.append({
                    'name': item.get('name') or 'Suspicious Pattern',
                    'description': item.get('description') or str(item.get('evidence') or ''),
                    'confidence': float(item.get('confidence') or 0.8),
                    'evidence': item.get('evidence'),
                })
            else:
                patterns.append({
                    'name': 'Suspicious Pattern Match',
                    'description': str(item),
                    'confidence': 0.8,
                    'evidence': str(item),
                })
    return patterns


def _lightweight_indicator_analysis(indicator):
    # Lightweight parsing to avoid expensive model downloads for dashboard interactions.
    iocs = {
        'ips': re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", indicator),
        'urls': re.findall(r"https?://[^\s]+", indicator),
        'emails': re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", indicator),
        'hashes': re.findall(r"\b[A-Fa-f0-9]{32,64}\b", indicator),
        'bitcoin_addresses': re.findall(r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b", indicator),
    }

    patterns = []
    if 'login' in indicator.lower() or 'verify' in indicator.lower() or 'secure' in indicator.lower():
        patterns.append('possible phishing lure keyword')
    if _looks_like_domain(indicator) and '-' in indicator:
        patterns.append('domain contains hyphen; possible typosquatting')

    return {
        'iocs': iocs,
        'suspicious_patterns': patterns,
        'classification_result': {
            'labels': ['phishing', 'normal'],
            'scores': [0.72 if patterns else 0.2, 0.28 if patterns else 0.8],
        },
    }


def _enrich_with_external_tools(indicator, iocs):
    enrichment = {}

    vt_target = None
    if _looks_like_url(indicator):
        vt_target = indicator
    elif _looks_like_domain(indicator):
        vt_target = indicator
    elif _looks_like_hash(indicator):
        vt_target = indicator

    if vt_target and _looks_like_hash(vt_target):
        try:
            if check_file_hash:
                enrichment['virustotal'] = check_file_hash(vt_target)
            else:
                enrichment['virustotal'] = {'status': 'error', 'message': 'VirusTotal integration unavailable'}
        except Exception as e:
            enrichment['virustotal'] = {'status': 'error', 'message': str(e)}
    elif vt_target:
        try:
            if vt_check_url:
                enrichment['virustotal'] = vt_check_url(vt_target)
            else:
                enrichment['virustotal'] = {'status': 'error', 'message': 'VirusTotal integration unavailable'}
        except Exception as e:
            enrichment['virustotal'] = {'status': 'error', 'message': str(e)}

    ip_candidates = [ioc.get('value') for ioc in iocs if ioc.get('type') == 'ip']
    if _looks_like_ip(indicator):
        ip_candidates.append(indicator)
    ip_candidates = list(dict.fromkeys(ip_candidates))[:3]
    if ip_candidates and abuseipdb_check_ip:
        ip = ip_candidates[0]
        try:
            aidb = abuseipdb_check_ip(ip)
            enrichment['abuseipdb'] = {
                'status': aidb.get('status'),
                'ip_address': aidb.get('ip_address'),
                'abuse_score': aidb.get('abuse_confidence_score', 0),
                'total_reports': aidb.get('total_reports', 0),
                'last_reported_at': aidb.get('last_reported_at'),
            }
        except Exception as e:
            enrichment['abuseipdb'] = {'status': 'error', 'message': str(e)}

    return enrichment


def _threat_level_from_score(score):
    if score >= 60:
        return 'High'
    if score >= 30:
        return 'Medium'
    return 'Low'


def _contextual_risk_adjustment(intake):
    if not isinstance(intake, dict):
        return 0

    confidence_weight = {
        'low': -5,
        'medium': 0,
        'high': 8,
    }
    criticality_weight = {
        'low': 0,
        'medium': 4,
        'high': 8,
        'critical': 12,
    }
    network_scope_weight = {
        'internal': 0,
        'external': 6,
        'vpn': 3,
        'cloud': 4,
    }
    source_weight = {
        'manual': 0,
        'email_gateway': 5,
        'edr': 4,
        'siem': 3,
        'firewall': 2,
    }

    adjustment = 0
    adjustment += confidence_weight.get(str(intake.get('confidence') or '').lower(), 0)
    adjustment += criticality_weight.get(str(intake.get('asset_criticality') or '').lower(), 0)
    adjustment += network_scope_weight.get(str(intake.get('network_scope') or '').lower(), 0)
    adjustment += source_weight.get(str(intake.get('source') or '').lower(), 0)

    return max(-10, min(35, adjustment))


def _contextual_risk_factors(intake):
    if not isinstance(intake, dict):
        return []

    factors = []
    confidence = str(intake.get('confidence') or '').lower()
    if confidence == 'high':
        factors.append({'factor': 'confidence', 'value': 'high', 'adjustment': 8})
    elif confidence == 'medium':
        factors.append({'factor': 'confidence', 'value': 'medium', 'adjustment': 0})
    elif confidence == 'low':
        factors.append({'factor': 'confidence', 'value': 'low', 'adjustment': -5})

    criticality = str(intake.get('asset_criticality') or '').lower()
    criticality_map = {'low': 0, 'medium': 4, 'high': 8, 'critical': 12}
    if criticality in criticality_map:
        factors.append({'factor': 'asset_criticality', 'value': criticality, 'adjustment': criticality_map[criticality]})

    network_scope = str(intake.get('network_scope') or '').lower()
    network_scope_map = {'internal': 0, 'external': 6, 'vpn': 3, 'cloud': 4}
    if network_scope in network_scope_map:
        factors.append({'factor': 'network_scope', 'value': network_scope, 'adjustment': network_scope_map[network_scope]})

    source = str(intake.get('source') or '').lower()
    source_map = {'manual': 0, 'email_gateway': 5, 'edr': 4, 'siem': 3, 'firewall': 2}
    if source in source_map:
        factors.append({'factor': 'source', 'value': source, 'adjustment': source_map[source]})

    return factors


def _calculate_threat_score_components(iocs, patterns, enrichment, intake=None):
    base_iocs = min(30, len(iocs) * 5)
    base_patterns = min(30, len(patterns) * 10)
    vt_score = 0
    abuse_score = 0

    vt = enrichment.get('virustotal') or {}
    if isinstance(vt, dict):
        vt_score = min(30, int(vt.get('detections', 0)) * 3)

    aidb = enrichment.get('abuseipdb') or {}
    if isinstance(aidb, dict):
        abuse_score = min(30, int(aidb.get('abuse_score', 0)) // 3)

    context_adjustment = _contextual_risk_adjustment(intake)
    raw_total = base_iocs + base_patterns + vt_score + abuse_score + context_adjustment
    total = max(0, min(100, raw_total))

    return {
        'base_iocs': int(base_iocs),
        'base_patterns': int(base_patterns),
        'enrichment_virustotal': int(vt_score),
        'enrichment_abuseipdb': int(abuse_score),
        'context_adjustment': int(context_adjustment),
        'context_factors': _contextual_risk_factors(intake),
        'total': int(total),
    }


def _calculate_threat_score(iocs, patterns, enrichment, intake=None):
    components = _calculate_threat_score_components(iocs, patterns, enrichment, intake)
    return int(components.get('total', 0))


def _assess_threat_level(iocs, patterns, enrichment, intake=None):
    score = _calculate_threat_score(iocs, patterns, enrichment, intake)
    return _threat_level_from_score(score)


def _detect_indicator_type(value):
    indicator = (value or '').strip()
    if _looks_like_ip(indicator):
        return 'ip'
    if _looks_like_url(indicator):
        return 'url'
    if _looks_like_hash(indicator):
        return 'hash'
    if _looks_like_domain(indicator):
        return 'domain'
    if '@' in indicator:
        return 'email'
    return 'indicator'


def _normalize_threat_intake_payload(payload):
    data = payload if isinstance(payload, dict) else {}
    indicator = str(data.get('indicator') or '').strip()
    if not indicator:
        return None, 'indicator is required'

    source = str(data.get('source') or '').strip().lower()
    allowed_sources = {'manual', 'email_gateway', 'edr', 'siem', 'firewall'}
    if not source:
        return None, 'source is required'
    if source not in allowed_sources:
        return None, 'source must be one of: manual, email_gateway, edr, siem, firewall'

    confidence = str(data.get('confidence') or '').strip().lower()
    if not confidence:
        return None, 'confidence is required'
    if confidence not in {'low', 'medium', 'high'}:
        return None, 'confidence must be one of: low, medium, high'

    indicator_type = str(data.get('indicator_type') or '').strip().lower() or _detect_indicator_type(indicator)
    first_seen_at = str(data.get('first_seen_at') or '').strip() or None
    asset_name = str(data.get('asset_name') or '').strip() or None
    asset_criticality = str(data.get('asset_criticality') or '').strip().lower() or None
    account_ref = str(data.get('account_ref') or '').strip() or None
    network_scope = str(data.get('network_scope') or '').strip().lower() or None
    notes = str(data.get('notes') or '').strip() or None

    related_artifacts = data.get('related_artifacts') or []
    if isinstance(related_artifacts, str):
        related_artifacts = [part.strip() for part in related_artifacts.split(',') if part.strip()]
    if not isinstance(related_artifacts, list):
        related_artifacts = []

    return {
        'indicator': indicator,
        'indicator_type': indicator_type,
        'source': source,
        'confidence': confidence,
        'first_seen_at': first_seen_at,
        'asset_name': asset_name,
        'asset_criticality': asset_criticality,
        'account_ref': account_ref,
        'network_scope': network_scope,
        'notes': notes,
        'related_artifacts': [str(item).strip() for item in related_artifacts if str(item).strip()][:25],
    }, None


def _analysis_share_serializer():
    secret = current_app.config.get('SECRET_KEY') or 'dev-secret-key'
    return URLSafeTimedSerializer(secret, salt='analysis-share')


def _wrap_text(text, max_width):
    """Wrap text into lines of maximum width."""
    words = text.split()
    lines = []
    current_line = []
    current_length = 0
    
    for word in words:
        if current_length + len(word) + 1 > max_width:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
            current_length = len(word)
        else:
            current_line.append(word)
            current_length += len(word) + 1
    
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines


def _generate_threat_insights(indicator, iocs, patterns, enrichment, threat_level):
    """Generate human-readable threat insights and recommendations."""
    insights = {
        'summary': '',
        'severity_rationale': '',
        'recommendations': [],
        'indicators_summary': '',
    }

    ioc_count = len(iocs)
    pattern_count = len(patterns)

    if threat_level == 'High':
        insights['summary'] = f"This indicator demonstrates HIGH threat potential with {ioc_count} extracted indicators and {pattern_count} suspicious pattern(s) detected."
        insights['severity_rationale'] = 'High severity assigned due to multiple indicators of compromise and suspicious behavioral patterns.'
        insights['recommendations'] = [
            '­ƒÜ¿ Immediate Action: Block this indicator across all security controls',
            '­ƒôï Document incident for compliance and audit trail',
            '­ƒöö Alert relevant stakeholders and incident response team',
            '­ƒöì Investigate any historical interactions with this indicator',
        ]
    elif threat_level == 'Medium':
        insights['summary'] = f"This indicator shows MEDIUM threat with {ioc_count} indicator(s) and {pattern_count} suspicious pattern(s)."
        insights['severity_rationale'] = 'Medium severity due to mixed signals: some suspicious patterns detected but not consistently malicious.'
        insights['recommendations'] = [
            'ÔÜá´©Å Enhanced Monitoring: Increase monitoring frequency for this indicator',
            '­ƒôè Collect More Data: Gather additional context before blocking',
            '­ƒöù Correlate: Check against threat intelligence feeds',
            'ÔÅ▒´©Å Review: Reassess in 24-48 hours',
        ]
    else:
        insights['summary'] = f"This indicator shows LOW threat level with minimal indicators detected."
        insights['severity_rationale'] = 'Low severity: limited indicators and patterns suggest this may be benign or low-risk.'
        insights['recommendations'] = [
            'Ô£ô No Immediate Action Required',
            '­ƒôØ Log for historical reference',
            '­ƒöä Periodic Review: Monitor in routine scans',
        ]

    if ioc_count > 0:
        insights['indicators_summary'] = f"{ioc_count} indicator(s) extracted: {', '.join([ioc['value'][:50] for ioc in iocs[:3]])}"
    else:
        insights['indicators_summary'] = 'No direct indicators extracted, but behavioral patterns detected.'

    return insights


def _get_company_branding(user_id):
    """Fetch company branding info (logo, name, details) for user."""
    from app.models import UserPreference
    pref = UserPreference.query.filter_by(user_id=user_id).first()
    if pref and pref.company_logo_url and pref.company_name:
        return {
            'company_name': pref.company_name,
            'company_logo_url': pref.company_logo_url,
            'company_address': pref.company_address,
            'company_contact': pref.company_contact,
        }
    return {
        'company_name': 'GueInsight',
        'company_logo_url': None,
        'company_address': 'Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium',
        'company_contact': 'info@guecyber.com',
    }


def _build_analysis_response(tx, payload, include_user=True, include_insights=True):
    iocs = payload.get('indicators_of_compromise') or []
    patterns = payload.get('suspicious_patterns') or []
    enrichment = payload.get('enrichment') or {}
    intake = payload.get('intake') or {}
    score_breakdown = payload.get('threat_score_breakdown')
    if not isinstance(score_breakdown, dict):
        score_breakdown = _calculate_threat_score_components(iocs, patterns, enrichment, intake)

    threat_score = int(payload.get('threat_score') or score_breakdown.get('total') or _calculate_threat_score(iocs, patterns, enrichment, intake))
    threat_level = payload.get('threat_level') or _threat_level_from_score(threat_score)

    response = {
        'analysis_id': tx.id,
        'indicator': payload.get('indicator') or tx.input_ref,
        'file_path': payload.get('file_path') or tx.input_ref,
        'file_type': payload.get('file_type') or tx.source_type,
        'analysis_date': (tx.completed_at or tx.created_at).isoformat() if (tx.completed_at or tx.created_at) else None,
        'status': tx.status.value if hasattr(tx.status, 'value') else str(tx.status),
        'threat_score': threat_score,
        'threat_score_breakdown': score_breakdown,
        'threat_level': threat_level,
        'metadata': payload.get('metadata') or {
            'size': tx.input_size_bytes or 0,
            'last_modified': None,
        },
        'indicators_of_compromise': iocs,
        'suspicious_patterns': patterns,
        'alerts_triggered': payload.get('alerts_triggered') or [],
        'enrichment': enrichment,
        'intake': intake,
    }

    if include_user:
        user = ur.User.query.filter_by(id=tx.user_id).first()
        pref = getattr(user, 'preference', None) if user else None
        response['analyzed_by'] = {
            'user_id': tx.user_id,
            'user_name': f"{user.first_name} {user.last_name}" if user else 'Unknown',
            'user_email': user.email if user else 'unknown@gueinsight.com',
            'company': getattr(pref, 'company_name', None),
        }
        branding = _get_company_branding(tx.user_id)
        response['company_branding'] = branding

    if include_insights:
        response['insights'] = _generate_threat_insights(
            payload.get('indicator'),
            iocs,
            patterns,
            enrichment,
            threat_level
        )

    return response


def register_analysis_routes(users_bp):
    """Register dashboard and analysis endpoints to user blueprint."""
    
    @users_bp.route('/user_dashboard', methods=['GET', 'POST'])
    @login_required
    def user_dashboard():
        
        # Initialize the forms
        file_upload_form = UploadFileForm()
        url_submission_form = SubmitCloudLinkForm()
        text_submission_form = SubmitTextForm()
       
        # Get the user's subscription
        subscription = Subscription.query.filter_by(user_id=current_user.id).first()
        logout_form = LogoutForm()

        # Determine subscription status
        subscription_status = 'Freemium'  # Default status

        if subscription:
            if getattr(subscription, 'is_trial', False):
                subscription_status = 'Trial'
            elif getattr(subscription, 'is_active', False):
                subscription_status = 'Premium'

        # Render the dashboard template with the necessary data
        return render_template(
            'users/userbase.html',
            upload_form=file_upload_form,
            cloud_form=url_submission_form,
            text_form=text_submission_form,
            subscription_status=subscription_status,
            logout_form=logout_form
        )


    @users_bp.route('/upload', methods=['POST'])
    @login_required
    def upload_file():
        def _error(message, status_code=400, **extra):
            payload = {'error': message}
            payload.update(extra)
            return jsonify(payload), status_code

        # Get the form data already passed from the dashboard
        file_upload_form = UploadFileForm()
        url_submission_form = SubmitCloudLinkForm()
        text_submission_form = SubmitTextForm()

        # Initialize the SubscriptionService to get subscription details
        from app.subscription_service import SubscriptionService, get_subscription_status as resolve_subscription_status
        subscription_service = SubscriptionService(current_user.id)
        subscription_status = resolve_subscription_status(current_user)
        subscription = subscription_service.subscription
        plan_key = ur._get_active_plan_key(current_user.id)
        analysis_limits = ur._get_analysis_limits_for_plan(plan_key) or {}
        max_file_size_mb = int(analysis_limits.get('max_file_size_mb') or 2)
        max_url_length = int(analysis_limits.get('max_url_length') or 300)
        max_text_chars = int(analysis_limits.get('max_text_chars') or 10000)
        max_items_per_analysis = int(analysis_limits.get('max_items_per_analysis') or 5)
        subscription_plan = getattr(subscription, 'plan', None) or plan_key or 'free'

        # Check the subscription status and upload limits
        if subscription_status == "Inactive" or subscription_status == "Expired":
            return _error("Your subscription is inactive or expired. Please renew your subscription.", 403)

        # Determine upload limits by active plan key (new + legacy plan names).
        effective_plan = (plan_key or subscription_plan or 'free').lower()
        plan_upload_limits = {
            'free': 1,
            'starter': 4,
            'compliance_pro': 6,
            'enterprise_professional': 10,
            'enterprise_risk': 15,
            'enterprise_elite': 25,
            # Legacy plans
            'premium_individual': 4,
            'premium_small_business': 6,
            'premium_large_business': 10,
        }
        upload_limit = plan_upload_limits.get(effective_plan, 4)

        # Count the user's uploads in the current month
        current_month = datetime.datetime.now().month
        upload_count = OutputHandler.count_uploads_in_month(current_user.id, current_month)

        # Check if the user has exceeded the allowed number of uploads
        if upload_count >= upload_limit:
            return _error(
                f"You've exceeded your upload limit of {upload_limit} uploads for this month.",
                429,
                upload_limit=upload_limit,
            )

        # Handle File Upload
        uploaded_file = file_upload_form.file.data or request.files.get('file')
        if uploaded_file:
            file_analysis_started_at = ur._utc_now()

            source = str(request.form.get('source') or '').strip().lower()
            allowed_sources = {'manual', 'email_gateway', 'edr', 'siem', 'firewall'}
            if not source:
                return _error('source is required', 400)
            if source not in allowed_sources:
                return _error('source must be one of: manual, email_gateway, edr, siem, firewall', 400)

            confidence = str(request.form.get('confidence') or '').strip().lower()
            if not confidence:
                return _error('confidence is required', 400)
            if confidence not in {'low', 'medium', 'high'}:
                return _error('confidence must be one of: low, medium, high', 400)

            related_artifacts_raw = str(request.form.get('related_artifacts') or '').strip()
            intake_context = {
                'source': source,
                'confidence': confidence,
                'first_seen_at': str(request.form.get('first_seen_at') or '').strip() or None,
                'asset_name': str(request.form.get('asset_name') or '').strip() or None,
                'asset_criticality': str(request.form.get('asset_criticality') or '').strip().lower() or None,
                'account_ref': str(request.form.get('account_ref') or '').strip() or None,
                'network_scope': str(request.form.get('network_scope') or '').strip().lower() or None,
                'notes': str(request.form.get('notes') or '').strip() or None,
                'related_artifacts': [part.strip() for part in related_artifacts_raw.split(',') if part.strip()][:25],
            }

            # Check the file type
            allowed_extensions = Config.ALLOWED_EXTENSIONS  # Get allowed file types from config
            file_extension = secure_filename(uploaded_file.filename).split('.')[-1].lower()

            if file_extension not in allowed_extensions:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    error_message='Invalid file type.',
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                return _error("Invalid file type. Please upload a valid file.", 400)

            # Check if the file size is within both global and plan-specific limits.
            file_size_bytes = len(uploaded_file.read())
            max_plan_file_size_bytes = max_file_size_mb * 1024 * 1024
            max_allowed_bytes = min(Config.MAX_CONTENT_LENGTH, max_plan_file_size_bytes)
            if file_size_bytes > max_allowed_bytes:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    error_message='File exceeds plan limit.',
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                return _error(
                    f"File exceeds your plan limit of {max_file_size_mb}MB per analysis.",
                    413,
                    max_file_size_mb=max_file_size_mb,
                )

            # Reset the file pointer after checking the size
            uploaded_file.seek(0)


            try:
                from app.src.ingestion.file_ingestion import save_uploaded_file
                file_path = save_uploaded_file(uploaded_file, current_user.id)

                from app.src.analysis.file_analysis import Analyzer
                analyzer = Analyzer()
                analysis_results = analyzer.analyze(file_path)

                report_file = generate_report(analysis_results)
                OutputHandler.save_to_user_dashboard(current_user.id, report_file, file_path)

                completed_at = ur._utc_now()
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=file_path,
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    processing_ms=max(1, int((completed_at - file_analysis_started_at).total_seconds() * 1000)),
                    result_summary='File analysis completed successfully.',
                    created_at=file_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(file_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.file.success',
                    description='Completed a file analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'file', 'status': 'success'},
                )
                db.session.commit()

                iocs = _normalize_iocs(analysis_results.get('indicators_of_compromise') or analysis_results.get('iocs') or [])
                patterns = _normalize_patterns(analysis_results.get('suspicious_patterns') or [])
                enrichment = analysis_results.get('enrichment') or {}
                threat_score_breakdown = _calculate_threat_score_components(iocs, patterns, enrichment, intake_context)
                threat_score = int(threat_score_breakdown.get('total', 0))
                threat_level = analysis_results.get('threat_level') or _threat_level_from_score(threat_score)

                analysis_payload = {
                    'file_path': file_path,
                    'file_type': analysis_results.get('file_type') or file_extension,
                    'metadata': analysis_results.get('metadata') or {
                        'size': file_size_bytes,
                        'last_modified': None,
                    },
                    'indicators_of_compromise': iocs,
                    'suspicious_patterns': patterns,
                    'alerts_triggered': analysis_results.get('alerts_triggered') or [],
                    'enrichment': enrichment,
                    'threat_score': threat_score,
                    'threat_score_breakdown': threat_score_breakdown,
                    'threat_level': threat_level,
                    'intake': intake_context,
                    'report_link': report_file,
                }
                _persist_analysis_payload(current_user.id, file_tx.id, analysis_payload)

                response_payload = _build_analysis_response(file_tx, analysis_payload)
                response_payload['redirect_url'] = f'/analysis/{file_tx.id}'
                response_payload['report_link'] = report_file
                return jsonify(response_payload), 201

            except Exception as e:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    error_message=str(e),
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                return jsonify({'error': f'Error processing file: {str(e)}'}), 500


        # Handle URL Submission

        elif url_submission_form.validate_on_submit() and url_submission_form.cloud_link.data:
            cloud_link = url_submission_form.cloud_link.data
            url_analysis_started_at = ur._utc_now()
            if len(cloud_link) > max_url_length:
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    error_message='URL exceeds plan input length limit.',
                    created_at=url_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(url_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"URL input exceeds your plan limit of {max_url_length} characters per analysis."
                    )
                }), 400
            try:
                # Threat intelligence enrichment
                from app.integrations.rapidapi import enrich_url
                enrichment = enrich_url(cloud_link)
                # Process the cloud link (analysis)
                from app.src.analysis.file_analysis import analyze_cloud_link
                analysis_results = analyze_cloud_link(cloud_link)

                completed_at = ur._utc_now()
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    processing_ms=max(1, int((completed_at - url_analysis_started_at).total_seconds() * 1000)),
                    result_summary='URL analysis completed successfully.',
                    created_at=url_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(url_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.url.success',
                    description='Completed a URL analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'url', 'status': 'success'},
                )
                db.session.commit()
                return jsonify({
                    'status': 'success',
                    'message': 'Cloud link processed successfully.',
                    'enrichment': enrichment,
                    'results': analysis_results
                })

            except Exception as e:
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    error_message=str(e),
                    created_at=url_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(url_tx)
                db.session.commit()
                return _error(f"Error processing cloud link: {str(e)}", 500)

        # Handle Text/Hash Submission

        elif text_submission_form.validate_on_submit() and text_submission_form.pasted_input.data:
            input_data = text_submission_form.pasted_input.data
            text_analysis_started_at = ur._utc_now()
            input_length = len(input_data)
            analysis_item_count = ur._count_analysis_items(input_data)

            if input_length > max_text_chars:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message='Text exceeds plan input length limit.',
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"Text input exceeds your plan limit of {max_text_chars} characters per analysis."
                    )
                }), 400

            if analysis_item_count > max_items_per_analysis:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message='Input item count exceeds plan limit.',
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"This request has {analysis_item_count} items, but your plan allows "
                        f"up to {max_items_per_analysis} items per analysis."
                    )
                }), 400
            try:
                # Threat intelligence enrichment (try as hash, IP, or URL)
                from app.integrations.rapidapi import enrich_event
                enrichment = enrich_event({'hash': input_data, 'ip': input_data, 'url': input_data})
                # Process the text/hash input (analysis)
                from app.src.analysis.file_analysis import analyze_text_for_security
                analysis_results = analyze_text_for_security(input_data)

                completed_at = ur._utc_now()
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    processing_ms=max(1, int((completed_at - text_analysis_started_at).total_seconds() * 1000)),
                    result_summary='Text analysis completed successfully.',
                    created_at=text_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(text_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.text.success',
                    description='Completed a text analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'text', 'status': 'success'},
                )
                db.session.commit()
                return jsonify({
                    'status': 'success',
                    'message': 'Text processed successfully.',
                    'enrichment': enrichment,
                    'results': analysis_results
                })

            except Exception as e:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message=str(e),
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                return _error(f"Error processing text input: {str(e)}", 500)

        # If no valid submission, return an API-friendly error for the SPA uploader.
        return _error('Please submit a valid file, text, or URL.', 400)

    @users_bp.route('/api/analysis/submit', methods=['POST'])
    @login_required
    def api_submit_analysis():
        payload = request.get_json(silent=True) or {}
        indicator = (payload.get('indicator') or '').strip()

        if not indicator:
            return {'error': 'indicator is required'}, 400

        plan_key = ur._get_active_plan_key(current_user.id)
        limits = ur._get_analysis_limits_for_plan(plan_key)
        item_count = ur._count_analysis_items(indicator)

        if len(indicator) > limits['max_text_chars']:
            return {'error': f"Input exceeds plan limit of {limits['max_text_chars']} characters."}, 400
        if item_count > limits['max_items_per_analysis']:
            return {'error': f"Input has {item_count} items; plan max is {limits['max_items_per_analysis']}."}, 400

        started_at = ur._utc_now()
        tx = AnalysisTransaction(
            user_id=current_user.id,
            source_type='text',
            input_ref=indicator[:500],
            status=AnalysisStatus.SUCCESS,
            plan_at_time=plan_key,
            items_count=item_count,
            input_size_bytes=len(indicator.encode('utf-8')),
            created_at=started_at,
            completed_at=ur._utc_now(),
        )
        db.session.add(tx)
        db.session.flush()

        lightweight = _lightweight_indicator_analysis(indicator)
        iocs = _normalize_iocs(lightweight.get('iocs'))
        patterns = _normalize_patterns(lightweight.get('suspicious_patterns'))
        enrichment = _enrich_with_external_tools(indicator, iocs)
        threat_score_breakdown = _calculate_threat_score_components(iocs, patterns, enrichment)
        threat_score = int(threat_score_breakdown.get('total', 0))
        threat_level = _threat_level_from_score(threat_score)

        analysis_payload = {
            'indicator': indicator,
            'file_type': 'text/plain',
            'metadata': {
                'size': len(indicator.encode('utf-8')),
                'last_modified': None,
            },
            'indicators_of_compromise': iocs,
            'suspicious_patterns': patterns,
            'alerts_triggered': [],
            'enrichment': enrichment,
            'threat_score': threat_score,
            'threat_score_breakdown': threat_score_breakdown,
            'threat_level': threat_level,
        }

        tx.processing_ms = max(1, int((ur._utc_now() - started_at).total_seconds() * 1000))
        tx.result_summary = json.dumps({
            'threat_level': threat_level,
            'threat_score': threat_score,
            'ioc_count': len(iocs),
            'pattern_count': len(patterns),
        })[:1900]
        db.session.commit()

        _persist_analysis_payload(current_user.id, tx.id, analysis_payload)
        ur._log_user_activity(
            current_user.id,
            event_type='analysis.text.success',
            description='Completed indicator analysis via API.',
            entity_type='analysis_transaction',
            entity_id=tx.id,
            metadata={'source_type': 'text', 'status': 'success'},
        )
        db.session.commit()

        return {
            'status': 'success',
            'analysisId': tx.id,
            'threat_score': threat_score,
            'threat_score_breakdown': threat_score_breakdown,
            'threat_level': threat_level,
            'ioc_count': len(iocs),
            'pattern_count': len(patterns),
            'redirect_url': f'/analysis/{tx.id}',
        }, 201

    @users_bp.route('/api/threat-intel/intake', methods=['POST'])
    @login_required
    def api_threat_intel_intake():
        payload = request.get_json(silent=True) or {}
        normalized, error = _normalize_threat_intake_payload(payload)
        if error:
            return {'error': error}, 400

        indicator = normalized['indicator']
        plan_key = ur._get_active_plan_key(current_user.id)
        limits = ur._get_analysis_limits_for_plan(plan_key)
        item_count = ur._count_analysis_items(indicator)

        if len(indicator) > limits['max_text_chars']:
            return {'error': f"Input exceeds plan limit of {limits['max_text_chars']} characters."}, 400
        if item_count > limits['max_items_per_analysis']:
            return {'error': f"Input has {item_count} items; plan max is {limits['max_items_per_analysis']}."}, 400

        started_at = ur._utc_now()
        tx = AnalysisTransaction(
            user_id=current_user.id,
            source_type='text',
            input_ref=indicator[:500],
            status=AnalysisStatus.SUCCESS,
            plan_at_time=plan_key,
            items_count=item_count,
            input_size_bytes=len(indicator.encode('utf-8')),
            created_at=started_at,
            completed_at=ur._utc_now(),
        )
        db.session.add(tx)
        db.session.flush()

        lightweight = _lightweight_indicator_analysis(indicator)
        iocs = _normalize_iocs(lightweight.get('iocs'))
        patterns = _normalize_patterns(lightweight.get('suspicious_patterns'))
        enrichment = _enrich_with_external_tools(indicator, iocs)
        threat_score_breakdown = _calculate_threat_score_components(iocs, patterns, enrichment, normalized)
        threat_score = int(threat_score_breakdown.get('total', 0))
        threat_level = _threat_level_from_score(threat_score)

        analysis_payload = {
            'indicator': indicator,
            'file_type': 'text/plain',
            'metadata': {
                'size': len(indicator.encode('utf-8')),
                'last_modified': None,
            },
            'indicators_of_compromise': iocs,
            'suspicious_patterns': patterns,
            'alerts_triggered': [],
            'enrichment': enrichment,
            'threat_score': threat_score,
            'threat_score_breakdown': threat_score_breakdown,
            'threat_level': threat_level,
            'intake': normalized,
        }

        tx.processing_ms = max(1, int((ur._utc_now() - started_at).total_seconds() * 1000))
        tx.result_summary = json.dumps({
            'threat_level': threat_level,
            'threat_score': threat_score,
            'ioc_count': len(iocs),
            'pattern_count': len(patterns),
            'indicator_type': normalized.get('indicator_type'),
            'confidence': normalized.get('confidence'),
            'source': normalized.get('source'),
        })[:1900]
        db.session.commit()

        _persist_analysis_payload(current_user.id, tx.id, analysis_payload)
        ur._log_user_activity(
            current_user.id,
            event_type='analysis.threat_intel.intake.success',
            description='Completed threat-intel intake analysis via API.',
            entity_type='analysis_transaction',
            entity_id=tx.id,
            metadata={
                'source_type': 'text',
                'status': 'success',
                'indicator_type': normalized.get('indicator_type'),
                'source': normalized.get('source'),
            },
        )
        db.session.commit()

        return {
            'status': 'success',
            'analysisId': tx.id,
            'threat_score': threat_score,
            'threat_score_breakdown': threat_score_breakdown,
            'threat_level': threat_level,
            'ioc_count': len(iocs),
            'pattern_count': len(patterns),
            'redirect_url': f'/analysis/{tx.id}',
            'intake': {
                'indicator_type': normalized.get('indicator_type'),
                'source': normalized.get('source'),
                'confidence': normalized.get('confidence'),
            },
        }, 201

    @users_bp.route('/api/analysis/<int:analysis_id>', methods=['GET'])
    @login_required
    def api_get_analysis(analysis_id):
        tx = AnalysisTransaction.query.filter_by(id=analysis_id, user_id=current_user.id).first()
        if not tx:
            return {'error': 'Analysis not found.'}, 404

        payload = _load_analysis_payload(current_user.id, analysis_id) or {}
        return jsonify(_build_analysis_response(tx, payload))

    @users_bp.route('/api/analysis/<int:analysis_id>/download', methods=['GET'])
    @login_required
    def api_download_analysis(analysis_id):
        tx = AnalysisTransaction.query.filter_by(id=analysis_id, user_id=current_user.id).first()
        if not tx:
            return {'error': 'Analysis not found.'}, 404

        payload = _load_analysis_payload(current_user.id, analysis_id) or {}
        response_payload = _build_analysis_response(tx, payload)
        format_name = (request.args.get('format') or 'pdf').strip().lower()

        if format_name == 'json':
            body = json.dumps(response_payload, indent=2, default=str)
            return current_app.response_class(
                body,
                mimetype='application/json',
                headers={'Content-Disposition': f'attachment; filename=analysis-{analysis_id}.json'},
            )

        if format_name == 'csv':
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(['section', 'key', 'value'])
            
            # Header and branding info
            branding = response_payload.get('company_branding') or {}
            analyzed_by = response_payload.get('analyzed_by') or {}
            
            writer.writerow(['branding', 'company_name', branding.get('company_name') or 'GueInsight'])
            writer.writerow(['branding', 'company_contact', branding.get('company_contact') or ''])
            writer.writerow(['branding', 'company_address', branding.get('company_address') or ''])
            writer.writerow(['analyzed_by', 'user_name', analyzed_by.get('user_name') or 'Unknown'])
            writer.writerow(['analyzed_by', 'user_email', analyzed_by.get('user_email') or ''])
            writer.writerow(['analyzed_by', 'timestamp', response_payload.get('analysis_date') or ''])
            
            # Summary
            writer.writerow(['summary', 'analysis_id', analysis_id])
            writer.writerow(['summary', 'indicator', response_payload.get('indicator')])
            writer.writerow(['summary', 'threat_level', response_payload.get('threat_level')])
            writer.writerow(['summary', 'analysis_date', response_payload.get('analysis_date')])
            writer.writerow(['summary', 'file_type', response_payload.get('file_type')])
            
            # Insights
            insights = response_payload.get('insights') or {}
            if insights:
                writer.writerow(['insights', 'summary', insights.get('summary') or ''])
                writer.writerow(['insights', 'severity_rationale', insights.get('severity_rationale') or ''])
                for idx, rec in enumerate(insights.get('recommendations') or []):
                    writer.writerow(['insights', f'recommendation_{idx}', rec])
            
            # IoCs
            for idx, ioc in enumerate(response_payload.get('indicators_of_compromise') or []):
                writer.writerow(['ioc', f'{idx}.type', ioc.get('type')])
                writer.writerow(['ioc', f'{idx}.value', ioc.get('value')])
                writer.writerow(['ioc', f'{idx}.severity', ioc.get('severity')])
            
            # Patterns
            for idx, pattern in enumerate(response_payload.get('suspicious_patterns') or []):
                writer.writerow(['pattern', f'{idx}.name', pattern.get('name')])
                writer.writerow(['pattern', f'{idx}.confidence', pattern.get('confidence')])
                writer.writerow(['pattern', f'{idx}.description', pattern.get('description')])
            
            return current_app.response_class(
                buf.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename=analysis-{analysis_id}.csv'},
            )

        # PDF default
        pdf_bytes = io.BytesIO()
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.colors import HexColor, black
            from reportlab.pdfgen import canvas

            c = canvas.Canvas(pdf_bytes, pagesize=letter)
            width, height = letter
            y = height - 40

            branding = response_payload.get('company_branding') or {}
            analyzed_by = response_payload.get('analyzed_by') or {}
            insights = response_payload.get('insights') or {}
            threat_level = response_payload.get('threat_level') or 'Unknown'

            c.setFont('Helvetica-Bold', 16)
            c.drawString(40, y, 'Security Analysis Report')
            y -= 16
            c.setFont('Helvetica', 9)
            c.drawString(40, y, f"Generated through GueInsight platform for: {branding.get('company_name') or 'GueInsight'}")
            y -= 20

            c.setFont('Helvetica', 9)
            c.drawString(40, y, f"Analysis ID: {analysis_id}")
            y -= 12
            c.drawString(40, y, f"Indicator: {response_payload.get('indicator')}")
            y -= 12
            c.drawString(40, y, f"Analysis Date: {response_payload.get('analysis_date')}")
            y -= 12
            c.drawString(40, y, f"Analyzed By: {analyzed_by.get('user_name', 'Unknown')} ({analyzed_by.get('user_email', 'unknown@gueinsight.com')})")
            y -= 16

            threat_color_map = {'High': HexColor('#dc3545'), 'Medium': HexColor('#d68c00'), 'Low': HexColor('#1f8f43')}
            c.setFillColor(threat_color_map.get(threat_level, black))
            c.setFont('Helvetica-Bold', 11)
            c.drawString(40, y, f"Threat Level: {threat_level}")
            c.setFillColor(black)
            y -= 18

            c.setFont('Helvetica-Bold', 10)
            c.drawString(40, y, 'Threat Insight')
            y -= 12
            c.setFont('Helvetica', 9)
            for line in _wrap_text(insights.get('summary', 'No summary available.'), 95):
                c.drawString(40, y, line)
                y -= 11
                if y < 80:
                    c.showPage()
                    y = height - 40
                    c.setFont('Helvetica', 9)

            y -= 8
            c.setFont('Helvetica-Bold', 10)
            c.drawString(40, y, 'Recommended Actions')
            y -= 12
            c.setFont('Helvetica', 9)
            for rec in (insights.get('recommendations') or [])[:5]:
                for line in _wrap_text(f"- {rec}", 95):
                    c.drawString(40, y, line)
                    y -= 11
                    if y < 80:
                        c.showPage()
                        y = height - 40
                        c.setFont('Helvetica', 9)

            y -= 8
            c.setFont('Helvetica-Bold', 10)
            c.drawString(40, y, 'Indicators of Compromise')
            y -= 12
            c.setFont('Helvetica', 9)
            iocs = response_payload.get('indicators_of_compromise') or []
            if not iocs:
                c.drawString(40, y, '- None detected')
                y -= 11
            for ioc in iocs[:20]:
                line = f"- [{ioc.get('type')}] {ioc.get('value')} ({ioc.get('severity')})"
                for part in _wrap_text(line, 95):
                    c.drawString(40, y, part)
                    y -= 11
                    if y < 80:
                        c.showPage()
                        y = height - 40
                        c.setFont('Helvetica', 9)

            c.setFont('Helvetica', 7)
            c.drawString(40, 30, f"Platform: GueInsight | Company: {branding.get('company_name') or 'GueInsight'}")

            c.save()
            pdf_bytes.seek(0)
            return send_file(
                pdf_bytes,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'analysis-{analysis_id}.pdf',
            )
        except Exception as e:
            current_app.logger.warning('PDF generation failed for analysis %s: %s', analysis_id, e)
            fallback = io.BytesIO(json.dumps(response_payload, indent=2, default=str).encode('utf-8'))
            return send_file(
                fallback,
                mimetype='application/json',
                as_attachment=True,
                download_name=f'analysis-{analysis_id}.json',
            )

    @users_bp.route('/api/analysis/<int:analysis_id>/share', methods=['POST'])
    @login_required
    def api_share_analysis(analysis_id):
        tx = AnalysisTransaction.query.filter_by(id=analysis_id, user_id=current_user.id).first()
        if not tx:
            return {'error': 'Analysis not found.'}, 404

        payload = request.get_json(silent=True) or {}
        method = str(payload.get('method') or '').strip().lower()
        if method not in {'email', 'link'}:
            return {'error': 'method must be one of: email, link'}, 400

        token = _analysis_share_serializer().dumps({
            'analysis_id': analysis_id,
            'owner_user_id': current_user.id,
        })
        share_url = url_for('users.api_get_shared_analysis', token=token, _external=False)

        if method == 'email':
            recipient = (payload.get('email') or '').strip()
            if not recipient:
                return {'error': 'email is required for email share'}, 400

            subject = f'GueInsight Analysis Report #{analysis_id}'
            body = (
                'A security analysis report has been shared with you.\n\n'
                f"Open report: {request.host_url.rstrip('/')}{share_url}\n"
            )
            email_sent = False
            error_message = None
            try:
                msg = Message(subject=subject, recipients=[recipient], body=body)
                mail.send(msg)
                email_sent = True
            except Exception as e:
                error_message = str(e)
                current_app.logger.warning('Failed sending shared analysis email: %s', e)

            ur._log_user_activity(
                current_user.id,
                event_type='analysis.share.email',
                description='Shared analysis report by email.',
                entity_type='analysis_transaction',
                entity_id=analysis_id,
                metadata={'recipient': recipient, 'email_sent': email_sent},
            )
            db.session.commit()

            status_code = 200 if email_sent else 202
            return {
                'status': 'success' if email_sent else 'queued',
                'method': 'email',
                'email_sent': email_sent,
                'share_token': token,
                'share_url': share_url,
                'warning': error_message,
            }, status_code

        ur._log_user_activity(
            current_user.id,
            event_type='analysis.share.link',
            description='Generated share link for analysis report.',
            entity_type='analysis_transaction',
            entity_id=analysis_id,
        )
        db.session.commit()

        return {
            'status': 'success',
            'method': 'link',
            'share_token': token,
            'share_url': share_url,
        }, 200

    @users_bp.route('/api/analysis/shared/<token>', methods=['GET'])
    def api_get_shared_analysis(token):
        try:
            decoded = _analysis_share_serializer().loads(token, max_age=60 * 60 * 24 * 7)
        except Exception:
            return {'error': 'Invalid or expired share token.'}, 400

        analysis_id = int(decoded.get('analysis_id') or 0)
        owner_user_id = int(decoded.get('owner_user_id') or 0)
        if not analysis_id or not owner_user_id:
            return {'error': 'Invalid share token payload.'}, 400

        tx = AnalysisTransaction.query.filter_by(id=analysis_id, user_id=owner_user_id).first()
        if not tx:
            return {'error': 'Analysis not found.'}, 404

        payload = _load_analysis_payload(owner_user_id, analysis_id) or {}
        return jsonify(_build_analysis_response(tx, payload))
