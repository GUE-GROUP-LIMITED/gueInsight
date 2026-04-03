import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
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

  const firstName = user?.first_name || 'Analyst';
  const currentPlan = user?.current_plan ? String(user.current_plan).replaceAll('_', ' ') : 'free';
  const analysisLimits = user?.analysis_limits || null;
  const planLimitsText = analysisLimits
    ? `${analysisLimits.max_items_per_analysis} items/run • ${analysisLimits.max_text_chars} chars • ${analysisLimits.max_file_size_mb}MB file`
    : 'Limits load from your active plan';

  const dashboardStats = useMemo(
    () => [
      { label: 'Current plan', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), detail: 'Upgrade any time from Plans' },
      { label: 'Analyses this session', value: lastSubmission ? '1' : '0', detail: planLimitsText },
      { label: 'Last report', value: reportName, detail: 'Generated from your latest analysis' },
    ],
    [currentPlan, lastSubmission, planLimitsText, reportName]
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
        <div className="user-dashboard__hero-actions">
          <Link to="/subscription" className="user-dashboard__button user-dashboard__button--primary">Manage plan</Link>
          <Link to="/profile" className="user-dashboard__button user-dashboard__button--ghost">Account settings</Link>
          <Link to="/support" className="user-dashboard__button user-dashboard__button--ghost">Open support</Link>
        </div>
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
      </section>
    </main>
  );
}