import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import DashboardTabsNav from '../components/DashboardTabsNav';
import './Dashboard.css';
import { useTranslation } from '../i18n/index';

const threatQueue = [
  { id: 'Q-3391', category: 'Phishing domain', confidence: 'High', source: 'Email gateway' },
  { id: 'Q-3284', category: 'Suspicious hash', confidence: 'Medium', source: 'Endpoint sensor' },
  { id: 'Q-3241', category: 'Credential abuse', confidence: 'High', source: 'Identity logs' },
];

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.log,.csv,.json';
const quickActions = [
  { key: 'upload', label: 'Upload indicators' },
  { key: 'enrich', label: 'Run enrichment' },
  { key: 'export', label: 'Export report' },
  { key: 'notify', label: 'Notify stakeholders' },
];

const intakePresets = [
  {
    key: 'email_phish',
    label: 'Email Phish',
    values: {
      source: 'email_gateway',
      confidence: 'high',
      network_scope: 'external',
      asset_criticality: 'high',
    },
  },
  {
    key: 'endpoint_malware',
    label: 'Endpoint Malware',
    values: {
      source: 'edr',
      confidence: 'high',
      network_scope: 'internal',
      asset_criticality: 'critical',
    },
  },
  {
    key: 'identity_abuse',
    label: 'Identity Abuse',
    values: {
      source: 'siem',
      confidence: 'medium',
      network_scope: 'vpn',
      asset_criticality: 'high',
    },
  },
];

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [reportName, setReportName] = useState('incident-summary.pdf');
  const [reportSent, setReportSent] = useState(false);
  const [submissionMode, setSubmissionMode] = useState('file');
  const [indicatorValue, setIndicatorValue] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('');
  const [inlineResult, setInlineResult] = useState(null);
  const [lastSubmission, setLastSubmission] = useState('');
  const [intakeDetails, setIntakeDetails] = useState({
    source: '',
    confidence: '',
    first_seen_at: '',
    asset_name: '',
    asset_criticality: '',
    account_ref: '',
    network_scope: '',
    related_artifacts: '',
    notes: '',
  });
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const indicatorInputRef = useRef(null);

  const isWorkspacePage = location.pathname === '/threatintel' || location.pathname === '/dashboard/workspace' || location.pathname === '/threatintel/workspace';
  const firstName = user?.first_name || t('dashboard.analyst');
  const analysisLimits = user?.analysis_limits || null;
  const planLimitsText = analysisLimits
    ? `${analysisLimits.max_items_per_analysis} items/run • ${analysisLimits.max_text_chars} chars • ${analysisLimits.max_file_size_mb}MB file`
    : 'Limits load from your active plan';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');

    if (modeParam === 'file' && !isWorkspacePage) {
      navigate('/threatintel?mode=file', { replace: true });
      return;
    }

    if (modeParam === 'file') {
      setSubmissionMode('file');
      setSubmissionError('');
      setSubmissionStatus('');
    }
  }, [isWorkspacePage, location.search, navigate]);

  useEffect(() => {
    let active = true;

    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const response = await api.get('/auth/transactions?limit=8');
        if (!active) return;

        const analysisRows = Array.isArray(response.data?.analysis_transactions)
          ? response.data.analysis_transactions.map((row) => ({
              id: `analysis-${row.id}`,
              kind: 'analysis',
              type: 'Analysis',
              status: row.status || 'unknown',
              detail: `${row.source_type || 'input'} • ${row.status || 'unknown'}`,
              source_type: row.source_type || 'input',
              processing_ms: row.processing_ms,
              items_count: row.items_count,
              result_summary: row.result_summary,
              error_message: row.error_message,
              created_at: row.created_at,
            }))
          : [];

        const activityRows = Array.isArray(response.data?.activity_events)
          ? response.data.activity_events.map((row) => ({
              id: `activity-${row.id}`,
              kind: 'activity',
              type: 'Activity',
              status: 'recorded',
              detail: row.description || row.event_type || 'Activity update',
              event_type: row.event_type,
              entity_type: row.entity_type,
              metadata: row.metadata,
              created_at: row.created_at,
            }))
          : [];

        const billingRows = Array.isArray(response.data?.billing_transactions)
          ? response.data.billing_transactions.map((row) => ({
              id: `billing-${row.id}`,
              kind: 'billing',
              type: 'Billing',
              status: row.status || 'pending',
              detail: `${row.status || 'pending'} • ${row.amount_minor || 0} ${String(row.currency || '').toUpperCase()}`,
              amount_minor: row.amount_minor,
              currency: row.currency,
              provider: row.provider,
              provider_txn_id: row.provider_txn_id,
              created_at: row.created_at,
            }))
          : [];

        const merged = [...analysisRows, ...activityRows, ...billingRows]
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 60);

        setTransactions(merged);
      } catch {
        if (active) {
          setTransactions([]);
        }
      } finally {
        if (active) {
          setTransactionsLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      active = false;
    };
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesType = transactionTypeFilter === 'all' || item.kind === transactionTypeFilter;
      const matchesStatus = transactionStatusFilter === 'all' || item.status === transactionStatusFilter;
      return matchesType && matchesStatus;
    });
  }, [transactionStatusFilter, transactionTypeFilter, transactions]);

  const pageSize = 6;
  const totalTransactionPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (transactionPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, transactionPage]);

  useEffect(() => {
    setTransactionPage(1);
  }, [transactionTypeFilter, transactionStatusFilter]);

  useEffect(() => {
    if (selectedTransaction) {
      const stillExists = filteredTransactions.some((item) => item.id === selectedTransaction.id);
      if (!stillExists) {
        setSelectedTransaction(null);
      }
    }
  }, [filteredTransactions, selectedTransaction]);

  const dashboardStats = useMemo(
    () => [
      { label: t('dashboard.recent_actions'), value: String(filteredTransactions.length), detail: t('dashboard.recent_actions_detail') },
      { label: t('dashboard.analyses_this_session'), value: lastSubmission ? '1' : '0', detail: planLimitsText },
      { label: t('dashboard.last_report'), value: reportName, detail: t('dashboard.last_report_detail') },
    ],
    [filteredTransactions.length, lastSubmission, planLimitsText, reportName, t]
  );

  const summarizeRiskDrivers = (intake) => {
    if (!intake || typeof intake !== 'object') return [];
    const drivers = [];
    if (intake.confidence) drivers.push(`confidence: ${intake.confidence}`);
    if (intake.asset_criticality) drivers.push(`asset: ${intake.asset_criticality}`);
    if (intake.network_scope) drivers.push(`scope: ${intake.network_scope}`);
    if (intake.source) drivers.push(`source: ${intake.source}`);
    return drivers;
  };

  const threatTone = (threatLevel) => {
    const normalized = String(threatLevel || '').toLowerCase();
    if (normalized === 'high') return 'high';
    if (normalized === 'medium') return 'medium';
    return 'low';
  };

  const loadInlineResult = async (analysisId, fallback) => {
    try {
      const response = await api.get(`/api/analysis/${analysisId}`);
      const data = response?.data || {};
      const sourceLabel = data.file_path || data.indicator || fallback || 'Submission';

      setInlineResult({
        analysisId,
        sourceLabel,
        threatScore: Number.isFinite(data.threat_score) ? data.threat_score : null,
        threatScoreBreakdown: data?.threat_score_breakdown || null,
        threatLevel: data.threat_level || 'Unknown',
        iocCount: Array.isArray(data.indicators_of_compromise) ? data.indicators_of_compromise.length : 0,
        patternCount: Array.isArray(data.suspicious_patterns) ? data.suspicious_patterns.length : 0,
        rationale: data?.insights?.severity_rationale || '',
        riskDrivers: summarizeRiskDrivers(data.intake),
      });
    } catch {
      setInlineResult({
        analysisId,
        sourceLabel: fallback || 'Submission',
        threatScore: null,
        threatScoreBreakdown: null,
        threatLevel: 'Pending',
        iocCount: 0,
        patternCount: 0,
        rationale: '',
        riskDrivers: [],
      });
    }
  };

  const handleIndicatorSubmit = async (event) => {
    event.preventDefault();
    const cleaned = indicatorValue.trim();
    if (!cleaned || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError('');
    setSubmissionStatus('Submitting threat intake for analysis...');

    try {
      const response = await api.post('/api/threat-intel/intake', {
        indicator: cleaned,
        source: intakeDetails.source,
        confidence: intakeDetails.confidence,
        first_seen_at: intakeDetails.first_seen_at || undefined,
        asset_name: intakeDetails.asset_name || undefined,
        asset_criticality: intakeDetails.asset_criticality || undefined,
        account_ref: intakeDetails.account_ref || undefined,
        network_scope: intakeDetails.network_scope || undefined,
        related_artifacts: intakeDetails.related_artifacts
          ? intakeDetails.related_artifacts.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
        notes: intakeDetails.notes || undefined,
      });
      const analysisId = response?.data?.analysisId;

      setReportSent(false);
      setLastSubmission(cleaned);
      setReportName(`report-${analysisId || Date.now()}.pdf`);
      setIndicatorValue('');
      setSubmissionStatus('Threat intake analyzed.');

      if (analysisId) {
        await loadInlineResult(analysisId, cleaned);
      }

      const refresh = await api.get('/auth/transactions?limit=8');
      const analysisRows = Array.isArray(refresh.data?.analysis_transactions)
        ? refresh.data.analysis_transactions.map((row) => ({
            id: `analysis-${row.id}`,
            kind: 'analysis',
            type: 'Analysis',
            status: row.status || 'unknown',
            detail: `${row.source_type || 'input'} • ${row.status || 'unknown'}`,
            source_type: row.source_type || 'input',
            processing_ms: row.processing_ms,
            items_count: row.items_count,
            result_summary: row.result_summary,
            error_message: row.error_message,
            created_at: row.created_at,
          }))
        : [];
      const activityRows = Array.isArray(refresh.data?.activity_events)
        ? refresh.data.activity_events.map((row) => ({
            id: `activity-${row.id}`,
            kind: 'activity',
            type: 'Activity',
            status: 'recorded',
            detail: row.description || row.event_type || 'Activity update',
            event_type: row.event_type,
            entity_type: row.entity_type,
            metadata: row.metadata,
            created_at: row.created_at,
          }))
        : [];
      const billingRows = Array.isArray(refresh.data?.billing_transactions)
        ? refresh.data.billing_transactions.map((row) => ({
            id: `billing-${row.id}`,
            kind: 'billing',
            type: 'Billing',
            status: row.status || 'pending',
            detail: `${row.status || 'pending'} • ${row.amount_minor || 0} ${String(row.currency || '').toUpperCase()}`,
            amount_minor: row.amount_minor,
            currency: row.currency,
            provider: row.provider,
            provider_txn_id: row.provider_txn_id,
            created_at: row.created_at,
          }))
        : [];
      setTransactions(
        [...analysisRows, ...activityRows, ...billingRows]
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 60)
      );

    } catch (error) {
      setSubmissionStatus('');
      setSubmissionError(error?.response?.data?.error || 'Failed to submit analysis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile || isSubmitting) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('source', intakeDetails.source);
    formData.append('confidence', intakeDetails.confidence);
    if (intakeDetails.first_seen_at) formData.append('first_seen_at', intakeDetails.first_seen_at);
    if (intakeDetails.asset_name) formData.append('asset_name', intakeDetails.asset_name);
    if (intakeDetails.asset_criticality) formData.append('asset_criticality', intakeDetails.asset_criticality);
    if (intakeDetails.account_ref) formData.append('account_ref', intakeDetails.account_ref);
    if (intakeDetails.network_scope) formData.append('network_scope', intakeDetails.network_scope);
    if (intakeDetails.related_artifacts) formData.append('related_artifacts', intakeDetails.related_artifacts);
    if (intakeDetails.notes) formData.append('notes', intakeDetails.notes);

    setIsSubmitting(true);
    setSubmissionError('');
    setSubmissionStatus('Uploading and analyzing file...');

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const redirectUrl = response.data?.redirect_url || '';
      const idMatch = /\/analysis\/(\d+)/.exec(redirectUrl);
      const analysisId = idMatch ? Number(idMatch[1]) : null;

      setReportSent(false);
      setLastSubmission(selectedFile.name);
      setSelectedFile(null);

      if (analysisId) {
        setReportName(`report-${analysisId}.pdf`);
        await loadInlineResult(analysisId, selectedFile.name);
      }

      setSubmissionStatus('File analyzed.');
    } catch (error) {
      setSubmissionStatus('');
      setSubmissionError(error?.response?.data?.error || 'File upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerate = (event) => {
    if (submissionMode === 'file') {
      handleFileSubmit(event);
      return;
    }
    handleIndicatorSubmit(event);
  };

  const handleSend = () => setReportSent(true);

  const updateIntakeField = (field, value) => {
    setIntakeDetails((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyIntakePreset = (presetValues) => {
    setIntakeDetails((current) => ({
      ...current,
      ...presetValues,
    }));
  };

  const selectedTransactionStyle = useMemo(() => {
    if (!selectedTransaction) return null;
    const toneMap = {
      analysis: 'analysis',
      activity: 'activity',
      billing: 'billing',
    };
    return toneMap[selectedTransaction.kind] || 'neutral';
  }, [selectedTransaction]);

  const handleQuickAction = (key) => {
    if (key === 'upload') {
      setSubmissionMode('file');
      return;
    }

    if (key === 'enrich') {
      setSubmissionMode('indicator');
      indicatorInputRef.current?.focus();
      return;
    }

    if (key === 'export' && inlineResult?.analysisId) {
      navigate(`/analysis/${inlineResult.analysisId}`);
      return;
    }

    if (key === 'notify') {
      setReportSent(true);
    }
  };

  return (
    <main className="user-dashboard">
      <div className="user-dashboard__grid-overlay" aria-hidden="true" />

      {!isWorkspacePage && (
        <section className="user-dashboard__hero">
          <div className="user-dashboard__hero-copy">
            <p className="user-dashboard__eyebrow">{t('dashboard.eyebrow')}</p>
            <h1>{t('dashboard.title_no_name') || t('dashboard.title', { name: firstName })}</h1>
            <p className="user-dashboard__lead">
              Monitor live signals, analyze indicators and files, triage threat queues, manage NIS2 and GDPR compliance tasks and incidents, review vCISO guidance, and generate reports from one unified command center. Switch tabs to move between Dashboard, Compliance, and vCISO activities.
            </p>
          </div>

          {/* Profile moved to Account / Profile menu; removed from dashboard hero */}
        </section>
      )}

      <DashboardTabsNav />

      {isWorkspacePage && (
        <>
          <section className="user-dashboard__grid">
        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>{t('dashboard.submit_analysis')}</h2>
            <span>Unified scanner for indicators and files</span>
          </div>

          <div className="user-dashboard__mode-toggle" role="tablist" aria-label="Submission mode">
            <button
              type="button"
              role="tab"
              aria-selected={submissionMode === 'indicator'}
              className={`user-dashboard__mode-pill${submissionMode === 'indicator' ? ' user-dashboard__mode-pill--active' : ''}`}
              onClick={() => {
                setSubmissionMode('indicator');
                setSubmissionError('');
                setSubmissionStatus('');
              }}
            >
              Indicator, URL, hash, domain
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={submissionMode === 'file'}
              className={`user-dashboard__mode-pill${submissionMode === 'file' ? ' user-dashboard__mode-pill--active' : ''}`}
              onClick={() => {
                setSubmissionMode('file');
                setSubmissionError('');
                setSubmissionStatus('');
              }}
            >
              File upload
            </button>
          </div>

          <form className="user-dashboard__analysis-form" onSubmit={handleGenerate}>
            {submissionMode === 'indicator' ? (
              <>
                <label htmlFor="inputText">Indicator input</label>
                <input
                  key="indicator-input"
                  id="inputText"
                  ref={indicatorInputRef}
                  placeholder="Example: hash, URL, domain, or IP"
                  value={indicatorValue}
                  onChange={(event) => setIndicatorValue(event.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <label htmlFor="fileInput">Upload file</label>
                <input
                  key="file-input"
                  id="fileInput"
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  required
                />
                {selectedFile ? (
                  <p className="user-dashboard__hint user-dashboard__hint--tight">
                    Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="user-dashboard__hint user-dashboard__hint--tight">Accepted: PDF, DOCX, TXT, LOG, CSV, JSON</p>
                )}
              </>
            )}

            <div className="user-dashboard__intake-grid">
              <p className="user-dashboard__hint user-dashboard__hint--tight user-dashboard__intake-presets-label">Quick presets</p>
              <div className="user-dashboard__intake-presets" role="group" aria-label="Threat intake presets">
                {intakePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className="user-dashboard__preset-chip"
                    onClick={() => applyIntakePreset(preset.values)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <label htmlFor="sourceInput">Source</label>
              <select
                id="sourceInput"
                value={intakeDetails.source}
                onChange={(event) => updateIntakeField('source', event.target.value)}
                required
              >
                <option value="">Select source</option>
                <option value="manual">Manual</option>
                <option value="email_gateway">Email gateway</option>
                <option value="edr">EDR</option>
                <option value="siem">SIEM</option>
                <option value="firewall">Firewall</option>
              </select>

              <label htmlFor="confidenceInput">Confidence</label>
              <select
                id="confidenceInput"
                value={intakeDetails.confidence}
                onChange={(event) => updateIntakeField('confidence', event.target.value)}
                required
              >
                <option value="">Select confidence</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <label htmlFor="firstSeenInput">First seen (UTC)</label>
              <input
                id="firstSeenInput"
                type="datetime-local"
                value={intakeDetails.first_seen_at}
                onChange={(event) => updateIntakeField('first_seen_at', event.target.value)}
              />

              <label htmlFor="assetInput">Affected asset</label>
              <input
                id="assetInput"
                placeholder="host-22 or payment-api"
                value={intakeDetails.asset_name}
                onChange={(event) => updateIntakeField('asset_name', event.target.value)}
              />

              <label htmlFor="assetCriticalityInput">Asset criticality</label>
              <select
                id="assetCriticalityInput"
                value={intakeDetails.asset_criticality}
                onChange={(event) => updateIntakeField('asset_criticality', event.target.value)}
              >
                <option value="">Not set</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              <label htmlFor="accountRefInput">User or account</label>
              <input
                id="accountRefInput"
                placeholder="user@company.com"
                value={intakeDetails.account_ref}
                onChange={(event) => updateIntakeField('account_ref', event.target.value)}
              />

              <label htmlFor="networkScopeInput">Network scope</label>
              <select
                id="networkScopeInput"
                value={intakeDetails.network_scope}
                onChange={(event) => updateIntakeField('network_scope', event.target.value)}
              >
                <option value="">Not set</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="vpn">VPN</option>
                <option value="cloud">Cloud</option>
              </select>

              <label htmlFor="relatedArtifactsInput">Related artifacts</label>
              <input
                id="relatedArtifactsInput"
                placeholder="header.eml, process-tree.json"
                value={intakeDetails.related_artifacts}
                onChange={(event) => updateIntakeField('related_artifacts', event.target.value)}
              />
            </div>

            <label htmlFor="intakeNotesInput">Notes</label>
            <textarea
              id="intakeNotesInput"
              rows={3}
              placeholder="Optional case notes for triage"
              value={intakeDetails.notes}
              onChange={(event) => updateIntakeField('notes', event.target.value)}
            />

            <button type="submit" className="user-dashboard__button user-dashboard__button--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Analyze now'}
            </button>
          </form>

          {submissionStatus ? <p className="user-dashboard__success">{submissionStatus}</p> : null}
          {submissionError ? <p className="user-dashboard__error">{submissionError}</p> : null}

          {inlineResult ? (
            <div className="user-dashboard__inline-result">
              <p className="user-dashboard__queue-id">Latest analysis</p>
              <p className="user-dashboard__queue-type">{inlineResult.sourceLabel}</p>
              {inlineResult.threatScore !== null ? (
                <p className="user-dashboard__score-row">
                  <span className={`user-dashboard__score-pill user-dashboard__score-pill--${threatTone(inlineResult.threatLevel)}`}>
                    Score {inlineResult.threatScore}/100
                  </span>
                </p>
              ) : null}
              <p className="user-dashboard__queue-meta">
                Threat: {inlineResult.threatLevel} • IOCs: {inlineResult.iocCount} • Patterns: {inlineResult.patternCount}
              </p>
              {inlineResult.riskDrivers?.length ? (
                <p className="user-dashboard__queue-meta">Drivers: {inlineResult.riskDrivers.join(' • ')}</p>
              ) : null}
              {inlineResult.rationale ? (
                <p className="user-dashboard__inline-rationale">{inlineResult.rationale}</p>
              ) : null}
              {inlineResult.threatScoreBreakdown ? (
                <details className="user-dashboard__score-breakdown">
                  <summary>Score breakdown</summary>
                  <div className="user-dashboard__score-breakdown-grid">
                    <span>IOC signal</span>
                    <strong>{inlineResult.threatScoreBreakdown.base_iocs || 0}</strong>
                    <span>Pattern signal</span>
                    <strong>{inlineResult.threatScoreBreakdown.base_patterns || 0}</strong>
                    <span>VirusTotal signal</span>
                    <strong>{inlineResult.threatScoreBreakdown.enrichment_virustotal || 0}</strong>
                    <span>AbuseIPDB signal</span>
                    <strong>{inlineResult.threatScoreBreakdown.enrichment_abuseipdb || 0}</strong>
                    <span>Context adjustment</span>
                    <strong>{inlineResult.threatScoreBreakdown.context_adjustment || 0}</strong>
                  </div>
                </details>
              ) : null}
              <Link className="user-dashboard__inline-link" to={`/analysis/${inlineResult.analysisId}`}>
                Open full report
              </Link>
            </div>
          ) : null}

          {lastSubmission ? (
            <p className="user-dashboard__hint">
              {t('dashboard.last_submitted')} <strong>{lastSubmission}</strong>
            </p>
          ) : (
            <p className="user-dashboard__hint">{t('dashboard.no_submissions')}</p>
          )}

          <p className="user-dashboard__hint">
            {t('dashboard.plan_limits')} <strong>{planLimitsText}</strong>
          </p>
        </article>

        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>{t('dashboard.reports')}</h2>
            <span>{t('dashboard.reports_sub')}</span>
          </div>

          <p className="user-dashboard__report-line">
            {t('dashboard.latest_report')} <strong>{reportName}</strong>
          </p>

          <div className="user-dashboard__button-row">
            <button type="button" className="user-dashboard__button user-dashboard__button--secondary" onClick={handleSend}>
              {t('dashboard.send_via_email')}
            </button>
            {/* Profile moved to Account menu; keep only useful actions here */}
          </div>

          {reportSent ? <p className="user-dashboard__success">{t('dashboard.report_sent')}</p> : null}
        </article>

        <article className="user-dashboard__card user-dashboard__card--queue">
          <div className="user-dashboard__card-head">
            <h2>{t('dashboard.threat_queue')}</h2>
            <span>{t('dashboard.threat_queue_sub')}</span>
          </div>

          <div className="user-dashboard__queue-list" role="list" aria-label="Threat queue list">
            {threatQueue.map((item) => (
              <div className="user-dashboard__queue-item" role="listitem" key={item.id}>
                <p className="user-dashboard__queue-id">{item.id}</p>
                <p className="user-dashboard__queue-type">{item.category}</p>
                <p className="user-dashboard__queue-meta">{item.source}</p>
                <span className={`user-dashboard__confidence user-dashboard__confidence--${item.confidence.toLowerCase()}`}>
                  {item.confidence}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="user-dashboard__card user-dashboard__card--actions">
          <div className="user-dashboard__card-head">
            <h2>Rapid actions</h2>
            <span>Keep the response cycle moving</span>
          </div>

          <div className="user-dashboard__action-grid">
            {quickActions.map((action) => (
              <button
                type="button"
                className="user-dashboard__action-chip"
                key={action.key}
                onClick={() => handleQuickAction(action.key)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </article>

        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>Recent transactions</h2>
            <span>Your latest dashboard actions and system events</span>
          </div>

          <div className="user-dashboard__transactions-controls">
            <label>
              <span>Type</span>
              <select value={transactionTypeFilter} onChange={(event) => setTransactionTypeFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="analysis">Analysis</option>
                <option value="activity">Activity</option>
                <option value="billing">Billing</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={transactionStatusFilter} onChange={(event) => setTransactionStatusFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="blocked_by_plan">Blocked by plan</option>
                <option value="recorded">Recorded</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>

          {transactionsLoading ? <p className="user-dashboard__hint">Loading transactions...</p> : null}
          {!transactionsLoading && !filteredTransactions.length ? <p className="user-dashboard__hint">No transactions match this filter.</p> : null}

          {!transactionsLoading && filteredTransactions.length ? (
            <>
              <div className="user-dashboard__transaction-card-grid">
                {paginatedTransactions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`user-dashboard__transaction-card user-dashboard__transaction-card--${item.kind}`}
                    onClick={() => setSelectedTransaction(item)}
                  >
                    <div className="user-dashboard__transaction-card-head">
                      <span className="user-dashboard__transaction-type">{item.type}</span>
                      <span className={`user-dashboard__transaction-status user-dashboard__transaction-status--${String(item.status).toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>
                    <strong>{item.detail}</strong>
                    <p>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</p>
                  </button>
                ))}
              </div>

              <div className="user-dashboard__transactions-pagination">
                <button
                  type="button"
                  className="user-dashboard__button user-dashboard__button--ghost"
                  onClick={() => setTransactionPage((current) => Math.max(1, current - 1))}
                  disabled={transactionPage <= 1}
                >
                  Previous
                </button>
                <span>Page {transactionPage} of {totalTransactionPages}</span>
                <button
                  type="button"
                  className="user-dashboard__button user-dashboard__button--ghost"
                  onClick={() => setTransactionPage((current) => Math.min(totalTransactionPages, current + 1))}
                  disabled={transactionPage >= totalTransactionPages}
                >
                  Next
                </button>
              </div>

              {selectedTransaction ? (
                <div className={`user-dashboard__transaction-detail user-dashboard__transaction-detail--${selectedTransactionStyle}`}>
                  <p className="user-dashboard__queue-id">Transaction detail</p>
                  <p className="user-dashboard__queue-type">{selectedTransaction.type} • {selectedTransaction.status}</p>
                  <p className="user-dashboard__queue-meta">{selectedTransaction.detail}</p>
                  <p className="user-dashboard__queue-meta">Time: {selectedTransaction.created_at ? new Date(selectedTransaction.created_at).toLocaleString() : 'N/A'}</p>
                  {selectedTransaction.kind === 'analysis' ? (
                    <p className="user-dashboard__queue-meta">
                      Items: {selectedTransaction.items_count || 0} • Processing: {selectedTransaction.processing_ms || 0}ms
                    </p>
                  ) : null}
                  {selectedTransaction.kind === 'billing' ? (
                    <p className="user-dashboard__queue-meta">
                      Provider: {selectedTransaction.provider || 'N/A'} • Txn: {selectedTransaction.provider_txn_id || 'N/A'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </article>
          </section>

          <section className="user-dashboard__stats" aria-label="Workspace overview">
            {dashboardStats.map((stat) => (
              <article className="user-dashboard__stat-card" key={stat.label}>
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
                <span>{stat.detail}</span>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}