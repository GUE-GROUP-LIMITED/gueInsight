import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import './Documentation.css';
import { useTranslation } from '../i18n/index';
import {
  IconSearch,
  IconCopy,
  IconCheck,
  IconShield,
  IconLock,
  IconCloud,
  IconCpu,
  IconFile,
  IconBook,
  IconExternalLink,
  IconCheckCircle,
  IconChevronDown,
  IconArrowRight,
  IconCode,
  IconAlertTriangle,
  IconServer,
  IconLayers,
  IconZap,
} from '../components/Icons';

const DOC_OVERVIEW_CARDS = [
  {
    icon: <IconZap size={20} />,
    title: '1. Get Started',
    text: 'Create an account, verify credentials, and immediately access the cockpit with zero card required.',
    linkTo: '#getting-started',
    linkLabel: 'Open quickstart guide',
    category: 'getting-started',
  },
  {
    icon: <IconShield size={20} />,
    title: '2. File & Threat Analysis',
    text: 'Upload malware samples, URLs, or raw text to inspect heuristics, IOC signatures, and remediation.',
    linkTo: '#file-analysis',
    linkLabel: 'Open threat scanner',
    category: 'threat-analysis',
  },
  {
    icon: <IconCloud size={20} />,
    title: '3. Cloud Tenant Auditing',
    text: 'Integrate Microsoft 365 and Google Workspace to detect configuration drift and audit tenant security.',
    linkTo: '#cloud-integrations',
    linkLabel: 'Open integrations guide',
    category: 'integrations',
  },
  {
    icon: <IconLock size={20} />,
    title: '4. Compliance & NIS2/GDPR',
    text: 'Generate structured GDPR and NIS2 audit evidence, automated incident logs, and compliance filings.',
    linkTo: '#compliance',
    linkLabel: 'Open compliance guide',
    category: 'compliance',
  },
];

const DOC_API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/public/landing-snapshot',
    detail: 'Telemetry metrics and public security status used on the global platform monitor.',
    exampleResponse: '{\n  "status": "healthy",\n  "active_nodes": 18,\n  "threats_mitigated": 14209\n}',
  },
  {
    method: 'GET',
    path: '/auth/analytics/summary',
    detail: 'Authenticated organization summary covering total threat alerts, MTTD, and MTTR.',
    exampleResponse: '{\n  "total_ingested": 1840,\n  "critical_threats": 3,\n  "compliance_score": 94.2\n}',
  },
  {
    method: 'GET',
    path: '/auth/dashboard/compliance',
    detail: 'Compliance posture, framework adherence (GDPR, NIS2, ISO27001), and control gaps.',
    exampleResponse: '{\n  "frameworks": ["GDPR", "NIS2"],\n  "controls_passed": 46,\n  "controls_total": 48\n}',
  },
  {
    method: 'GET',
    path: '/auth/integrations',
    detail: 'List configured cloud security tenants, API keys, and synchronization statuses.',
    exampleResponse: '{\n  "tenants": [\n    {"provider": "microsoft_365", "status": "synced"}\n  ]\n}',
  },
];

const DOC_QUICK_LINKS = [
  { href: '#getting-started', label: 'Getting Started', category: 'getting-started' },
  { href: '#api-access', label: 'API Reference', category: 'api' },
  { href: '#file-analysis', label: 'Threat Analysis', category: 'threat-analysis' },
  { href: '#cloud-integrations', label: 'Cloud Integrations', category: 'integrations' },
  { href: '#compliance', label: 'Compliance & Legal', category: 'compliance' },
  { href: '#features', label: 'Plan Limits & Tiers', category: 'plans' },
  { href: '#faq', label: 'FAQ & Support', category: 'faq' },
];

