import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import './Documentation.css';
import { useTranslation } from '../i18n/index';

const DOC_OVERVIEW_CARDS = [
  {
    title: '1. Get started',
    text: 'Create an account, verify your email, and land on the Free plan with no card required.',
    linkTo: '#getting-started',
    linkLabel: 'Open getting started',
  },
  {
    title: '2. Analyze content',
    text: 'Upload files, paste text, or scan URLs to surface threats, anomalies, and remediation guidance.',
    linkTo: '#file-analysis',
    linkLabel: 'Open analysis guide',
  },
  {
    title: '3. Connect systems',
    text: 'Link Microsoft 365 or Google Workspace to inspect tenant security and compliance settings.',
    linkTo: '#cloud-integrations',
    linkLabel: 'Open integrations guide',
  },
  {
    title: '4. Govern compliance',
    text: 'Generate GDPR, NIS2, and audit reports from the dashboard and keep evidence ready for review.',
    linkTo: '#compliance',
    linkLabel: 'Open compliance guide',
  },
];

const DOC_API_ENDPOINTS = [
  { method: 'GET', path: '/api/public/landing-snapshot', detail: 'Public dashboard snapshot used on the landing page.' },
  { method: 'GET', path: '/auth/analytics/summary', detail: 'Authenticated analytics summary for dashboard reporting.' },
  { method: 'GET', path: '/auth/dashboard/compliance', detail: 'Compliance posture and plan-tier overview.' },
  { method: 'GET', path: '/auth/integrations', detail: 'List configured security tool integrations for the current account.' },
];

const DOC_QUICK_LINKS = [
  { href: '#getting-started', label: 'Getting Started' },
  { href: '#file-analysis', label: 'File Analysis' },
  { href: '#cloud-integrations', label: 'Cloud Integrations' },
  { href: '#compliance', label: 'Compliance' },
  { href: '#features', label: 'Features & Limits' },
  { href: '#faq', label: 'FAQ' },
];

