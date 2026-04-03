import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import UserTopbarControls from '../components/UserTopbarControls';
import { api } from '../services/api';
import './Dashboard.css';

const threatQueue = [
  { id: 'Q-3391', category: 'Phishing domain', confidence: 'High', source: 'Email gateway' },
  { id: 'Q-3284', category: 'Suspicious hash', confidence: 'Medium', source: 'Endpoint sensor' },
  { id: 'Q-3241', category: 'Credential abuse', confidence: 'High', source: 'Identity logs' },
];

const quickActions = ['Upload indicators', 'Run enrichment', 'Export report', 'Notify stakeholders'];

export default function Dashboard() {
  const { user } = useContext(AuthContext);
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

  const firstName = user?.first_name || 'Analyst';
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
      { label: 'Recent actions', value: String(filteredTransactions.length), detail: 'Latest activity and analysis records' },
      { label: 'Analyses this session', value: lastSubmission ? '1' : '0', detail: planLimitsText },
      { label: 'Last report', value: reportName, detail: 'Generated from your latest analysis' },
    ],
    [filteredTransactions.length, lastSubmission, planLimitsText, reportName]
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

  return (
    <main className="user-dashboard">
      <div className="user-dashboard__grid-overlay" aria-hidden="true" />

      <section className="user-dashboard__hero">
        <div>
          <p className="user-dashboard__eyebrow">SOC Workspace</p>
          <h1>Operator Console: {firstName}</h1>
          <p className="user-dashboard__lead">
            Review active signals, run indicator analysis, and publish reports from one controlled command center.
          </p>
        </div>
        <UserTopbarControls />
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
            <h2>Submit for analysis</h2>
            <span>Paste IOC, hash, URL, or domain</span>
          </div>

          <form className="user-dashboard__analysis-form" onSubmit={handleGenerate}>
            <label htmlFor="inputText">Indicator input</label>
            <input
              id="inputText"
              placeholder="Example: 185.199.110.153 or suspicious-domain.com"
              value={indicatorValue}
              onChange={(event) => setIndicatorValue(event.target.value)}
              required
            />
            <button type="submit" className="user-dashboard__button user-dashboard__button--primary">Analyze now</button>
          </form>

          {lastSubmission ? (
            <p className="user-dashboard__hint">
              Last submitted indicator: <strong>{lastSubmission}</strong>
            </p>
          ) : (
            <p className="user-dashboard__hint">No submissions yet in this session.</p>
          )}

          <p className="user-dashboard__hint">
            Plan limits: <strong>{planLimitsText}</strong>
          </p>
        </article>

        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>Reports</h2>
            <span>Distribution and evidence handoff</span>
          </div>

          <p className="user-dashboard__report-line">
            Latest report: <strong>{reportName}</strong>
          </p>

          <div className="user-dashboard__button-row">
            <button type="button" className="user-dashboard__button user-dashboard__button--secondary" onClick={handleSend}>
              Send via email
            </button>
            <Link to="/profile" className="user-dashboard__button user-dashboard__button--ghost">View account details</Link>
            <Link to="/support" className="user-dashboard__button user-dashboard__button--ghost">Create ticket</Link>
          </div>

          {reportSent ? <p className="user-dashboard__success">Report sent successfully.</p> : null}
        </article>

        <article className="user-dashboard__card user-dashboard__card--queue">
          <div className="user-dashboard__card-head">
            <h2>Threat queue</h2>
            <span>Live triage priorities</span>
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
              <div className="user-dashboard__transactions-table-wrap">
                <table className="user-dashboard__transactions-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Summary</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedTransaction(item)}>
                        <td>{item.type}</td>
                        <td>{item.status}</td>
                        <td>{item.detail}</td>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <div className="user-dashboard__transaction-detail">
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