const Documentation = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    document.body.classList.add('page-docs');
    return () => {
      document.body.classList.remove('page-docs');
    };
  }, []);

  const handleCopyEndpoint = (path) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    }
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return DOC_API_ENDPOINTS;
    const q = searchQuery.toLowerCase();
    return DOC_API_ENDPOINTS.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.detail.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <>
      <PublicHeader
        featureTo="/#features"
        howTo="#getting-started"
        whoTo="/#who"
        pricingTo="/subscription"
        trialTo="/subscription"
      />

      <main className="documentation-page">
        {/* Top Hero Section */}
        <section className="documentation-page__hero">
          <div className="documentation-page__hero-copy">
            <div className="documentation-page__eyebrow-badge">
              <span className="documentation-page__pulse-dot" />
              <span>GUEINSIGHT DOCUMENTATION &amp; KNOWLEDGE HUB</span>
            </div>
            <h1 className="documentation-page__hero-title">
              {t('docs.title') || 'Platform Documentation & Developer Guide'}
            </h1>
            <p className="documentation-page__hero-lead">
              {t('docs.subtitle') ||
                'Everything you need to configure threat monitoring, connect cloud providers, automate compliance, and integrate with GueInsight APIs.'}
            </p>

            {/* Live Search Bar */}
            <div className="documentation-page__search-box">
              <IconSearch size={18} className="documentation-page__search-icon" />
              <input
                type="text"
                placeholder="Search documentation, guides, and API endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="documentation-page__search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="documentation-page__search-clear"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="documentation-page__hero-actions">
              <Link to="/signup" className="doc-btn doc-btn--primary">
                <span>Create Free Account</span>
                <IconArrowRight size={15} />
              </Link>
              <Link to="/dashboard" className="doc-btn doc-btn--secondary">
                <span>Open Cockpit</span>
              </Link>
            </div>
          </div>

          {/* Quickstart Cards */}
          <aside className="documentation-page__hero-panel">
            <div className="documentation-page__panel-header">
              <IconBook size={16} />
              <span>CORE WORKFLOWS AT A GLANCE</span>
            </div>
            <div className="documentation-page__overview-grid">
              {DOC_OVERVIEW_CARDS.map((card) => (
                <a key={card.title} href={card.linkTo} className="documentation-page__overview-card">
                  <div className="documentation-page__card-icon-title">
                    <span className="documentation-page__card-icon">{card.icon}</span>
                    <strong className="documentation-page__card-name">{card.title}</strong>
                  </div>
                  <p>{card.text}</p>
                  <span className="documentation-page__card-link-text">
                    <span>{card.linkLabel}</span>
                    <IconArrowRight size={13} />
                  </span>
                </a>
              ))}
            </div>
          </aside>
        </section>

        {/* Sticky Section Navigation */}
        <nav className="documentation-page__nav" aria-label="Documentation sections">
          <div className="documentation-page__nav-scroll">
            {DOC_QUICK_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="doc-nav-link">
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Main Documentation Articles */}
        <article className="documentation-page__content">
          {/* SECTION 1: GETTING STARTED */}
          <section id="getting-started" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconZap size={14} />
                <span>PHASE 1 · ONBOARDING</span>
              </div>
              <h2>{t('docs.getting_started_title') || 'Getting Started with GueInsight'}</h2>
              <p>Set up your account, activate telemetry feeds, and land on your cockpit dashboard in minutes.</p>
            </div>

            <div className="doc-grid doc-grid--three">
              <div className="doc-card">
                <div className="doc-card__badge">STEP 01</div>
                <h3>{t('docs.step1_title') || 'Create Account'}</h3>
                <p>Register using your corporate email address to automatically configure company tenancy.</p>
                <ol className="doc-steps-list">
                  <li>Navigate to <Link to="/signup" className="doc-inline-link">{t('nav.signup') || 'Sign Up'}</Link></li>
                  <li>Enter your work email and strong passphrase</li>
                  <li>Verify account activation via confirmation link</li>
                  <li>Access the unified threat overview cockpit</li>
                </ol>
              </div>

              <div className="doc-card">
                <div className="doc-card__badge">STEP 02</div>
                <h3>{t('docs.step2_title') || 'Select Plan Tier'}</h3>
                <p>{t('docs.step2_intro') || 'Choose the protection level tailored to your team:'}</p>
                <ul className="doc-plan-pills">
                  <li><strong>Free</strong> <span>Zero cost · Basic heuristics</span></li>
                  <li><strong>Starter</strong> <span>€49.90/mo · Analyst triage</span></li>
                  <li><strong>Compliance Pro</strong> <span>€99.90/mo · GDPR audits</span></li>
                  <li><strong>Enterprise Elite</strong> <span>€999/mo · vCISO &amp; SOC2</span></li>
                </ul>
                <Link to="/subscription" className="doc-inline-link">
                  {t('docs.subscription_link') || 'Compare all plan limits'} →
                </Link>
              </div>

              <div className="doc-card">
                <div className="doc-card__badge">STEP 03</div>
                <h3>{t('docs.step3_title') || 'Launch Cockpit'}</h3>
                <p>
                  Access your interactive security cockpit at{' '}
                  <Link to="/dashboard" className="doc-inline-link">
                    /dashboard
                  </Link>
                  .
                </p>
                <ul className="doc-checklist">
                  <li><IconCheckCircle size={14} /> Ingest raw files or paste text payloads</li>
                  <li><IconCheckCircle size={14} /> Inspect live streaming threat transactions</li>
                  <li><IconCheckCircle size={14} /> Run real-time GDPR &amp; NIS2 health checks</li>
                  <li><IconCheckCircle size={14} /> Export executive incident summaries to PDF</li>
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION 2: API ACCESS & DEVELOPER ENDPOINTS */}
          <section id="api-access" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconCode size={14} />
                <span>DEVELOPER API · REST V1</span>
              </div>
              <h2>REST API Reference</h2>
              <p>Programmatically query telemetry, ingest threat indicators, and pull compliance audit trails.</p>
            </div>

            <div className="doc-card">
              <div className="doc-api-list">
                {filteredEndpoints.map((endpoint) => (
                  <div key={endpoint.path} className="doc-api-item">
                    <div className="doc-api-top">
                      <div className="doc-api-route">
                        <span className={`doc-api-method doc-api-method--${endpoint.method.toLowerCase()}`}>
                          {endpoint.method}
                        </span>
                        <code className="doc-api-path">{endpoint.path}</code>
                        <button
                          type="button"
                          className="doc-api-copy-btn"
                          onClick={() => handleCopyEndpoint(endpoint.path)}
                          title="Copy endpoint path"
                        >
                          {copiedPath === endpoint.path ? (
                            <>
                              <IconCheck size={13} />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <IconCopy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <span className="doc-api-auth-badge">Bearer Token Required</span>
                    </div>

                    <p className="doc-api-detail">{endpoint.detail}</p>

                    <div className="doc-api-code-wrap">
                      <div className="doc-api-code-bar">
                        <span className="doc-api-code-dot" />
                        <span className="doc-api-code-dot" />
                        <span className="doc-api-code-dot" />
                        <span className="doc-api-code-lang">JSON RESPONSE</span>
                      </div>
                      <pre className="doc-api-code">{endpoint.exampleResponse}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: FILE ANALYSIS & THREAT SCORING */}
          <section id="file-analysis" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconShield size={14} />
                <span>ENGINE ARCHITECTURE</span>
              </div>
              <h2>{t('docs.file_analysis_title') || 'Threat Intelligence & Scoring'}</h2>
              <p>Multi-stage sandbox disassembly, heuristic behavioral heuristics, and severity categorization.</p>
            </div>

            {/* Severity Scoring Meter Cards */}
            <div className="doc-grid doc-grid--four" style={{ marginBottom: '20px' }}>
              <div className="doc-card doc-severity-card doc-severity-card--low">
                <div className="doc-severity-head">
                  <span className="doc-severity-pill">0 - 29%</span>
                  <span className="doc-severity-name">LOW RISK</span>
                </div>
                <p>Standard software signatures, baseline behavior, and clean reputation records.</p>
              </div>

              <div className="doc-card doc-severity-card doc-severity-card--medium">
                <div className="doc-severity-head">
                  <span className="doc-severity-pill">30 - 59%</span>
                  <span className="doc-severity-name">MEDIUM</span>
                </div>
                <p>Obfuscated strings, unsigned DLL loads, or anomalous DNS query bursts.</p>
              </div>

              <div className="doc-card doc-severity-card doc-severity-card--high">
                <div className="doc-severity-head">
                  <span className="doc-severity-pill">60 - 84%</span>
                  <span className="doc-severity-name">HIGH RISK</span>
                </div>
                <p>Known malware fingerprints, credential dumping attempts, or command injection.</p>
              </div>

              <div className="doc-card doc-severity-card doc-severity-card--critical">
                <div className="doc-severity-head">
                  <span className="doc-severity-pill">85 - 100%</span>
                  <span className="doc-severity-name">CRITICAL</span>
                </div>
                <p>Active ransomware encryption loops, CVE zero-day exploit, or C2 beaconing.</p>
              </div>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-card">
                <h3>{t('docs.uploading_files_title') || 'File Payload Inspection'}</h3>
                <ol className="doc-steps-list">
                  <li>Navigate to <Link to="/dashboard" className="doc-inline-link">Cockpit</Link> and click the <strong>+</strong> button.</li>
                  <li>Select or drag your file into the secure encrypted intake buffer.</li>
                  <li>Our sandbox validates hashing, entropy, and executes dynamic scans.</li>
                  <li>Review MITRE ATT&amp;CK matrix mappings and remediation advice.</li>
                </ol>
                <div className="doc-limits-box">
                  <strong>{t('docs.file_size_limits') || 'Max File Size Allocations:'}</strong>
                  <ul>
                    <li>Starter: 2 MB payload limit</li>
                    <li>Compliance Pro: 8 MB payload limit</li>
                    <li>Enterprise Risk: 16 MB payload limit</li>
                    <li>Enterprise Elite: 500 MB continuous ingestion limit</li>
                  </ul>
                </div>
              </div>

              <div className="doc-card">
                <h3>{t('docs.analyzing_urls_title') || 'URL & Domain Reputation'}</h3>
                <p>
                  Submit suspicious phishing URLs or webhook callbacks to verify SSL certificate transparency, domain age, and blacklists.
                </p>
                <ul className="doc-checklist">
                  <li><IconCheckCircle size={14} /> Automated redirection crawler tracing</li>
                  <li><IconCheckCircle size={14} /> Phishing form element detection</li>
                  <li><IconCheckCircle size={14} /> IP geolocation and ASN threat scoring</li>
                  <li><IconCheckCircle size={14} /> Direct export to SIEM blocklists (Suricata / Snort)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION 4: CLOUD INTEGRATIONS */}
          <section id="cloud-integrations" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconCloud size={14} />
                <span>TENANT SYNCHRONIZATION</span>
              </div>
              <h2>{t('docs.cloud_title') || 'Cloud Security Integrations'}</h2>
              <p>Audit Microsoft 365 and Google Workspace environments for identity drift and compliance posture.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-card">
                <h3>{t('docs.m365_title') || 'Microsoft 365 Tenant Link'}</h3>
                <p>{t('docs.m365_intro') || 'Connect via Azure Active Directory OAuth to audit tenant policies:'}</p>
                <ol className="doc-steps-list">
                  <li>Open <Link to="/dashboard" className="doc-inline-link">Cockpit</Link> → Integrations</li>
                  <li>Select "Connect Microsoft 365"</li>
                  <li>Authorize with a Global Reader or Security Reader role</li>
                  <li>Inspect MFA enforcement, legacy auth blocks, and tenant drift</li>
                </ol>
              </div>

              <div className="doc-card">
                <h3>{t('docs.gws_title') || 'Google Workspace Integration'}</h3>
                <p>{t('docs.gws_intro') || 'Inspect Google Workspace organizational units and admin policies:'}</p>
                <ol className="doc-steps-list">
                  <li>Open <Link to="/dashboard" className="doc-inline-link">Cockpit</Link> → Integrations</li>
                  <li>Select "Connect Google Workspace"</li>
                  <li>Authorize read-only reporting scopes via Google Cloud Console</li>
                  <li>Track third-party OAuth app authorizations and external file shares</li>
                </ol>
              </div>
            </div>
          </section>

          {/* SECTION 5: COMPLIANCE & LEGAL */}
          <section id="compliance" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconLock size={14} />
                <span>REGULATORY AUDITING</span>
              </div>
              <h2>{t('docs.compliance_title') || 'GDPR, NIS2 & Audit Governance'}</h2>
              <p>Structured workflows to fulfill legal obligations under EU cybersecurity and privacy directives.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-card">
                <h3>{t('docs.gdpr_title') || 'GDPR Data Protection'}</h3>
                <p>{t('docs.gdpr_intro') || 'Fulfill data subject requests and documentation obligations:'}</p>
                <ul className="doc-checklist">
                  <li><IconCheckCircle size={14} /> <strong>Right to Access:</strong> 1-click JSON export in Profile</li>
                  <li><IconCheckCircle size={14} /> <strong>Right to Erasure:</strong> GDPR Article 17 deletion request</li>
                  <li><IconCheckCircle size={14} /> <strong>Audit Trail:</strong> Immutable timestamped incident logs</li>
                </ul>
              </div>

              <div className="doc-card">
                <h3>{t('docs.nis2_title') || 'EU NIS2 Incident Readiness'}</h3>
                <p>{t('docs.nis2_intro') || 'Essential guidance for Belgian and EU organizations under NIS2:'}</p>
                <ul className="doc-checklist">
                  <li><IconCheckCircle size={14} /> 24-hour early warning incident reports</li>
                  <li><IconCheckCircle size={14} /> 72-hour comprehensive root cause analysis</li>
                  <li><IconCheckCircle size={14} /> Supplier &amp; third-party vendor risk assessment</li>
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION 6: PLAN FEATURES & LIMITS */}
          <section id="features" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconServer size={14} />
                <span>SUBSCRIPTION MATRIX</span>
              </div>
              <h2>Platform Limits &amp; Feature Comparison</h2>
              <p>Review throughput limits, file payload capacities, and support SLAs across tiers.</p>
            </div>

            <div className="doc-card">
              <div className="doc-table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th>Free</th>
                      <th>Starter</th>
                      <th>Compliance Pro</th>
                      <th>Enterprise Elite</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Max File Size</td>
                      <td>1 MB</td>
                      <td>2 MB</td>
                      <td>8 MB</td>
                      <td><strong>500 MB</strong></td>
                    </tr>
                    <tr>
                      <td>Heuristic Threat Sandbox</td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                    </tr>
                    <tr>
                      <td>GDPR Compliance Suite</td>
                      <td><span className="doc-dash">—</span></td>
                      <td><span className="doc-dash">—</span></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                    </tr>
                    <tr>
                      <td>M365 &amp; GWS Integrations</td>
                      <td><span className="doc-dash">—</span></td>
                      <td><span className="doc-dash">—</span></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                    </tr>
                    <tr>
                      <td>EU NIS2 Incident Reporting</td>
                      <td><span className="doc-dash">—</span></td>
                      <td><span className="doc-dash">—</span></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                    </tr>
                    <tr>
                      <td>Dedicated vCISO Advising</td>
                      <td><span className="doc-dash">—</span></td>
                      <td><span className="doc-dash">—</span></td>
                      <td><span className="doc-dash">—</span></td>
                      <td><IconCheck size={16} color="#10B981" /></td>
                    </tr>
                    <tr>
                      <td>Audit Log Retention</td>
                      <td>7 days</td>
                      <td>90 days</td>
                      <td>1 year</td>
                      <td><strong>7 years (EU Compliant)</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* SECTION 7: FAQ & TROUBLESHOOTING */}
          <section id="faq" className="doc-section">
            <div className="doc-section__header">
              <div className="doc-section__eyebrow">
                <IconAlertTriangle size={14} />
                <span>FREQUENT QUESTIONS</span>
              </div>
              <h2>Frequently Asked Questions</h2>
              <p>Quick answers on security, cancellation policies, and troubleshooting assistance.</p>
            </div>

            <div className="doc-grid doc-grid--two">
              <div className="doc-card">
                <h3 className="doc-subhead">Operational &amp; Privacy Questions</h3>
                <details className="doc-faq-item">
                  <summary>
                    <span>Where is ingested telemetry stored?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>All data is processed within certified European Union datacenters under strict GDPR compliance. Data is encrypted in transit using TLS 1.3 and at rest with AES-256-GCM.</p>
                </details>

                <details className="doc-faq-item">
                  <summary>
                    <span>Can I cancel or upgrade my subscription at any time?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>Yes. You can manage or cancel your subscription at any time from the <Link to="/billing" className="doc-inline-link">Billing &amp; Invoices</Link> page. Upgrades take effect immediately with prorated invoicing.</p>
                </details>

                <details className="doc-faq-item">
                  <summary>
                    <span>What happens during the 14-day trial period?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>You have full access to all features in your chosen tier. You can cancel before the 14-day window expires without incurring any charge.</p>
                </details>
              </div>

              <div className="doc-card">
                <h3 className="doc-subhead">Technical Troubleshooting</h3>
                <details className="doc-faq-item">
                  <summary>
                    <span>File upload failed or returned an error?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>Verify that your file size does not exceed your plan limit and that it is not password-encrypted. Encrypted ZIP archives require the password to be supplied during ingestion.</p>
                </details>

                <details className="doc-faq-item">
                  <summary>
                    <span>How do I generate an official VAT tax invoice?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>Visit the <Link to="/billing" className="doc-inline-link">Billing &amp; Invoices</Link> page to view and download PDF/HTML invoices with full EU reverse-charge VAT compliance.</p>
                </details>

                <details className="doc-faq-item">
                  <summary>
                    <span>Need technical support or custom enterprise SLA?</span>
                    <IconChevronDown size={16} className="doc-chevron" />
                  </summary>
                  <p>Open a ticket via the <Link to="/support" className="doc-inline-link">Support Desk</Link>. Enterprise customers receive 24/7 prioritized responses within 1 hour.</p>
                </details>
              </div>
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section className="doc-cta-banner">
            <div className="doc-cta-copy">
              <h2>Ready to secure your cloud and infrastructure?</h2>
              <p>Deploy enterprise threat intelligence, automated GDPR compliance, and NIS2 reporting in under 5 minutes.</p>
            </div>
            <div className="doc-cta-actions">
              <Link to="/signup" className="doc-btn doc-btn--primary">
                <span>Start Free Cockpit</span>
                <IconArrowRight size={15} />
              </Link>
              <Link to="/support" className="doc-btn doc-btn--secondary">
                <span>Talk to an Engineer</span>
              </Link>
            </div>
          </section>
        </article>
      </main>
    </>
  );
};

export default Documentation;
