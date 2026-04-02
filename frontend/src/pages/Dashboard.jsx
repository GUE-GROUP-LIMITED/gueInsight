import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [reportName, setReportName] = useState('incident-summary.pdf');
  const [reportSent, setReportSent] = useState(false);
  const [indicatorValue, setIndicatorValue] = useState('');
  const [lastSubmission, setLastSubmission] = useState('');

  const firstName = user?.first_name || 'Analyst';
  const currentPlan = user?.current_plan ? String(user.current_plan).replaceAll('_', ' ') : 'free';

  const dashboardStats = useMemo(
    () => [
      { label: 'Current plan', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), detail: 'Upgrade any time from Plans' },
      { label: 'Analyses this session', value: lastSubmission ? '1' : '0', detail: 'Track your latest indicator run' },
      { label: 'Last report', value: reportName, detail: 'Generated from your latest analysis' },
    ],
    [currentPlan, lastSubmission, reportName]
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
      <section className="user-dashboard__hero">
        <div>
          <p className="user-dashboard__eyebrow">User workspace</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="user-dashboard__lead">
            Investigate suspicious indicators, generate shareable reports, and keep your team aligned from one place.
          </p>
        </div>
        <div className="user-dashboard__hero-actions">
          <Link to="/subscription" className="user-dashboard__button user-dashboard__button--primary">Manage plan</Link>
          <Link to="/profile" className="user-dashboard__button user-dashboard__button--ghost">Account settings</Link>
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
            <span>Paste IOC, hash, or URL</span>
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
        </article>

        <article className="user-dashboard__card">
          <div className="user-dashboard__card-head">
            <h2>Reports</h2>
            <span>Share findings quickly</span>
          </div>

          <p className="user-dashboard__report-line">
            Latest report: <strong>{reportName}</strong>
          </p>

          <div className="user-dashboard__button-row">
            <button type="button" className="user-dashboard__button user-dashboard__button--secondary" onClick={handleSend}>
              Send via email
            </button>
            <Link to="/profile" className="user-dashboard__button user-dashboard__button--ghost">View account details</Link>
          </div>

          {reportSent ? <p className="user-dashboard__success">Report sent successfully.</p> : null}
        </article>
      </section>
    </main>
  );
}