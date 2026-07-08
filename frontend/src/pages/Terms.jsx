import React from 'react';
import './LegalPages.css';

const Terms = () => {
  return (
    <main className="legal-page" aria-labelledby="terms-title">
      <section className="legal-page__card">
        <h1 id="terms-title">Terms of Service</h1>
        <p className="legal-page__meta">Last updated: 2026-07-08</p>

        <h2>Service Scope</h2>
        <p>
          GueInsight provides cybersecurity analysis and compliance tooling. You are responsible for lawful use and account credential security.
        </p>

        <h2>Acceptable Use</h2>
        <p>
          Do not upload illegal content, malware intended for harmful use, or third-party data without authorization.
        </p>

        <h2>Billing and Subscription</h2>
        <p>
          Paid plans renew according to selected billing cycles. Taxes and local obligations may apply depending on jurisdiction and plan.
        </p>

        <h2>Availability and Support</h2>
        <p>
          We provide commercially reasonable availability and incident response processes. Planned maintenance or force majeure events may affect access.
        </p>

        <h2>Liability</h2>
        <p>
          The service is provided for professional decision support. Final remediation and compliance decisions remain with your organization.
        </p>

        <h2>Contact</h2>
        <p>
          Commercial and legal inquiries: support@guecyber.com
        </p>
      </section>
    </main>
  );
};

export default Terms;
