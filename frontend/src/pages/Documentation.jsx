import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import './Documentation.css';
import { useTranslation } from '../i18n/index';

const Documentation = () => {
  const [expandedSection, setExpandedSection] = useState('getting-started');
  const [darkMode, setDarkMode] = useState(false);
  const { t } = useTranslation();

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

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
      {/* Header */}
      <header className="documentation-page__header">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h1>{t('docs.title')}</h1>
            <p>{t('docs.subtitle')}</p>
          </div>
          <div>
            <button onClick={toggleDarkMode} className="btn" style={{marginLeft: '1rem'}}>
              {darkMode ? t('docs.light_mode') : t('docs.dark_mode')}
            </button>
          </div>
        </div>
      </header>

      {/* Quick Navigation */}
      <nav className="documentation-page__nav">
        <a href="#getting-started" className="nav-link">{t('docs.nav_getting_started')}</a>
        <a href="#file-analysis" className="nav-link">{t('docs.nav_file_analysis')}</a>
        <a href="#cloud-integrations" className="nav-link">{t('docs.nav_cloud_integrations')}</a>
        <a href="#compliance" className="nav-link">{t('docs.nav_compliance')}</a>
        <a href="#features" className="nav-link">{t('docs.nav_features')}</a>
        <a href="#faq" className="nav-link">{t('docs.nav_faq')}</a>
      </nav>

      {/* Main Content */}
      <article className="documentation-page__content">
        {/* Section 1: Getting Started */}
        <section id="getting-started" className="doc-section">
          <h2>{t('docs.getting_started_title')}</h2>
          
          <div className="doc-subsection">
            <h3>{t('docs.step1_title')}</h3>
            <ol>
              <li>{t('docs.step1_item1')} <Link to="/signup">{t('nav.signup')}</Link></li>
              <li>{t('docs.step1_item2')}</li>
              <li>{t('docs.step1_item3')}</li>
              <li>{t('docs.step1_item4')}</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>{t('docs.step2_title')}</h3>
            <p>{t('docs.step2_intro')}</p>
            <ul className="plan-list">
              <li><strong>{t('landing.starter')}</strong> — {t('docs.starter_desc')}</li>
              <li><strong>{t('landing.compliance_pro')}</strong> — {t('docs.compliance_pro_desc')}</li>
              <li><strong>{t('landing.enterprise_risk')}</strong> — {t('docs.enterprise_risk_desc')}</li>
              <li><strong>{t('docs.enterprise_elite_name')}</strong> — {t('docs.enterprise_elite_desc')}</li>
            </ul>
            <p>{t('docs.step2_outro_prefix')} <Link to="/subscription">{t('docs.subscription_link')}</Link> {t('docs.step2_outro_suffix')}</p>
          </div>

          <div className="doc-subsection">
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
        </section>

        {/* Section 2: File Analysis */}
        <section id="file-analysis" className="doc-section">
          <h2>{t('docs.file_analysis_title')}</h2>

          <div className="doc-subsection">
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

          <div className="doc-subsection">
            <h3>{t('docs.analyzing_text_title')}</h3>
            <ol>
              <li>{t('docs.analyzing_text_item1')}</li>
              <li>{t('docs.analyzing_text_item2')}</li>
              <li>{t('docs.analyzing_text_item3')}</li>
              <li>{t('docs.analyzing_text_item4')}</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>{t('docs.analyzing_urls_title')}</h3>
            <ol>
              <li>{t('docs.analyzing_urls_item1')}</li>
              <li>{t('docs.analyzing_urls_item2')}</li>
              <li>{t('docs.analyzing_urls_item3')}</li>
              <li>{t('docs.analyzing_urls_item4')}</li>
            </ol>
          </div>

          <div className="doc-subsection">
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
        </section>

        {/* Section 3: Cloud Integrations */}
        <section id="cloud-integrations" className="doc-section">
          <h2>{t('docs.cloud_title')}</h2>

          <div className="doc-subsection">
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

          <div className="doc-subsection">
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

          <div className="doc-subsection">
            <h3>{t('docs.managing_accounts_title')}</h3>
            <ul>
              <li>{t('docs.managing_accounts_item1')} <Link to="/profile">{t('nav.profile')}</Link> → {t('docs.connected_accounts')}</li>
              <li>{t('docs.managing_accounts_item2')}</li>
              <li>{t('docs.managing_accounts_item3')}</li>
              <li>{t('docs.managing_accounts_item4')}</li>
            </ul>
          </div>
        </section>

        {/* Section 4: Compliance & Data Governance */}
        <section id="compliance" className="doc-section">
          <h2>{t('docs.compliance_title')}</h2>

          <div className="doc-subsection">
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

          <div className="doc-subsection">
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

          <div className="doc-subsection">
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

          <div className="doc-subsection">
            <h3>{t('docs.data_export_title')}</h3>
            <p>GueInsight supports your GDPR obligations:</p>
            <ul>
              <li><strong>Export Your Data:</strong> Go to <Link to="/profile">Profile</Link> → "Data Management" → "Request Export"</li>
              <li><strong>Delete Your Account:</strong> Request complete account deletion, and all personal data will be purged within 30 days</li>
              <li><strong>Audit Trail:</strong> All export/deletion requests are logged and timestamped for compliance proof</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Features & Limits */}
        <section id="features" className="doc-section">
          <h2>📊 Plan Features & Limits</h2>

          <div className="doc-subsection">
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

          <div className="doc-subsection">
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
                <tr>
                  <td>File Analysis</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Text & URL Analysis</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>GDPR Tools</td>
                  <td>—</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>M365 Integration</td>
                  <td>—</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Google Workspace</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>NIS2 Reporting</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Audit Logs</td>
                  <td>90 days</td>
                  <td>90 days</td>
                  <td>1 year</td>
                  <td>1 year</td>
                </tr>
                <tr>
                  <td>API Access</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Dedicated Support</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6: FAQ & Troubleshooting */}
        <section id="faq" className="doc-section">
          <h2>❓ FAQ & Troubleshooting</h2>

          <div className="doc-subsection">
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

            <details className="faq-item">
              <summary>Is GueInsight GDPR compliant?</summary>
              <p>Yes. GueInsight is built with GDPR-by-design principles. We process minimal personal data, provide data export/deletion tools, and maintain full audit trails. Enterprise Elite includes EU-only data residency.</p>
            </details>

            <details className="faq-item">
              <summary>Can I integrate GueInsight with my existing tools?</summary>
              <p>Yes. Enterprise Elite plan includes API access for custom integrations with your security stack (SIEM, threat intel platforms, ticketing systems, etc.).</p>
            </details>

            <details className="faq-item">
              <summary>How long does analysis take?</summary>
              <p>Most analyses complete in seconds. Large files (100+ MB) or complex cloud tenant audits may take a few minutes. You'll receive a notification when results are ready.</p>
            </details>

            <details className="faq-item">
              <summary>What file types does GueInsight support?</summary>
              <p>Supported formats: PDF, PCAP (network captures), TXT, JSON, XML, CSV, LOG, and common configuration files. Enterprise Risk and Elite plans also support database exports and binary analysis.</p>
            </details>
          </div>

          <div className="doc-subsection">
            <h3>Troubleshooting</h3>

            <details className="faq-item">
              <summary>File upload failed. What should I do?</summary>
              <p>Check that your file:</p>
              <ul>
                <li>Is within the size limit for your plan</li>
                <li>Is a supported file format</li>
                <li>Isn't corrupt or password-protected</li>
              </ul>
              <p>If the issue persists, contact <Link to="/support">Support</Link> with your file details.</p>
            </details>

            <details className="faq-item">
              <summary>M365 integration not working. How do I fix it?</summary>
              <p>Ensure that:</p>
              <ul>
                <li>You're using a Microsoft 365 admin account</li>
                <li>Your admin has not restricted third-party app access</li>
                <li>You're not using multi-factor authentication with legacy auth blocked</li>
              </ul>
              <p>Go to <Link to="/profile">Profile</Link> → "Connected Accounts" and re-authorize. For enterprise issues, contact your IT department or <Link to="/support">Support</Link>.</p>
            </details>

            <details className="faq-item">
              <summary>I'm seeing inaccurate threat scores. Why?</summary>
              <p>Threat scores are generated by machine learning trained on millions of threat patterns. False positives can occur. Review the specific threats detected and apply remediation guidance. You can also provide feedback from the analysis results to help improve accuracy.</p>
            </details>

            <details className="faq-item">
              <summary>Payment failed. What now?</summary>
              <p>Payment failures usually occur due to:</p>
              <ul>
                <li>Expired or invalid card</li>
                <li>Insufficient funds</li>
                <li>Fraud detection by your bank</li>
              </ul>
              <p>Go to <Link to="/subscription">Subscription</Link> → "Billing Methods" to update your payment info. Contact your bank if you believe it's been flagged. Or reach out to <Link to="/support">Support</Link> for assistance.</p>
            </details>

            <details className="faq-item">
              <summary>My data isn't syncing from M365/Google Workspace.</summary>
              <p>Check that:</p>
              <ul>
                <li>Your account is still connected (<Link to="/profile">Profile</Link> → "Connected Accounts")</li>
                <li>Your credentials haven't expired</li>
                <li>Your admin hasn't revoked app permissions</li>
              </ul>
              <p>Try disconnecting and re-authorizing. If sync issues continue, contact <Link to="/support">Support</Link>.</p>
            </details>

            <details className="faq-item">
              <summary>How do I export my compliance report?</summary>
              <p>Go to Dashboard → "Reports" → Select report type and date range → Download as PDF. Reports include audit trail evidence and are suitable for regulatory submissions.</p>
            </details>

            <details className="faq-item">
              <summary>Need more help?</summary>
              <p>Visit the <Link to="/support">Support</Link> page to open a ticket. Our team typically responds within 24 hours. Enterprise Elite customers receive priority support.</p>
            </details>
          </div>
        </section>

        {/* Call to Action */}
        <section className="doc-cta">
          <h2>Ready to Get Started?</h2>
          <p>Create a free Starter account today—no credit card required.</p>
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
