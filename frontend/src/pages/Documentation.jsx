import React from 'react';
import './Documentation.css';

const Documentation = () => {
  return (
    <div className="documentation-page">
      <header className="documentation-page__header">
        <h1>Documentation</h1>
        <p>How to use GueInsight — quickstart guides, APIs, and user manuals.</p>
      </header>

      <section className="documentation-page__content">
        <h2>Getting started</h2>
        <p>Use the <a href="/signup">Sign up</a> flow to create an account and connect your first data source.</p>

        <h2>User guides</h2>
        <ul>
          <li>Connecting Microsoft 365</li>
          <li>Configuring evidence collection</li>
          <li>Using the Compliance dashboard</li>
        </ul>

        <h2>Support</h2>
        <p>If you need assistance, open a support request from the <a href="/support">Support</a> page.</p>
      </section>
    </div>
  );
};

export default Documentation;
