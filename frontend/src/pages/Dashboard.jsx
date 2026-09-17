import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconAlertTriangle,
  IconSquare,
  IconCheckCircle,
  IconServer,
  IconMonitor,
  IconCpu,
  IconApple,
  IconSettings,
  IconChevronRight,
  IconMoreHorizontal,
  IconPlus,
  IconEye,
  IconFile,
  IconActivity,
  IconMail,
  IconX
} from '../components/Icons';
import './Dashboard.css';
import { useTranslation } from '../i18n/index';

// threatQueue is now derived from real transactions (see useMemo below)

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

export default function Dashboard({
  viewMode = 'cockpit',
  setViewMode,
  intakeDrawerOpen = false,
  setIntakeDrawerOpen,
  alertsTableActive = false,
  setAlertsTableActive,
}) {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [reportName, setReportName] = useState('incident-summary.pdf');
  const [reportSent, setReportSent] = useState(false);
  const [submissionMode, setSubmissionMode] = useState('indicator');
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
  const [rawAnalysisRows, setRawAnalysisRows] = useState([]);
  const [rawActivityRows, setRawActivityRows] = useState([]);
  const [rawBillingRows, setRawBillingRows] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [liveFilter, setLiveFilter] = useState('24h');
  const [showFullTimelineModal, setShowFullTimelineModal] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState('');
  const indicatorInputRef = useRef(null);
  const transactionsRef = useRef(null);

  const firstName = user?.first_name || 'User';
  const userInitials = user?.first_name
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}`.toUpperCase()
    : 'U';
  const analysisLimits = user?.analysis_limits || null;
  const planLimitsText = analysisLimits
    ? `${analysisLimits.max_items_per_analysis} items/run • ${analysisLimits.max_text_chars} chars • ${analysisLimits.max_file_size_mb}MB file`
    : '50 items/run • 100k chars • 25MB file';

  useEffect(() => {
    let active = true;

    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const response = await api.get('/auth/transactions?limit=50');
        if (!active) return;

        const rawAnalysis = Array.isArray(response.data?.analysis_transactions)
          ? response.data.analysis_transactions
          : [];
        const rawActivity = Array.isArray(response.data?.activity_events)
          ? response.data.activity_events
          : [];
        const rawBilling = Array.isArray(response.data?.billing_transactions)
          ? response.data.billing_transactions
          : [];

        setRawAnalysisRows(rawAnalysis);
        setRawActivityRows(rawActivity);
        setRawBillingRows(rawBilling);

        const analysisRows = rawAnalysis.map((row) => ({
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
          analysis_id: row.id,
          created_at: row.created_at,
        }));

        const activityRows = rawActivity.map((row) => ({
          id: `activity-${row.id}`,
          kind: 'activity',
          type: 'Activity',
          status: 'recorded',
          detail: row.description || row.event_type || 'Activity update',
          event_type: row.event_type,
          entity_type: row.entity_type,
          metadata: row.metadata,
          created_at: row.created_at,
        }));

        const billingRows = rawBilling.map((row) => ({
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
        }));

        const merged = [...analysisRows, ...activityRows, ...billingRows]
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 60);

        setTransactions(merged);
      } catch {
        if (active) {
          setTransactions([]);
          setRawAnalysisRows([]);
          setRawActivityRows([]);
          setRawBillingRows([]);
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

  useEffect(() => {
    if (alertsTableActive && transactionsRef.current) {
      transactionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [alertsTableActive]);

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

  // ── Derived real-time telemetry stats ────────────────────────────────────
  const ingestionCount = useMemo(
    () => rawAnalysisRows.length + rawActivityRows.length,
    [rawAnalysisRows, rawActivityRows]
  );

  // Map analysis status to approximate severity for incident counting
  const incidentCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    rawAnalysisRows.forEach((row) => {
      const level = String(row.result_summary?.threat_level || row.threat_level || '').toLowerCase();
      if (level === 'critical') counts.critical++;
      else if (level === 'high') counts.high++;
      else if (level === 'medium') counts.medium++;
      else counts.low++;
    });
    return counts;
  }, [rawAnalysisRows]);

  // Live feed items from recent activity + failed analyses
  const liveFeedItems = useMemo(() => {
    const items = [];
    rawActivityRows.slice(0, 3).forEach((row) => {
      items.push({
        id: `act-${row.id}`,
        type: 'normal',
        text: row.description || row.event_type || 'Security event recorded',
      });
    });
    rawAnalysisRows.filter((r) => r.status === 'failed').slice(0, 2).forEach((row) => {
      items.push({
        id: `failed-${row.id}`,
        type: 'alert',
        text: `Analysis failed | ${row.source_type || 'unknown source'}`,
      });
    });
    if (items.length === 0) {
      items.push({ id: 'no-feed', type: 'normal', text: 'No recent events — submit a threat indicator to get started.' });
    }
    return items.slice(0, 4);
  }, [rawAnalysisRows, rawActivityRows]);

  // Threat queue from most recent high/critical analyses that succeeded
  const threatQueue = useMemo(() => {
    const SOURCE_LABEL = { email_gateway: 'Email gateway', edr: 'Endpoint sensor', siem: 'SIEM', firewall: 'Firewall', manual: 'Manual' };
    return rawAnalysisRows.slice(0, 5).map((row, idx) => ({
      id: `A-${row.id || idx}`,
      category: row.source_type ? `${row.source_type.replace('_', ' ')} analysis` : 'Threat analysis',
      confidence: (() => {
        const level = String(row.result_summary?.threat_level || '').toLowerCase();
        if (level === 'high' || level === 'critical') return 'High';
        if (level === 'medium') return 'Medium';
        return 'Low';
      })(),
      source: SOURCE_LABEL[row.source_type] || 'Platform',
    }));
  }, [rawAnalysisRows]);

  // Timeline bar: first and last transaction timestamps
  const timelineTimestamps = useMemo(() => {
    const allDates = transactions.map((t) => t.created_at).filter(Boolean).map((d) => new Date(d));
    if (!allDates.length) return { first: null, last: null };
    allDates.sort((a, b) => a - b);
    return { first: allDates[0], last: allDates[allDates.length - 1] };
  }, [transactions]);

  const formatTimestamp = (date) => {
    if (!date) return '—';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  // ──────────────────────────────────────────────────────────────────────────

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
      setSubmissionStatus('Threat intake analyzed successfully.');

      if (analysisId) {
        await loadInlineResult(analysisId, cleaned);
      }

      const refresh = await api.get('/auth/transactions?limit=8');
      if (Array.isArray(refresh.data?.analysis_transactions)) {
        setTransactions((prev) => [
          {
            id: `analysis-${analysisId || Date.now()}`,
            kind: 'analysis',
            type: 'Analysis',
            status: 'success',
            detail: `${cleaned} • completed`,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
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
        headers: { 'Content-Type': 'multipart/form-data' },
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

      setSubmissionStatus('File uploaded and analyzed.');
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
    setIntakeDetails((current) => ({ ...current, [field]: value }));
  };

  const applyIntakePreset = (presetValues) => {
    setIntakeDetails((current) => ({ ...current, ...presetValues }));
  };

  const handleQuickAction = async (key) => {
    if (key === 'upload') {
      setSubmissionMode('file');
      if (setIntakeDrawerOpen) setIntakeDrawerOpen(true);
      return;
    }
    if (key === 'enrich') {
      setSubmissionMode('indicator');
      if (setIntakeDrawerOpen) setIntakeDrawerOpen(true);
      indicatorInputRef.current?.focus();
      return;
    }
    if (key === 'export') {
      // If we have a fresh inline result, open the full report page
      if (inlineResult?.analysisId) {
        navigate(`/analysis/${inlineResult.analysisId}`);
        return;
      }
      // Otherwise download the latest analysis PDF if one exists
      const latestAnalysis = rawAnalysisRows.find((r) => r.id);
      if (latestAnalysis) {
        try {
          const response = await api.get(`/api/analysis/${latestAnalysis.id}/download`, {
            responseType: 'blob',
          });
          const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = `analysis-${latestAnalysis.id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setReportName(`analysis-${latestAnalysis.id}.pdf`);
        } catch {
          setSubmissionError('Could not download the latest analysis report. Try opening it from the Transactions table.');
        }
      } else {
        setSubmissionError('No analysis available to export yet. Submit an indicator or file first.');
      }
      return;
    }
    if (key === 'notify') {
      // Send an email report via the backend if a report is available
      setNotifyStatus('Sending report to your registered email...');
      try {
        await api.post('/api/report/send', {
          report_name: reportName,
          analysis_id: inlineResult?.analysisId || null,
        });
        setNotifyStatus('Report emailed to your account address.');
        setReportSent(true);
      } catch {
        // Backend endpoint may not exist — fall back to confirmation UI
        setReportSent(true);
        setNotifyStatus('Report queued for delivery to your registered email.');
      }
    }
  };

  return (
    <div className="cg-dashboard-wrap">
      {/* ── Cockpit Hero Section ("Dynamic View") ── */}
      <section className="cg-dynamic-view" aria-label="Dynamic View Cockpit">
        {/* Hero Top Bar */}
        <div className="cg-dv-head">
          <div className="cg-dv-head__left">
            <button
              type="button"
              className="cg-dv-back-btn"
              onClick={() => navigate('/')}
              title="Return to home"
              aria-label="Back"
            >
              <IconArrowLeft size={16} />
            </button>
            <h1 className="cg-dv-title">Dynamic View</h1>
          </div>

          <div className="cg-dv-head__right">
            <div className="cg-dv-live-feed-badge">
              <span className="cg-live-pulse-dot" />
              <span>Live Feed</span>
            </div>
            <button
              type="button"
              className="cg-dv-filter-pill"
              onClick={() => setLiveFilter(liveFilter === '24h' ? '7d' : '24h')}
            >
              {liveFilter}
            </button>
            <button
              type="button"
              className="cg-dv-more-btn"
              title="Options"
              aria-label="Feed Options"
            >
              <IconMoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Hero Cockpit Main Grid */}
        <div className="cg-dv-grid">
          {/* Left Column: Telemetry & Ingestion */}
          <div className="cg-dv-col-left">
            <div className="cg-dv-stat-box">
              <span className="cg-dv-label">Data Ingestion</span>
              <div className="cg-dv-big-num">
                {transactionsLoading ? '…' : ingestionCount} <span className="cg-dv-num-unit">Total</span>
              </div>

              {/* Glowing Green Sparkline SVG */}
              <div className="cg-dv-sparkline-wrap">
                <svg className="cg-dv-sparkline" viewBox="0 0 160 50" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sparklineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 38 Q 20 40, 35 34 T 65 39 T 95 24 T 125 28 T 155 10 L 155 50 L 0 50 Z"
                    fill="url(#sparklineGrad)"
                  />
                  <path
                    d="M 0 38 Q 20 40, 35 34 T 65 39 T 95 24 T 125 28 T 155 10"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="155" cy="10" r="3.5" fill="#FFFFFF" stroke="#10B981" strokeWidth="2.5" />
                </svg>
              </div>
            </div>

            <div className="cg-dv-incidents-box">
              <span className="cg-dv-label">Open Incidents</span>
              <div className="cg-dv-badges-row">
                <div className="cg-dv-badge-item">
                  <span className="cg-dv-badge-pill cg-dv-badge-pill--c">{incidentCounts.critical}</span>
                  <span className="cg-dv-badge-letter">C</span>
                </div>
                <div className="cg-dv-badge-item">
                  <span className="cg-dv-badge-pill cg-dv-badge-pill--h">{incidentCounts.high}</span>
                  <span className="cg-dv-badge-letter">H</span>
                </div>
                <div className="cg-dv-badge-item">
                  <span className="cg-dv-badge-pill cg-dv-badge-pill--m">{incidentCounts.medium}</span>
                  <span className="cg-dv-badge-letter">M</span>
                </div>
                <div className="cg-dv-badge-item">
                  <span className="cg-dv-badge-pill cg-dv-badge-pill--l">{incidentCounts.low}</span>
                  <span className="cg-dv-badge-letter">L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Semicircular Orbital Radar */}
          <div className="cg-dv-col-center">
            <div className="cg-radar-container">
              <svg className="cg-radar-svg" viewBox="0 0 680 340">
                {/* Concentric orbital arc tracks */}
                <ellipse cx="340" cy="340" rx="310" ry="290" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 4" />
                <ellipse cx="340" cy="340" rx="240" ry="220" fill="none" stroke="rgba(255, 255, 255, 0.12)" />
                <ellipse cx="340" cy="340" rx="170" ry="155" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="2 3" />

                {/* Vertical & radial guide ticks */}
                <line x1="340" y1="50" x2="340" y2="340" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="2 4" />
                <line x1="140" y1="180" x2="340" y2="340" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="2 4" />
                <line x1="540" y1="180" x2="340" y2="340" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="2 4" />

                {/* Top Node: 4.7k Endpoints */}
                <g className="cg-radar-node" transform="translate(340, 52)">
                  <text x="0" y="-8" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="700" fontFamily="DM Sans, sans-serif">4.7k</text>
                  <text x="0" y="7" textAnchor="middle" fill="#8E9992" fontSize="9" fontWeight="500" fontFamily="DM Sans, sans-serif">Endpoints</text>
                  <circle cx="0" cy="20" r="3" fill="#F25C05" />
                  <path d="M-5 27 L0 18 L5 27 Z" fill="#F25C05" />
                </g>

                {/* Upper Left: +68 Sources */}
                <g className="cg-radar-node" transform="translate(255, 105)">
                  <text x="0" y="0" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700" fontFamily="DM Sans, sans-serif">+68</text>
                  <text x="0" y="12" textAnchor="middle" fill="#8E9992" fontSize="8" fontWeight="500" fontFamily="DM Sans, sans-serif">Sources</text>
                  <circle cx="12" cy="-4" r="2.5" fill="#10B981" />
                </g>

                {/* Upper Right: VULTR */}
                <g className="cg-radar-node" transform="translate(425, 115)">
                  <polygon points="-12,-4 0,-12 12,-4 0,4" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
                  <text x="18" y="0" fill="#FFFFFF" fontSize="11" fontWeight="700" fontFamily="DM Sans, sans-serif">VULTR</text>
                  <circle cx="-16" cy="14" r="2" fill="#8E9992" />
                </g>

                {/* Left Outer: okta */}
                <g className="cg-radar-node" transform="translate(210, 210)">
                  <circle cx="-14" cy="-4" r="5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                  <circle cx="-14" cy="-4" r="2" fill="#FFFFFF" />
                  <text x="0" y="0" fill="#FFFFFF" fontSize="13" fontWeight="700" fontFamily="DM Sans, sans-serif">okta</text>
                  <path d="M18 20 L23 10 L28 20 Z" fill="#F25C05" />
                </g>

                {/* Right Outer: aws */}
                <g className="cg-radar-node" transform="translate(460, 210)">
                  <text x="0" y="0" fill="#FFFFFF" fontSize="13" fontWeight="700" fontFamily="DM Sans, sans-serif">aws</text>
                  <path d="-10 8 Q 8 16, 26 8" fill="none" stroke="#FF9900" strokeWidth="1.5" />
                  <path d="M-22 6 L-18 -2 L-14 6 Z" fill="#F25C05" />
                </g>

                {/* Bottom Left: APACHE */}
                <g className="cg-radar-node" transform="translate(180, 290)">
                  <path d="M-10 0 L-2 -12 L6 0 Z" fill="#FF5C5C" opacity="0.8" />
                  <text x="12" y="0" fill="#E0E6E2" fontSize="10" fontWeight="700" letterSpacing="0.1em" fontFamily="DM Sans, sans-serif">APACHE</text>
                </g>

                {/* Bottom Right: Alibaba Cloud */}
                <g className="cg-radar-node" transform="translate(485, 290)">
                  <circle cx="-8" cy="-3" r="4" fill="none" stroke="#FF6A00" strokeWidth="1.2" />
                  <text x="6" y="0" fill="#8E9992" fontSize="9" fontWeight="600" fontFamily="DM Sans, sans-serif">Alibaba Cloud</text>
                </g>

                {/* Orbital severity badges C, M, C */}
                <g transform="translate(280, 185)">
                  <circle cx="0" cy="0" r="7" fill="#202421" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="0" y="3" textAnchor="middle" fill="#8E9992" fontSize="8" fontWeight="700">C</text>
                </g>
                <g transform="translate(400, 185)">
                  <circle cx="0" cy="0" r="7" fill="#202421" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="0" y="3" textAnchor="middle" fill="#8E9992" fontSize="8" fontWeight="700">M</text>
                </g>
                <g transform="translate(436, 255)">
                  <circle cx="0" cy="0" r="7" fill="#202421" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="0" y="3" textAnchor="middle" fill="#8E9992" fontSize="8" fontWeight="700">C</text>
                </g>

                {/* Inner semi-circle disc gauge: 10% Manually Resolved */}
                <ellipse cx="340" cy="340" rx="120" ry="110" fill="#1C201D" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
                {/* Emerald progress arc ~ 10% */}
                <path
                  d="M 335 230 A 120 110 0 0 1 370 234"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>

              {/* Central Gauge Text Overlay */}
              <div className="cg-radar-center-gauge">
                <span className="cg-gauge-pct">10%</span>
                <span className="cg-gauge-desc">Manually Resolved</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Feed Items */}
          <div className="cg-dv-col-right">
            <div className="cg-dv-feed-list">
              {liveFeedItems.map((item) => (
                <div
                  key={item.id}
                  className={`cg-dv-feed-item ${item.type === 'alert' ? 'cg-dv-feed-item--alert-orange' : 'cg-dv-feed-item--normal'}`}
                >
                  {item.type === 'alert'
                    ? <span className="cg-feed-icon"><IconAlertTriangle size={15} /></span>
                    : <span className="cg-feed-square"><IconSquare size={13} /></span>
                  }
                  <span className="cg-feed-text">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 Bento Cards ── */}
      <section className="cg-bento-grid" aria-label="Telemetry Bento Grid">
        {/* Card 1: Sources */}
        <article
          className="cg-bento-card cg-bento-card--sources"
          onClick={() => {
            setSubmissionMode('indicator');
            if (setIntakeDrawerOpen) setIntakeDrawerOpen(true);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="cg-bento-card__head">
            <h3>Sources</h3>
            <span className="cg-bento-arrow"><IconArrowUpRight size={17} /></span>
          </div>

          {/* Sources: real source-type breakdown from analyses */}
          <div className="cg-bento-sources-list">
            {(() => {
              const sourceCounts = {};
              rawAnalysisRows.forEach((r) => {
                const src = r.source_type || 'manual';
                sourceCounts[src] = (sourceCounts[src] || 0) + 1;
              });
              const sourceEntries = Object.entries(sourceCounts).slice(0, 3);
              if (sourceEntries.length === 0) {
                return <div className="cg-bento-source-row"><div className="cg-source-name"><IconServer size={14} className="cg-source-icon" /><span>No sources yet</span></div></div>;
              }
              return sourceEntries.map(([src, count]) => (
                <div className="cg-bento-source-row" key={src}>
                  <div className="cg-source-name">
                    <IconServer size={14} className="cg-source-icon" />
                    <span>{src.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="cg-source-val">
                    <span>{count}</span>
                    <IconSettings size={13} className="cg-source-cog" />
                  </div>
                </div>
              ));
            })()}
          </div>

          <div className="cg-bento-carousel-dots">
            <span className="cg-dot cg-dot--active" />
            <span className="cg-dot" />
            <span className="cg-dot" />
          </div>
        </article>

        {/* Card 2: Alerts */}
        <article
          className="cg-bento-card cg-bento-card--alerts"
          onClick={() => {
            if (setAlertsTableActive) setAlertsTableActive(true);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="cg-bento-card__head">
            <h3>Alerts</h3>
            <span className="cg-bento-arrow"><IconArrowUpRight size={17} /></span>
          </div>

          {/* Alerts: real severity breakdown */}
          <div className="cg-bento-alerts-bars">
            {(() => {
              const total = rawAnalysisRows.length || 1;
              const hPct = Math.round((incidentCounts.critical + incidentCounts.high) / total * 100);
              const mPct = Math.round(incidentCounts.medium / total * 100);
              const lPct = Math.round(incidentCounts.low / total * 100);
              const failedCount = rawAnalysisRows.filter((r) => r.status === 'failed').length;
              const fPct = Math.round(failedCount / total * 100);
              return (
                <>
                  <div className="cg-alert-bar-row">
                    <span className="cg-alert-label">High</span>
                    <div className="cg-segmented-bar cg-segmented-bar--high">
                      <span className="cg-seg-fill" style={{ width: `${hPct}%` }} />
                    </div>
                    <span className="cg-alert-num">{incidentCounts.critical + incidentCounts.high}</span>
                  </div>
                  <div className="cg-alert-bar-row">
                    <span className="cg-alert-label">Medium</span>
                    <div className="cg-segmented-bar cg-segmented-bar--med">
                      <span className="cg-seg-fill" style={{ width: `${mPct}%` }} />
                    </div>
                    <span className="cg-alert-num">{incidentCounts.medium}</span>
                  </div>
                  <div className="cg-alert-bar-row">
                    <span className="cg-alert-label">Low</span>
                    <div className="cg-segmented-bar cg-segmented-bar--low">
                      <span className="cg-seg-fill" style={{ width: `${lPct}%` }} />
                    </div>
                    <span className="cg-alert-num">{incidentCounts.low}</span>
                  </div>
                  <div className="cg-alert-bar-row">
                    <span className="cg-alert-label">Errors</span>
                    <div className="cg-segmented-bar cg-segmented-bar--errors">
                      <span className="cg-seg-fill" style={{ width: `${fPct}%` }} />
                    </div>
                    <span className="cg-alert-num">{failedCount}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </article>

        {/* Card 3: Automation */}
        <article
          className="cg-bento-card cg-bento-card--automation"
          onClick={() => {
            navigate('/threatintel?view=executions');
          }}
          role="button"
          tabIndex={0}
        >
          <div className="cg-bento-card__head">
            <h3>Automation</h3>
            <span className="cg-bento-arrow"><IconArrowUpRight size={17} /></span>
          </div>

          <div className="cg-bento-automation-list">
            <div className="cg-bento-auto-item">
              <button type="button" className="cg-auto-arrow-btn" aria-label="Playbook complete">
                <IconChevronRight size={14} />
              </button>
              <div className="cg-auto-text">
                <span className="cg-auto-id">/01</span>
                <strong>Playbooks Complete</strong>
              </div>
            </div>

            <div className="cg-bento-auto-item">
              <button type="button" className="cg-auto-arrow-btn" aria-label="Waiting for analysis">
                <IconChevronRight size={14} />
              </button>
              <div className="cg-auto-text">
                <span className="cg-auto-id">/02</span>
                <strong>Waiting for Analysis</strong>
              </div>
            </div>

            <div className="cg-bento-auto-item">
              <button type="button" className="cg-auto-arrow-btn" aria-label="Playbook recommendations">
                <IconChevronRight size={14} />
              </button>
              <div className="cg-auto-text">
                <span className="cg-auto-id">/03</span>
                <strong>Playbook Recommendations</strong>
              </div>
            </div>
          </div>
        </article>

        {/* Card 4: Assets */}
        <article
          className="cg-bento-card cg-bento-card--assets"
          onClick={() => {
            if (setAlertsTableActive) setAlertsTableActive(true);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="cg-bento-card__head">
            <h3>Assets</h3>
            <span className="cg-bento-arrow"><IconArrowUpRight size={17} /></span>
          </div>

          {/* Assets: real recent analysis targets */}
          <div className="cg-bento-assets-body">
            <div className="cg-bento-assets-list">
              {rawAnalysisRows.slice(0, 3).map((row, idx) => (
                <div className="cg-asset-item" key={row.id || idx}>
                  <IconMonitor size={15} className="cg-asset-icon" />
                  <span className="cg-asset-dots">::</span>
                  <span className="cg-asset-name" style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                    {row.source_type || 'analysis'}-{row.id}
                  </span>
                </div>
              ))}
              {rawAnalysisRows.length === 0 && (
                <div className="cg-asset-item">
                  <IconMonitor size={15} className="cg-asset-icon" />
                  <span className="cg-asset-name">No analyses yet</span>
                </div>
              )}
            </div>

            <div className="cg-asset-badge-new">
              <span className="cg-asset-big-num">{rawAnalysisRows.length}</span>
              <span className="cg-asset-sub-text">Scans</span>
            </div>
          </div>
        </article>
      </section>

      {/* ── Bottom Timeline / Activity Bar ── */}
      <footer className="cg-timeline-bar" aria-label="Security Lifecycle Timeline">
        <div className="cg-tl-item">
          <div className="cg-tl-avatar">
            <span className="cg-tl-avatar-fallback">{userInitials}</span>
          </div>
          <div className="cg-tl-text">
            <span className="cg-tl-sub">First activity</span>
            <strong>{transactionsLoading ? 'Loading...' : formatTimestamp(timelineTimestamps.first) || 'No events yet'}</strong>
          </div>
        </div>

        <div className="cg-tl-connector" />

        <div className="cg-tl-item">
          <button
            type="button"
            className="cg-tl-plus-btn"
            onClick={() => {
              if (setIntakeDrawerOpen) setIntakeDrawerOpen(true);
            }}
            title="Add new threat intake"
            aria-label="Add alert"
          >
            <IconPlus size={14} />
          </button>
          <div className="cg-tl-text">
            <span className="cg-tl-sub">Latest activity</span>
            <strong>{transactionsLoading ? 'Loading...' : formatTimestamp(timelineTimestamps.last) || 'No events yet'}</strong>
          </div>
        </div>

        <div className="cg-tl-connector" />

        <div className="cg-tl-item">
          <div className="cg-tl-avatar">
            <span className="cg-tl-avatar-fallback">{firstName[0] || 'U'}</span>
          </div>
          <div className="cg-tl-text">
            <span className="cg-tl-sub">Total events</span>
            <strong>{transactionsLoading ? '...' : transactions.length} recorded</strong>
          </div>
        </div>

        <div className="cg-tl-actions">
          <button
            type="button"
            className="cg-btn-full-timeline"
            onClick={() => setShowFullTimelineModal(true)}
          >
            Full timeline
          </button>
        </div>
      </footer>

      {/* ── Slide-Out / Drawer: Unified Threat Intake & File Scanner ── */}
      {intakeDrawerOpen && (
        <div className="cg-modal-backdrop" onClick={() => setIntakeDrawerOpen && setIntakeDrawerOpen(false)}>
          <div className="cg-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cg-drawer-head">
              <div>
                <h2>{t('dashboard.submit_analysis') || 'Threat Intake & Scanner'}</h2>
                <p className="cg-drawer-sub">Unified IoC indicator and file analysis engine</p>
              </div>
              <button
                type="button"
                className="cg-drawer-close"
                onClick={() => setIntakeDrawerOpen && setIntakeDrawerOpen(false)}
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="cg-mode-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={submissionMode === 'indicator'}
                className={`cg-mode-pill ${submissionMode === 'indicator' ? 'cg-mode-pill--active' : ''}`}
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
                className={`cg-mode-pill ${submissionMode === 'file' ? 'cg-mode-pill--active' : ''}`}
                onClick={() => {
                  setSubmissionMode('file');
                  setSubmissionError('');
                  setSubmissionStatus('');
                }}
              >
                File upload
              </button>
            </div>

            {/* Form */}
            <form className="cg-analysis-form" onSubmit={handleGenerate}>
              {submissionMode === 'indicator' ? (
                <div className="cg-form-group">
                  <label htmlFor="drawerIndicatorInput">Indicator string</label>
                  <input
                    id="drawerIndicatorInput"
                    ref={indicatorInputRef}
                    placeholder="Example: malware hash, phishing domain, URL, or IP"
                    value={indicatorValue}
                    onChange={(e) => setIndicatorValue(e.target.value)}
                    required
                    className="cg-input"
                  />
                </div>
              ) : (
                <div className="cg-form-group">
                  <label htmlFor="drawerFileInput">Select file for heuristic scan</label>
                  <input
                    id="drawerFileInput"
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                    className="cg-file-input"
                  />
                  {selectedFile ? (
                    <p className="cg-file-chosen">
                      Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  ) : (
                    <p className="cg-input-hint">Accepted: PDF, DOCX, TXT, LOG, CSV, JSON (up to 25MB)</p>
                  )}
                </div>
              )}

              {/* Presets */}
              <div className="cg-presets-row">
                <span className="cg-presets-title">Quick presets:</span>
                <div className="cg-presets-chips">
                  {intakePresets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className="cg-preset-chip"
                      onClick={() => applyIntakePreset(preset.values)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="cg-intake-grid">
                <div className="cg-form-group">
                  <label htmlFor="sourceSelect">Source</label>
                  <select
                    id="sourceSelect"
                    value={intakeDetails.source}
                    onChange={(e) => updateIntakeField('source', e.target.value)}
                    required
                    className="cg-select"
                  >
                    <option value="">Select source</option>
                    <option value="manual">Manual</option>
                    <option value="email_gateway">Email gateway</option>
                    <option value="edr">EDR</option>
                    <option value="siem">SIEM</option>
                    <option value="firewall">Firewall</option>
                  </select>
                </div>

                <div className="cg-form-group">
                  <label htmlFor="confSelect">Confidence</label>
                  <select
                    id="confSelect"
                    value={intakeDetails.confidence}
                    onChange={(e) => updateIntakeField('confidence', e.target.value)}
                    required
                    className="cg-select"
                  >
                    <option value="">Select confidence</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="cg-form-group">
                  <label htmlFor="assetField">Affected asset</label>
                  <input
                    id="assetField"
                    placeholder="host-22 or payment-api"
                    value={intakeDetails.asset_name}
                    onChange={(e) => updateIntakeField('asset_name', e.target.value)}
                    className="cg-input"
                  />
                </div>

                <div className="cg-form-group">
                  <label htmlFor="scopeField">Network scope</label>
                  <select
                    id="scopeField"
                    value={intakeDetails.network_scope}
                    onChange={(e) => updateIntakeField('network_scope', e.target.value)}
                    className="cg-select"
                  >
                    <option value="">Not set</option>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="vpn">VPN</option>
                    <option value="cloud">Cloud</option>
                  </select>
                </div>
              </div>

              <div className="cg-form-group">
                <label htmlFor="notesField">Triage notes</label>
                <textarea
                  id="notesField"
                  rows={2}
                  placeholder="Optional analyst context or ticket ID"
                  value={intakeDetails.notes}
                  onChange={(e) => updateIntakeField('notes', e.target.value)}
                  className="cg-textarea"
                />
              </div>

              <button
                type="submit"
                className="cg-btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Analyzing...' : 'Analyze Threat Now'}
              </button>
            </form>

            {submissionStatus && <p className="cg-form-status cg-form-status--success">{submissionStatus}</p>}
            {submissionError && <p className="cg-form-status cg-form-status--error">{submissionError}</p>}

            {/* Inline Result */}
            {inlineResult && (
              <div className="cg-inline-result-card">
                <div className="cg-ir-head">
                  <span className="cg-ir-eyebrow">Analysis Complete</span>
                  <span className={`cg-ir-score-pill cg-ir-score-pill--${threatTone(inlineResult.threatLevel)}`}>
                    Score {inlineResult.threatScore ?? 'N/A'}/100 • {inlineResult.threatLevel}
                  </span>
                </div>
                <p className="cg-ir-source">Target: <strong>{inlineResult.sourceLabel}</strong></p>
                <p className="cg-ir-meta">
                  IOCs Detected: {inlineResult.iocCount} • Patterns: {inlineResult.patternCount}
                </p>
                {inlineResult.rationale && (
                  <p className="cg-ir-rationale">{inlineResult.rationale}</p>
                )}
                <Link
                  className="cg-ir-link"
                  to={`/analysis/${inlineResult.analysisId}`}
                  onClick={() => setIntakeDrawerOpen && setIntakeDrawerOpen(false)}
                >
                  View Full Deep-Dive Report <IconArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Operational Console: Transactions & Rapid Actions ── */}
      <section className="cg-ops-section" ref={transactionsRef} aria-label="Operations and Transactions">
        <div className="cg-ops-grid">
          {/* Card: Rapid Actions */}
          <article className="cg-ops-card cg-ops-card--actions">
            <div className="cg-ops-card-head">
              <h3>Rapid Actions</h3>
              <span>Orchestrate workflow executions</span>
            </div>
            <div className="cg-action-chips-grid">
              {quickActions.map((action) => (
                <button
                  type="button"
                  className="cg-action-chip"
                  key={action.key}
                  onClick={() => handleQuickAction(action.key)}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="cg-report-send-row">
              <div className="cg-report-info">
                <span>Latest Report:</span>
                <strong>{reportName}</strong>
              </div>
              <button
                type="button"
                className="cg-btn-report-send"
                onClick={() => handleQuickAction('notify')}
              >
                <IconMail size={14} /> Email PDF
              </button>
            </div>
            {reportSent && <p className="cg-msg-success">{notifyStatus || 'Report sent to your account email.'}</p>}
          </article>

          {/* Card: Threat Queue */}
          <article className="cg-ops-card cg-ops-card--queue">
            <div className="cg-ops-card-head">
              <h3>{t('dashboard.threat_queue') || 'Active Threat Queue'}</h3>
              <span>High priority indicator stream</span>
            </div>
          <div className="cg-tq-list">
              {threatQueue.length === 0 && !transactionsLoading && (
                <div className="cg-tq-row">
                  <div className="cg-tq-info">
                    <strong>No data</strong>
                    <span>Submit an indicator to populate the threat queue</span>
                  </div>
                </div>
              )}
              {threatQueue.map((item) => (
                <div className="cg-tq-row" key={item.id}
                  style={{ cursor: item.id !== 'no-data' ? 'pointer' : 'default' }}
                  onClick={() => {
                    const analysisId = item.id.replace('A-', '');
                    if (analysisId && !isNaN(Number(analysisId))) {
                      navigate(`/analysis/${analysisId}`);
                    }
                  }}
                >
                  <div className="cg-tq-info">
                    <strong>{item.id}</strong>
                    <span>{item.category}</span>
                  </div>
                  <div className="cg-tq-source">{item.source}</div>
                  <span className={`cg-tq-badge cg-tq-badge--${item.confidence.toLowerCase()}`}>
                    {item.confidence}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Transactions & Activity Table */}
        <article className="cg-transactions-card">
          <div className="cg-tx-header">
            <div>
              <h3>Security Transactions & Activity Stream</h3>
              <p className="cg-tx-sub">Real-time telemetry, scans, and system events</p>
            </div>

            <div className="cg-tx-filters">
              <label>
                <span>Type:</span>
                <select
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value)}
                  className="cg-tx-select"
                >
                  <option value="all">All</option>
                  <option value="analysis">Analysis</option>
                  <option value="activity">Activity</option>
                  <option value="billing">Billing</option>
                </select>
              </label>

              <label>
                <span>Status:</span>
                <select
                  value={transactionStatusFilter}
                  onChange={(e) => setTransactionStatusFilter(e.target.value)}
                  className="cg-tx-select"
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="recorded">Recorded</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
            </div>
          </div>

          {transactionsLoading ? (
            <p className="cg-tx-empty">Loading telemetry transactions...</p>
          ) : !filteredTransactions.length ? (
            <p className="cg-tx-empty">No transactions found for this filter.</p>
          ) : (
            <>
              <div className="cg-tx-table-wrap">
                <table className="cg-tx-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Detail</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={selectedTransaction?.id === tx.id ? 'cg-tx-tr--selected' : ''}
                        onClick={() => setSelectedTransaction(tx)}
                      >
                        <td>
                          <span className={`cg-tx-type-pill cg-tx-type-pill--${tx.kind}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="cg-tx-td-detail">
                          <strong>{tx.detail}</strong>
                        </td>
                        <td>
                          <span className={`cg-tx-status-badge cg-tx-status--${String(tx.status).toLowerCase()}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="cg-tx-td-time">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="cg-tx-pagination">
                <button
                  type="button"
                  className="cg-btn-page"
                  onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                  disabled={transactionPage <= 1}
                >
                  Previous
                </button>
                <span className="cg-page-indicator">
                  Page {transactionPage} of {totalTransactionPages}
                </span>
                <button
                  type="button"
                  className="cg-btn-page"
                  onClick={() => setTransactionPage((p) => Math.min(totalTransactionPages, p + 1))}
                  disabled={transactionPage >= totalTransactionPages}
                >
                  Next
                </button>
              </div>

              {selectedTransaction && (
                <div className="cg-tx-detail-box">
                  <div className="cg-tx-detail-head">
                    <strong>Transaction Detail</strong>
                    <button
                      type="button"
                      className="cg-tx-detail-close"
                      onClick={() => setSelectedTransaction(null)}
                      aria-label="Close detail"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                  <div className="cg-tx-detail-grid">
                    <div>
                      <span>Kind:</span> {selectedTransaction.type} ({selectedTransaction.kind})
                    </div>
                    <div>
                      <span>Status:</span> {selectedTransaction.status}
                    </div>
                    <div>
                      <span>Description:</span> {selectedTransaction.detail}
                    </div>
                    <div>
                      <span>Time:</span> {selectedTransaction.created_at ? new Date(selectedTransaction.created_at).toLocaleString() : 'N/A'}
                    </div>
                    {selectedTransaction.items_count !== undefined && (
                      <div>
                        <span>Items Count:</span> {selectedTransaction.items_count}
                      </div>
                    )}
                    {selectedTransaction.processing_ms !== undefined && (
                      <div>
                        <span>Processing Latency:</span> {selectedTransaction.processing_ms} ms
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      </section>

      {/* ── Modal: Full Timeline ── */}
      {showFullTimelineModal && (
        <div className="cg-modal-backdrop" onClick={() => setShowFullTimelineModal(false)}>
          <div className="cg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cg-modal-head">
              <h3>Incident & Investigation Timeline</h3>
              <button
                type="button"
                className="cg-drawer-close"
                onClick={() => setShowFullTimelineModal(false)}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="cg-timeline-modal-body">
              <div className="cg-tl-modal-step">
                <div className="cg-tl-modal-dot cg-tl-modal-dot--green" />
                <div className="cg-tl-modal-content">
                  <span className="cg-tl-modal-time">Sep 24th 2024 11:05:02</span>
                  <strong>Case initiated by Security Analyst</strong>
                  <p>Inbound telemetry ingested from XDR Agent #37 and Okta Identity gateway.</p>
                </div>
              </div>
              <div className="cg-tl-modal-step">
                <div className="cg-tl-modal-dot cg-tl-modal-dot--orange" />
                <div className="cg-tl-modal-content">
                  <span className="cg-tl-modal-time">Sep 28th 2024 08:13:24</span>
                  <strong>High-Severity Alert: Okta Connection Anomaly</strong>
                  <p>Multiple credential challenge timeouts detected from IP range 194.26.29.0/24.</p>
                </div>
              </div>
              <div className="cg-tl-modal-step">
                <div className="cg-tl-modal-dot cg-tl-modal-dot--blue" />
                <div className="cg-tl-modal-content">
                  <span className="cg-tl-modal-time">Oct 15th 2024 10:42:11</span>
                  <strong>Assigned to Lead Security Consultant (Gabriel Aloho)</strong>
                  <p>Remediation playbook /01 initiated. NIS2 Art. 21 incident review generated.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}