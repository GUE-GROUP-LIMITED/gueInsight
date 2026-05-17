import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './Dashboard.css';
import { useTranslation } from '../i18n/index';

const threatQueue = [
  { id: 'Q-3391', category: 'Phishing domain', confidence: 'High', source: 'Email gateway' },
  { id: 'Q-3284', category: 'Suspicious hash', confidence: 'Medium', source: 'Endpoint sensor' },
  { id: 'Q-3241', category: 'Credential abuse', confidence: 'High', source: 'Identity logs' },
];

const quickActions = ['Upload indicators', 'Run enrichment', 'Export report', 'Notify stakeholders'];

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const [reportName, setReportName] = useState('incident-summary.pdf');
  const [reportSent, setReportSent] = useState(false);
  const [indicatorValue, setIndicatorValue] = useState('');
  const [lastSubmission, setLastSubmission] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const firstName = user?.first_name || t('dashboard.analyst');
  const analysisLimits = user?.analysis_limits || null;
  const planLimitsText = analysisLimits
    ? `${analysisLimits.max_items_per_analysis} items/run • ${analysisLimits.max_text_chars} chars • ${analysisLimits.max_file_size_mb}MB file`
    : 'Limits load from your active plan';

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

  const handleGenerate = (event) => {
    event.preventDefault();
    const cleaned = indicatorValue.trim();
    if (!cleaned) return;

    setReportSent(false);
    setLastSubmission(cleaned);
    setReportName(`report-${Date.now()}.pdf`);
    setIndicatorValue('');
  };

  const handleSend = () => setReportSent(true);

  const selectedTransactionStyle = useMemo(() => {
    if (!selectedTransaction) return null;
    const toneMap = {
      analysis: 'analysis',
      activity: 'activity',
      billing: 'billing',
    };
    return toneMap[selectedTransaction.kind] || 'neutral';
  }, [selectedTransaction]);

  return (
    <main className="user-dashboard">
      <div className="user-dashboard__grid-overlay" aria-hidden="true" />

      <section className="user-dashboard__hero">
        <div className="user-dashboard__hero-copy">
          <p className="user-dashboard__eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{t('dashboard.title', { name: firstName })}</h1>
          <p className="user-dashboard__lead">{t('dashboard.lead')}</p>
        </div>

        <aside className="user-dashboard__hero-panel" aria-label="Account summary">
          <p className="user-dashboard__hero-panel-label">{t('topbar.profile_menu')}</p>
          <strong>{firstName}</strong>
          <span>{user?.email}</span>
          <div className="user-dashboard__hero-panel-meta">
            <span>{String(user?.current_plan || 'free').replaceAll('_', ' ')}</span>
            <span>{user?.role || 'user'}</span>
          </div>
        </aside>
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

      <section className="user-dashboard__grid">
        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>{t('dashboard.submit_analysis')}</h2>
            <span>{t('dashboard.submit_analysis_sub')}</span>
          </div>

          <form className="user-dashboard__analysis-form" onSubmit={handleGenerate}>
            <label htmlFor="inputText">{t('dashboard.indicator_input')}</label>
            <input
              id="inputText"
              placeholder={t('dashboard.indicator_placeholder')}
              value={indicatorValue}
              onChange={(event) => setIndicatorValue(event.target.value)}
              required
            />
            <button type="submit" className="user-dashboard__button user-dashboard__button--primary">{t('dashboard.analyze_now')}</button>
          </form>

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
            <Link to="/profile" className="user-dashboard__button user-dashboard__button--ghost">{t('dashboard.view_account_details')}</Link>
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
              <button type="button" className="user-dashboard__action-chip" key={action}>
                {action}
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
    </main>
  );
}