const Documentation = () => {
  const [darkMode, setDarkMode] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const existing = localStorage.getItem('docs-dark-mode') === '1';
    setDarkMode(existing);
    if (existing) document.body.classList.add('theme-dark');
    else document.body.classList.remove('theme-dark');
    // Mark this page so we can override the fixed footer (prevent overlap)
    document.body.classList.add('page-docs');
    return () => { document.body.classList.remove('page-docs'); };
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('docs-dark-mode', next ? '1' : '0');
    if (next) document.body.classList.add('theme-dark');
    else document.body.classList.remove('theme-dark');
  };

  return (
    <>
      <PublicHeader featureTo="/#features" howTo="#getting-started" whoTo="/#who" pricingTo="/#pricing" trialTo="/signup" />
      <main className="documentation-page">
        <section className="documentation-page__hero">
          <div className="documentation-page__hero-copy">
            <p className="documentation-page__eyebrow">Product guide</p>
            <h1>{t('docs.title')}</h1>
            <p>{t('docs.subtitle')}</p>
            <div className="documentation-page__hero-actions">
              <button onClick={toggleDarkMode} className="btn btn--docs">
                {darkMode ? t('docs.light_mode') : t('docs.dark_mode')}
              </button>
              <Link to="/signup" className="btn btn--docs-secondary">Create account</Link>
            </div>
          </div>
          <aside className="documentation-page__hero-panel">
            <p className="documentation-page__panel-label">At a glance</p>
            <div className="documentation-page__overview-grid">
              {DOC_OVERVIEW_CARDS.map((card) => (
                <a key={card.title} href={card.linkTo} className="documentation-page__overview-card">
                  <span>{card.title}</span>
                  <p>{card.text}</p>
                  <strong>{card.linkLabel}</strong>
                </a>
              ))}
            </div>
          </aside>
        </section>

        <nav className="documentation-page__nav" aria-label="Documentation sections">
          {DOC_QUICK_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nav-link">{link.label}</a>
          ))}
        </nav>

        <article className="documentation-page__content">
          <section id="getting-started" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Start here</p>
              <h2>{t('docs.getting_started_title')}</h2>
              <p>Set up your account, choose the right plan, and reach the dashboard in a few minutes.</p>
            </div>

            <div className="doc-grid doc-grid--three">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.step1_title')}</h3>
                <ol>
                  <li>{t('docs.step1_item1')} <Link to="/signup">{t('nav.signup')}</Link></li>
                  <li>{t('docs.step1_item2')}</li>
                  <li>{t('docs.step1_item3')}</li>
                  <li>{t('docs.step1_item4')}</li>
                </ol>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.step2_title')}</h3>
                <p>{t('docs.step2_intro')}</p>
                <ul className="plan-list">
                  <li><strong>Free</strong> — Free forever for basic analysis and learning</li>
                  <li><strong>Starter</strong> — €49.90/month for small teams and individual professionals</li>
                  <li><strong>Compliance Pro</strong> — €99.90/month for GDPR-focused threat detection</li>
                  <li><strong>Enterprise Professional</strong> — €299.90/month for GDPR + NIS2 compliance</li>
                  <li><strong>Enterprise Risk</strong> — €499/month for NIS2 + ISO27001 critical infrastructure</li>
                  <li><strong>Enterprise Elite</strong> — €999/month for SOC2 readiness and EU data residency</li>
                </ul>
                <p>{t('docs.step2_outro_prefix')} <Link to="/subscription">{t('docs.subscription_link')}</Link> {t('docs.step2_outro_suffix')}</p>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.step3_title')}</h3>
                <p>{t('docs.step3_intro_prefix')} <Link to="/dashboard">{t('nav.dashboard')}</Link>. {t('docs.step3_intro_suffix')}</p>
                <ul>
                  <li>{t('docs.step3_item1')}</li>
                  <li>{t('docs.step3_item2')}</li>
                  <li>{t('docs.step3_item3')}</li>
                  <li>{t('docs.step3_item4')}</li>
                  <li>{t('docs.step3_item5')}</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="api-access" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">API access</p>
              <h2>Developer-facing endpoints</h2>
              <p>API access is currently exposed for integrations and authenticated dashboard workflows. This is the minimal public reference.</p>
            </div>

            <div className="doc-subsection doc-card">
              <table className="features-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {DOC_API_ENDPOINTS.map((endpoint) => (
                    <tr key={endpoint.path}>
                      <td>{endpoint.method}</td>
                      <td><code>{endpoint.path}</code></td>
                      <td>{endpoint.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: '16px' }}>
                Authenticated endpoints require a logged-in session. For enterprise integrations, contact support for implementation help and access guidance.
              </p>
            </div>
          </section>

          <section id="file-analysis" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Threat analysis</p>
              <h2>{t('docs.file_analysis_title')}</h2>
              <p>Use the dashboard to inspect files, text, and URLs, then review the score and remediation steps.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.uploading_files_title')}</h3>
                <ol>
                  <li>{t('docs.uploading_files_item1')} <Link to="/dashboard">{t('nav.dashboard')}</Link> → {t('docs.upload_button')}</li>
                  <li>{t('docs.uploading_files_item2')}</li>
                  <li>{t('docs.uploading_files_item3')}</li>
                  <li>{t('docs.uploading_files_item4')}</li>
                </ol>
                <p><strong>{t('docs.file_size_limits')}</strong></p>
                <ul>
                  <li>{t('docs.starter_limit')}</li>
                  <li>{t('docs.compliance_pro_limit')}</li>
                  <li>{t('docs.enterprise_risk_limit')}</li>
                  <li>{t('docs.enterprise_elite_limit')}</li>
                </ul>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.understanding_results_title')}</h3>
                <p><strong>{t('docs.risk_scores')}</strong></p>
                <ul>
                  <li><span className="risk-low">{t('docs.risk_low_label')}</span> — {t('docs.risk_low_desc')}</li>
                  <li><span className="risk-medium">{t('docs.risk_medium_label')}</span> — {t('docs.risk_medium_desc')}</li>
                  <li><span className="risk-high">{t('docs.risk_high_label')}</span> — {t('docs.risk_high_desc')}</li>
                  <li><span className="risk-critical">{t('docs.risk_critical_label')}</span> — {t('docs.risk_critical_desc')}</li>
                </ul>
                <p>{t('docs.results_outro')}</p>
              </div>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.analyzing_text_title')}</h3>
                <ol>
                  <li>{t('docs.analyzing_text_item1')}</li>
                  <li>{t('docs.analyzing_text_item2')}</li>
                  <li>{t('docs.analyzing_text_item3')}</li>
                  <li>{t('docs.analyzing_text_item4')}</li>
                </ol>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.analyzing_urls_title')}</h3>
                <ol>
                  <li>{t('docs.analyzing_urls_item1')}</li>
                  <li>{t('docs.analyzing_urls_item2')}</li>
                  <li>{t('docs.analyzing_urls_item3')}</li>
                  <li>{t('docs.analyzing_urls_item4')}</li>
                </ol>
              </div>
            </div>
          </section>

          <section id="cloud-integrations" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Integrations</p>
              <h2>{t('docs.cloud_title')}</h2>
              <p>Connect Microsoft 365 or Google Workspace to audit security settings and generate compliance evidence.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.m365_title')}</h3>
                <p>{t('docs.m365_intro')}</p>
                <ol>
                  <li>{t('docs.m365_item1')} <Link to="/dashboard">{t('nav.dashboard')}</Link> → {t('docs.connect_m365')}</li>
                  <li>{t('docs.m365_item2')}</li>
                  <li>{t('docs.m365_item3')}</li>
                  <li>{t('docs.m365_item4')}:
                    <ul>
                      <li>{t('docs.m365_sub1')}</li>
                      <li>{t('docs.m365_sub2')}</li>
                      <li>{t('docs.m365_sub3')}</li>
                      <li>{t('docs.m365_sub4')}</li>
                      <li>{t('docs.m365_sub5')}</li>
                    </ul>
                  </li>
                  <li>{t('docs.m365_item5')}</li>
                </ol>
                <p><strong>{t('docs.permissions_granted')}</strong> {t('docs.permissions_granted_desc')}</p>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.gws_title')}</h3>
                <p>{t('docs.gws_intro')}</p>
                <ol>
                  <li>{t('docs.gws_item1')} <Link to="/dashboard">{t('nav.dashboard')}</Link> → {t('docs.connect_gws')}</li>
                  <li>{t('docs.gws_item2')}</li>
                  <li>{t('docs.gws_item3')}</li>
                  <li>{t('docs.gws_item4')}:
                    <ul>
                      <li>{t('docs.gws_sub1')}</li>
                      <li>{t('docs.gws_sub2')}</li>
                      <li>{t('docs.gws_sub3')}</li>
                      <li>{t('docs.gws_sub4')}</li>
                      <li>{t('docs.gws_sub5')}</li>
                    </ul>
                  </li>
                  <li>{t('docs.gws_item5')}</li>
                </ol>
              </div>
            </div>

            <div className="doc-subsection doc-card">
              <h3>{t('docs.managing_accounts_title')}</h3>
              <ul>
                <li>{t('docs.managing_accounts_item1')} <Link to="/profile">{t('nav.profile')}</Link> → {t('docs.connected_accounts')}</li>
                <li>{t('docs.managing_accounts_item2')}</li>
                <li>{t('docs.managing_accounts_item3')}</li>
                <li>{t('docs.managing_accounts_item4')}</li>
              </ul>
            </div>
          </section>

          <section id="compliance" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Governance</p>
              <h2>{t('docs.compliance_title')}</h2>
              <p>Use the compliance tools to manage GDPR obligations, NIS2 evidence, and reporting workflows.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.gdpr_title')}</h3>
                <p>{t('docs.gdpr_intro')}</p>
                <ul>
                  <li><strong>{t('docs.data_processing')}</strong> {t('docs.data_processing_desc')}</li>
                  <li><strong>{t('docs.data_subject_rights')}</strong> {t('docs.data_subject_rights_desc')} <Link to="/profile">{t('nav.profile')}</Link> → {t('docs.data_management')}</li>
                  <li><strong>{t('docs.audit_trails')}</strong> {t('docs.audit_trails_desc')}</li>
                  <li><strong>{t('docs.privacy_controls')}</strong> {t('docs.privacy_controls_desc')}</li>
                  <li><strong>{t('docs.compliance_reports')}</strong> {t('docs.compliance_reports_desc')}</li>
                </ul>
                <p>{t('docs.gdpr_export_note')}</p>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.nis2_title')}</h3>
                <p>{t('docs.nis2_intro')}</p>
                <ul>
                  <li>{t('docs.nis2_item1')}</li>
                  <li>{t('docs.nis2_item2')}</li>
                  <li>{t('docs.nis2_item3')}</li>
                  <li>{t('docs.nis2_item4')}</li>
                  <li>{t('docs.nis2_item5')}</li>
                </ul>
              </div>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>{t('docs.generating_reports_title')}</h3>
                <ol>
                  <li>{t('docs.generating_reports_item1')} <Link to="/dashboard">{t('nav.dashboard')}</Link> → {t('docs.reports')}</li>
                  <li>{t('docs.generating_reports_item2')}</li>
                  <li>{t('docs.generating_reports_item3')}</li>
                  <li>{t('docs.generating_reports_item4')}:
                    <ul>
                      <li>{t('docs.report_sub1')}</li>
                      <li>{t('docs.report_sub2')}</li>
                      <li>{t('docs.report_sub3')}</li>
                      <li>{t('docs.report_sub4')}</li>
                      <li>{t('docs.report_sub5')}</li>
                    </ul>
                  </li>
                  <li>{t('docs.generating_reports_item5')}</li>
                </ol>
              </div>

              <div className="doc-subsection doc-card">
                <h3>{t('docs.data_export_title')}</h3>
                <p>GueInsight supports your GDPR obligations:</p>
                <ul>
                  <li><strong>Export Your Data:</strong> Go to <Link to="/profile">Profile</Link> → "Data Management" → "Request Export"</li>
                  <li><strong>Delete Your Account:</strong> Request complete account deletion, and all personal data will be purged within 30 days</li>
                  <li><strong>Audit Trail:</strong> All export/deletion requests are logged and timestamped for compliance proof</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="features" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Plans</p>
              <h2>Plan Features &amp; Limits</h2>
              <p>Compare file limits and the core capabilities included in each plan before you upgrade.</p>
            </div>

            <div className="doc-subsection doc-card">
              <h3>File Upload Limits</h3>
              <table className="limits-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Max File Size</th>
                    <th>Max Text Length</th>
                    <th>Max URLs/Items</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Starter</td>
                    <td>2 MB</td>
                    <td>10,000 characters</td>
                    <td>5 per analysis</td>
                  </tr>
                  <tr>
                    <td>Compliance Pro</td>
                    <td>8 MB</td>
                    <td>50,000 characters</td>
                    <td>30 per analysis</td>
                  </tr>
                  <tr>
                    <td>Enterprise Risk</td>
                    <td>16 MB</td>
                    <td>150,000 characters</td>
                    <td>150 per analysis</td>
                  </tr>
                  <tr>
                    <td>Enterprise Elite</td>
                    <td>500 MB</td>
                    <td>5,000,000 characters</td>
                    <td>5,000 per analysis</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="doc-subsection doc-card">
              <h3>Feature Matrix</h3>
              <table className="features-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Starter</th>
                    <th>Pro</th>
                    <th>Risk</th>
                    <th>Elite</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>File Analysis</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Text &amp; URL Analysis</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>GDPR Tools</td><td>—</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>M365 Integration</td><td>—</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Google Workspace</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
                  <tr><td>NIS2 Reporting</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Audit Logs</td><td>90 days</td><td>90 days</td><td>1 year</td><td>1 year</td></tr>
                  <tr><td>API Access</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
                  <tr><td>Dedicated Support</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="faq" className="doc-section">
            <div className="doc-section__header">
              <p className="doc-section__eyebrow">Help</p>
              <h2>FAQ &amp; Troubleshooting</h2>
              <p>Answers to the questions users hit most often, plus the quickest fixes when something does not work.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-subsection doc-card">
                <h3>Common Questions</h3>
                <details className="faq-item">
                  <summary>Is my data stored securely?</summary>
                  <p>Yes. GueInsight uses enterprise-grade encryption for all data in transit (TLS 1.3) and at rest (AES-256). Enterprise Elite customers benefit from EU-only data residency with additional compliance hardening.</p>
                </details>
                <details className="faq-item">
                  <summary>Can I cancel my subscription anytime?</summary>
                  <p>Yes. You can cancel anytime from your <Link to="/subscription">Subscription</Link> page. No long-term contract. If you're in a trial, canceling before the 14 days ends means you won't be charged.</p>
                </details>
                <details className="faq-item">
                  <summary>What happens when my trial ends?</summary>
                  <p>When your 14-day trial ends, your subscription becomes active and you'll be billed according to your plan. You can cancel anytime before the trial ends to avoid charges.</p>
                </details>
                <details className="faq-item">
                  <summary>Can I upgrade mid-billing cycle?</summary>
                  <p>Yes. When you upgrade, you'll be prorated for the remainder of your current billing period. Downgrade anytime, and changes take effect at the next billing date.</p>
                </details>
              </div>

              <div className="doc-subsection doc-card">
                <h3>Troubleshooting</h3>
                <details className="faq-item">
                  <summary>File upload failed. What should I do?</summary>
                  <p>Check that your file:</p>
                  <ul>
                    <li>Is within the size limit for your plan</li>
                    <li>Is a supported file format</li>
                    <li>Isn't corrupt or password-protected</li>
                  </ul>
                </details>
                <details className="faq-item">
                  <summary>M365 integration not working. How do I fix it?</summary>
                  <p>Ensure that:</p>
                  <ul>
                    <li>You're using a Microsoft 365 admin account</li>
                    <li>Your admin has not restricted third-party app access</li>
                    <li>You're not using multi-factor authentication with legacy auth blocked</li>
                  </ul>
                </details>
                <details className="faq-item">
                  <summary>Payment failed. What now?</summary>
                  <p>Payment failures usually occur due to an expired card, insufficient funds, or bank fraud detection. Update the payment method from <Link to="/subscription">Subscription</Link> or contact <Link to="/support">Support</Link>.</p>
                </details>
                <details className="faq-item">
                  <summary>Need more help?</summary>
                  <p>Visit the <Link to="/support">Support</Link> page to open a ticket. Our team typically responds within 24 hours. Enterprise Elite customers receive priority support.</p>
                </details>
              </div>
            </div>
          </section>

          <section className="doc-cta">
            <h2>Ready to get started?</h2>
            <p>Create a free account today. Paid plans require a payment method for the 14-day trial.</p>
            <div className="cta-buttons">
              <Link to="/signup" className="btn btn--primary">Start Free</Link>
              <Link to="/support" className="btn btn--secondary">Contact Support</Link>
            </div>
          </section>
        </article>
      </main>
    </>
  );
};

export default Documentation;
