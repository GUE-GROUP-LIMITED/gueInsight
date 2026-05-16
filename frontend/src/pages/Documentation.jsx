import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Documentation.css';

const Documentation = () => {
  const [expandedSection, setExpandedSection] = useState('getting-started');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <main className="documentation-page">
      {/* Header */}
      <header className="documentation-page__header">
        <h1>GueInsight Documentation</h1>
        <p>Complete guides for threat detection, compliance analysis, and data governance.</p>
      </header>

      {/* Quick Navigation */}
      <nav className="documentation-page__nav">
        <a href="#getting-started" className="nav-link">Getting Started</a>
        <a href="#file-analysis" className="nav-link">File Analysis</a>
        <a href="#cloud-integrations" className="nav-link">Cloud Integrations</a>
        <a href="#compliance" className="nav-link">Compliance</a>
        <a href="#features" className="nav-link">Features & Limits</a>
        <a href="#faq" className="nav-link">FAQ</a>
      </nav>

      {/* Main Content */}
      <article className="documentation-page__content">
        {/* Section 1: Getting Started */}
        <section id="getting-started" className="doc-section">
          <h2>🚀 Getting Started</h2>
          
          <div className="doc-subsection">
            <h3>Step 1: Create Your Account</h3>
            <ol>
              <li>Go to <Link to="/signup">Sign up</Link></li>
              <li>Enter your email address and create a secure password</li>
              <li>Verify your email by clicking the verification link</li>
              <li>You'll be logged in to the Starter plan (free, no credit card needed)</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>Step 2: Choose Your Plan</h3>
            <p>GueInsight offers four plans tailored to different needs:</p>
            <ul className="plan-list">
              <li><strong>Starter</strong> — Free forever for basic analysis and learning</li>
              <li><strong>Compliance Pro</strong> — €29.90/month for GDPR-focused threat detection</li>
              <li><strong>Enterprise Risk</strong> — €499/month for NIS2 + ISO27001 critical infrastructure</li>
              <li><strong>Enterprise Elite</strong> — €999/month for white-glove SOC2 + EU data residency</li>
            </ul>
            <p>Upgrade anytime from your <Link to="/subscription">Subscription</Link> page. Paid plans include a 14-day free trial with no card charged upfront.</p>
          </div>

          <div className="doc-subsection">
            <h3>Step 3: Access Your Dashboard</h3>
            <p>After signing up, you'll land on your personal <Link to="/dashboard">Dashboard</Link>. Here you can:</p>
            <ul>
              <li>Upload files for threat analysis</li>
              <li>Analyze text and URLs in real-time</li>
              <li>Connect cloud platforms (Microsoft 365, Google Workspace)</li>
              <li>View compliance reports and audit trails</li>
              <li>Manage your profile and subscription</li>
            </ul>
          </div>
        </section>

        {/* Section 2: File Analysis */}
        <section id="file-analysis" className="doc-section">
          <h2>📁 File & Text Analysis</h2>

          <div className="doc-subsection">
            <h3>Uploading Files</h3>
            <ol>
              <li>Go to <Link to="/dashboard">Dashboard</Link> → "Upload File"</li>
              <li>Select a file to analyze (PDF, PCAP, logs, text, JSON, XML)</li>
              <li>GueInsight will automatically detect threats, anomalies, and security patterns</li>
              <li>View results including risk score, detected issues, and remediation guidance</li>
            </ol>
            <p><strong>File Size Limits by Plan:</strong></p>
            <ul>
              <li>Starter: 2 MB</li>
              <li>Compliance Pro: 8 MB</li>
              <li>Enterprise Risk: 16 MB</li>
              <li>Enterprise Elite: 500 MB</li>
            </ul>
          </div>

          <div className="doc-subsection">
            <h3>Analyzing Text</h3>
            <ol>
              <li>Click "Analyze Text" from the dashboard</li>
              <li>Paste or type the text content (logs, configuration files, code, emails)</li>
              <li>Submit for instant analysis</li>
              <li>GueInsight identifies threats, misconfigurations, and compliance violations</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>Analyzing URLs</h3>
            <ol>
              <li>Click "Analyze URL" from the dashboard</li>
              <li>Enter the URL you want to check</li>
              <li>GueInsight analyzes the page for phishing, malware, and malicious redirects</li>
              <li>View threat assessment and recommendations</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>Understanding Results</h3>
            <p><strong>Risk Scores:</strong></p>
            <ul>
              <li><span className="risk-low">🟢 Low (0-30)</span> — Minimal security concern</li>
              <li><span className="risk-medium">🟡 Medium (31-60)</span> — Review recommended</li>
              <li><span className="risk-high">🔴 High (61-90)</span> — Action required</li>
              <li><span className="risk-critical">🟣 Critical (91-100)</span> — Immediate intervention needed</li>
            </ul>
            <p>Each analysis result includes specific threats detected, affected systems, and step-by-step remediation guidance.</p>
          </div>
        </section>

        {/* Section 3: Cloud Integrations */}
        <section id="cloud-integrations" className="doc-section">
          <h2>☁️ Cloud Platform Integrations</h2>

          <div className="doc-subsection">
            <h3>Microsoft 365 (M365) Integration</h3>
            <p>Available on Compliance Pro, Enterprise Risk, and Enterprise Elite plans.</p>
            <ol>
              <li>Go to <Link to="/dashboard">Dashboard</Link> → "Connect Microsoft 365"</li>
              <li>Sign in with your M365 organization admin account</li>
              <li>Grant GueInsight permissions to audit your tenant</li>
              <li>GueInsight will automatically analyze:
                <ul>
                  <li>User access policies and role assignments</li>
                  <li>Email security and threat protection settings</li>
                  <li>SharePoint and OneDrive security configurations</li>
                  <li>Teams and collaboration platform security</li>
                  <li>Compliance configurations and data protection</li>
                </ul>
              </li>
              <li>View detailed audit reports and recommendations</li>
            </ol>
            <p><strong>Permissions Granted:</strong> Read-only access to audit logs, security settings, and user configurations. No data modification or deletion.</p>
          </div>

          <div className="doc-subsection">
            <h3>Google Workspace Integration</h3>
            <p>Available on Enterprise Risk and Enterprise Elite plans.</p>
            <ol>
              <li>Go to <Link to="/dashboard">Dashboard</Link> → "Connect Google Workspace"</li>
              <li>Authenticate with your Google Workspace admin account</li>
              <li>Authorize GueInsight to access your workspace</li>
              <li>GueInsight will analyze:
                <ul>
                  <li>Gmail security and phishing protection</li>
                  <li>Drive sharing and access controls</li>
                  <li>Meet/Video security settings</li>
                  <li>Admin activity logs</li>
                  <li>User provisioning and directory settings</li>
                </ul>
              </li>
              <li>Generate compliance evidence for NIS2, ISO 27001, and GDPR</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>Managing Connected Accounts</h3>
            <ul>
              <li>View all connected cloud accounts in <Link to="/profile">Profile</Link> → "Connected Accounts"</li>
              <li>See last sync date and connection status</li>
              <li>Revoke access anytime to disconnect a platform</li>
              <li>Update audit frequency (hourly, daily, weekly)</li>
            </ul>
          </div>
        </section>

        {/* Section 4: Compliance & Data Governance */}
        <section id="compliance" className="doc-section">
          <h2>⚖️ Compliance & Data Governance</h2>

          <div className="doc-subsection">
            <h3>GDPR Compliance</h3>
            <p>GueInsight is GDPR-ready and helps your organization meet requirements:</p>
            <ul>
              <li><strong>Data Processing:</strong> All EU data is processed on EU-only infrastructure (Enterprise Elite)</li>
              <li><strong>Data Subject Rights:</strong> Export or delete your personal data anytime from <Link to="/profile">Profile</Link> → "Data Management"</li>
              <li><strong>Audit Trails:</strong> Complete audit logs of all analyses and access for compliance proof</li>
              <li><strong>Privacy Controls:</strong> Fine-grained consent management and data classification</li>
              <li><strong>Compliance Reports:</strong> Auto-generated GDPR compliance evidence for your records</li>
            </ul>
            <p>Use the "GDPR Export" feature to download compliance evidence in minutes for regulatory audits.</p>
          </div>

          <div className="doc-subsection">
            <h3>NIS2 & Critical Infrastructure</h3>
            <p>Enterprise Risk and Elite plans include NIS2 (Network and Information Systems 2) compliance:</p>
            <ul>
              <li>Risk assessment aligned with NIS2 requirements</li>
              <li>ISO 27001 security controls mapping</li>
              <li>Incident response and breach notification workflows</li>
              <li>Automated vulnerability tracking</li>
              <li>Compliance certification reports</li>
            </ul>
          </div>

          <div className="doc-subsection">
            <h3>Generating Compliance Reports</h3>
            <ol>
              <li>Go to <Link to="/dashboard">Dashboard</Link> → "Reports"</li>
              <li>Select report type: GDPR, NIS2, ISO 27001, SOC 2, or Custom</li>
              <li>Choose date range and systems to include</li>
              <li>GueInsight generates a professional PDF report with:
                <ul>
                  <li>Executive summary</li>
                  <li>Risk assessment and scores</li>
                  <li>Remediation roadmap</li>
                  <li>Audit trail evidence</li>
                  <li>Signed attestation for your records</li>
                </ul>
              </li>
              <li>Download or email the report to stakeholders</li>
            </ol>
          </div>

          <div className="doc-subsection">
            <h3>Data Export & Deletion (Right to Be Forgotten)</h3>
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
  );
};

export default Documentation;
