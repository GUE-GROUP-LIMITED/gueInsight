import React from 'react';
import './LegalPages.css';

const Privacy = () => {
  return (
    <main className="legal-page" aria-labelledby="privacy-title">
      <section className="legal-page__card">
        <h1 id="privacy-title">Privacy Policy</h1>
        <p className="legal-page__meta">Last updated: 2026-07-08</p>

        <h2>Data We Collect</h2>
        <p>
          We collect account details, billing metadata, uploaded analysis artifacts, and operational logs needed to secure and run the platform.
        </p>

        <h2>How We Use Data</h2>
        <p>
          Data is used for cybersecurity analysis, product operations, fraud prevention, support, compliance reporting, and service improvement.
        </p>

        <h2>Legal Basis and Retention</h2>
        <p>
          Processing is based on contract, legitimate interests, and legal obligations where applicable. Retention windows are configured per plan and compliance settings.
        </p>

        <h2>Security and Residency</h2>
        <p>
          We use role-based access controls, encrypted transport, signed sessions, and audit trails. EU data residency controls are available for eligible plans.
        </p>

        <h2>Your Rights</h2>
        <p>
          You may request access, export, correction, and deletion through profile privacy controls or by contacting support.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy requests: security@guecyber.com
        </p>
      </section>
    </main>
  );
};

export default Privacy;
