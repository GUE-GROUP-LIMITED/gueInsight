import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import './Resources.css';

const industryUseCases = [
  {
    title: 'Healthcare',
    body: 'Track audit evidence, data-subject requests, and incident response steps for regulated patient data workflows.',
  },
  {
    title: 'Finance',
    body: 'Map access controls and tenant drift across Microsoft 365 and Google Workspace for audit-ready reporting.',
  },
  {
    title: 'Public Sector',
    body: 'Use EU residency, export/delete workflows, and incident summaries to support procurement and oversight requirements.',
  },
  {
    title: 'Manufacturing',
    body: 'Combine threat intelligence and compliance workflows to protect distributed plants, vendors, and service accounts.',
  },
];

const comparisonRows = [
  ['Compliance automation', 'Yes', 'Yes', 'No'],
  ['Threat intelligence triage', 'Yes', 'Limited', 'Usually separate tool'],
  ['EU-only data residency', 'Elite tier', 'Depends on deployment', 'Depends on vendor'],
  ['vCISO guidance', 'Built in', 'No', 'No'],
  ['Public pricing', 'Yes', 'Yes', 'No'],
];

const thoughtLeadership = [
  {
    title: 'NIS2 readiness for Belgian SMEs',
    body: 'Short, practical guidance on incident reporting, evidence collection, and control ownership.',
  },
  {
    title: 'GDPR operations that scale',
    body: 'How to keep export, deletion, and audit workflows usable without a full security team.',
  },
  {
    title: 'Security operations without SIEM sprawl',
    body: 'Where GueInsight fits alongside existing EDR and cloud security tooling.',
  },
];

export default function Resources() {
  const [hoursSaved, setHoursSaved] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(85);
  const [auditReduction, setAuditReduction] = useState(35);

  const roi = useMemo(() => {
    const savedPerMonth = Math.max(0, Number(hoursSaved) * Number(hourlyRate));
    const annualValue = savedPerMonth * 12;
    const adjusted = annualValue * (Math.max(0, Math.min(100, Number(auditReduction))) / 100);
    return Math.round(adjusted);
  }, [auditReduction, hoursSaved, hourlyRate]);

  return (
    <>
      <PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/subscription" resourcesTo="/resources" statusTo="/status" trialTo="/subscription" />
      <main className="resources-page">
        <section className="resources-page__hero">
          <p className="resources-page__eyebrow">Growth & distribution</p>
          <h1>Resources that help prospects understand the product fast</h1>
          <p>
            This page is intentionally practical: use cases, a competitor snapshot, an ROI calculator,
            and editorial topics you can turn into a blog or newsletter cadence.
          </p>
          <div className="resources-page__hero-actions">
            <Link to="/subscription" className="resources-page__button resources-page__button--primary">See pricing</Link>
            <Link to="/support" className="resources-page__button resources-page__button--ghost">Talk to sales</Link>
          </div>
        </section>

        <section className="resources-page__section">
          <div className="resources-page__section-head">
            <p className="resources-page__eyebrow">Industry use cases</p>
            <h2>Landing pages you can tailor by vertical</h2>
          </div>
          <div className="resources-page__grid">
            {industryUseCases.map((item) => (
              <article key={item.title} className="resources-page__card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="resources-page__section resources-page__section--alt">
          <div className="resources-page__section-head">
            <p className="resources-page__eyebrow">Comparison snapshot</p>
            <h2>Positioning against the tools buyers already know</h2>
          </div>
          <div className="resources-page__table-wrap">
            <table className="resources-page__table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>GueInsight</th>
                  <th>Compliance-only platform</th>
                  <th>Generic MSSP stack</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="resources-page__section">
          <div className="resources-page__section-head">
            <p className="resources-page__eyebrow">ROI calculator</p>
            <h2>Show the value in minutes, not just features</h2>
          </div>
          <div className="resources-page__roi">
            <label>
              <span>Hours saved per month</span>
              <input type="range" min="0" max="40" value={hoursSaved} onChange={(event) => setHoursSaved(event.target.value)} />
              <strong>{hoursSaved} hours</strong>
            </label>
            <label>
              <span>Average hourly cost (€)</span>
              <input type="number" min="0" step="5" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
            </label>
            <label>
              <span>Audit prep reduction (%)</span>
              <input type="number" min="0" max="100" step="5" value={auditReduction} onChange={(event) => setAuditReduction(event.target.value)} />
            </label>
            <div className="resources-page__roi-result">
              <p>Estimated annual value</p>
              <strong>€{roi.toLocaleString()}</strong>
              <span>Use this as a rough sales conversation starter.</span>
            </div>
          </div>
        </section>

        <section className="resources-page__section resources-page__section--alt">
          <div className="resources-page__section-head">
            <p className="resources-page__eyebrow">Thought leadership</p>
            <h2>Topics to publish regularly</h2>
          </div>
          <div className="resources-page__grid resources-page__grid--narrow">
            {thoughtLeadership.map((item) => (
              <article key={item.title} className="resources-page__card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}