import { Link } from 'react-router-dom';
import { useState } from 'react';
import TrialModal from '../components/TrialModal';
import PlanSelector from '../components/PlanSelector';
import './Landing.css';

const Landing = () => {
	const [showTrialModal, setShowTrialModal] = useState(false);
	const [showPlanSelector, setShowPlanSelector] = useState(false);

	return (
		<div className="landing-page">
			<div className="landing-page__ambient" aria-hidden="true" />

			<div className="landing-page__utility-bar">
				<span>A GUECYBER Product • Enterprise Cybersecurity Platform</span>
				<Link to="/support">Need urgent support?</Link>
			</div>

			<section className="landing-page__hero">
				<div className="landing-page__hero-copy">
					<p className="landing-page__eyebrow">GueInsight — Practical cybersecurity for business continuity and compliance</p>
					<h1>Unified threat analysis, tenant & device audits, and compliance-ready reporting.</h1>
					<p className="landing-page__lead">
						GueInsight is a product of Gue Cyber, built for security, IT and compliance teams who need rapid,
						decision-grade incident analysis and audit evidence. Upload files, connect Microsoft 365 or Google Workspace,
						and produce traceable reports for GDPR, NIS2 and ISO-style audits without heavy tooling overhead.
					</p>

					<div className="landing-page__actions">
						<button onClick={() => setShowPlanSelector(true)} className="landing-page__primary-action">Start 14‑day free trial</button>
						<Link to="/subscription" className="landing-page__secondary-action">Book a guided walkthrough</Link>
					</div>

					<div className="landing-page__trust-row" aria-label="Platform trust signals">
						<span>Fast IoC extraction</span>
						<span>Compliance-ready evidence</span>
						<span>Tenant & device discovery</span>
					</div>
				</div>

				<div className="landing-page__hero-panel">
					<p className="landing-page__panel-title">Platform Snapshot</p>
					<h2>What GueInsight gives your team</h2>
					<div className="landing-page__proof-grid">
						<article>
							<p className="landing-page__proof-value">File & text intelligence</p>
							<p className="landing-page__proof-label">PDFs, PCAPs, logs, DBs, docx — automated IoC extraction, hashing and entropy.</p>
						</article>
						<article>
							<p className="landing-page__proof-value">Compliance outputs</p>
							<p className="landing-page__proof-label">GDPR export/deletion requests, NIS2 incident summaries, and auditor-ready evidence packs.</p>
						</article>
						<article>
							<p className="landing-page__proof-value">Cloud connectors</p>
							<p className="landing-page__proof-label">M365 & Google Workspace discovery for users, groups, device and policy audits.</p>
						</article>
					</div>
				</div>
			</section>

			<section className="landing-page__highlights">
				<article className="landing-page__card">
					<h2>Fast, evidence‑first analysis</h2>
					<p>Upload logs, PDFs, PCAPs or databases — the platform extracts IoCs, computes file entropy and hashes, and highlights suspicious patterns quickly.</p>
				</article>
				<article className="landing-page__card">
					<h2>Compliance‑ready outputs</h2>
					<p>Generate export & deletion requests, incident evidence packs, and NIS2-style incident summaries for auditors and stakeholders.</p>
				</article>
				<article className="landing-page__card">
					<h2>Tenant & device discovery</h2>
					<p>Connect Microsoft 365 or Google Workspace to enumerate users, groups, devices and policy gaps for GDPR and NIS2 risk reviews.</p>
				</article>
			</section>

			<section className="landing-page__workflow" aria-labelledby="capabilities-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">What you can do</p>
					<h2 id="capabilities-title">Capabilities & workflows</h2>
				</div>
				<div className="landing-page__workflow-grid">
					<article className="landing-page__workflow-step">
						<h3>Ingest files</h3>
						<p>PDF, DOCX, TXT, PCAP, SQLite and log files — automated parsing, IoC extraction and sandboxing workflows.</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>Run intelligence</h3>
						<p>NER, classification and ML-assisted scoring combined with rule-based alerting and enrichment.</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>Manage incidents</h3>
						<p>Convert findings into events, apply playbooks, notify Slack/Teams and export evidence for auditors.</p>
					</article>
				</div>
			</section>

			<section className="landing-page__insights" aria-labelledby="features-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">Feature snapshot</p>
					<h2 id="features-title">Key features</h2>
				</div>
				<div className="landing-page__insight-grid">
					<article className="landing-page__insight-card">
						<p>Automated IoC extraction</p>
						<h3>IP, URL, email, hash extraction + enrichment</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>Alerting & integrations</p>
						<h3>Slack/Teams notifications and custom alert rules</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>Compliance tiers</p>
						<h3>GDPR exports, NIS2 reporting and EU residency options</h3>
					</article>
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="trial-title">
				<h2 id="trial-title">Subscription & trial policy</h2>
				<p>Trials are 14 days and must be started by selecting a paid plan and entering a payment method. We validate the payment method before the trial begins to prevent abuse. At the end of the 14‑day trial the subscription will auto-bill the selected plan unless cancelled before trial expiry. A free Starter plan is available for individuals with limited quotas.</p>
				<div className="landing-page__actions">
					<button onClick={() => setShowPlanSelector(true)} className="landing-page__primary-action">Start 14‑day free trial</button>
					<Link to="/subscription" className="landing-page__secondary-action">Explore plans</Link>
				</div>
				<div className="landing-page__table-wrap">
					<table className="landing-page__compare">
						<thead>
							<tr><th>Feature</th><th>Starter</th><th>Compliance Pro</th><th>Enterprise Risk</th></tr>
						</thead>
						<tbody>
							<tr><td>File types</td><td>Basic</td><td>PDF/PCAP/Logs</td><td>All + DBs</td></tr>
							<tr><td>GDPR tools</td><td>—</td><td>Export & Deletion</td><td>Export, Deletion, Audit logs</td></tr>
							<tr><td>Retention / Logs</td><td>30 days</td><td>90 days</td><td>1 year</td></tr>
							<tr><td>Connectors</td><td>—</td><td>M365 (basic)</td><td>M365 + GWS</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<section className="landing-page__highlights" aria-labelledby="security-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">Security & privacy</p>
					<h2 id="security-title">Built for auditability</h2>
				</div>
				<div className="landing-page__workflow-grid">
					<article className="landing-page__workflow-step">
						<h3>Audit‑first design</h3>
						<p>Event logs, rule history and evidence exports are designed to support auditor workflows.</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>Access control</h3>
						<p>User roles and account-level controls limit access to sensitive data; GDPR tools support export and deletion requests.</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>Data subject support</h3>
						<p>Compliance Pro+ tiers include tools to facilitate data subject requests and evidence retention controls.</p>
					</article>
				</div>
			</section>

			<section className="landing-page__insights" aria-labelledby="audience-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">Who should use GueInsight</p>
					<h2 id="audience-title">Use cases</h2>
				</div>
				<div className="landing-page__insight-grid">
					<article className="landing-page__insight-card">
						<p>SMBs & public sector</p>
						<h3>Audit-ready evidence without heavy tooling</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>Security & SOC teams</p>
						<h3>Lightweight investigation layer to supplement SIEM/EDR</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>Compliance teams</p>
						<h3>GDPR and NIS2-ready reporting and workflows</h3>
					</article>
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="faq-title">
				<h2 id="faq-title">FAQ</h2>
				<p><strong>Do I need to give a payment card to try it?</strong> Yes — we require a payment method during trial sign-up. The card is validated but you will not be charged until the trial ends unless you keep the subscription.</p>
				<p><strong>Will you delete our data if requested?</strong> Yes — Compliance Pro and above include GDPR export and deletion features to facilitate data-subject requests.</p>
				<div className="landing-page__actions">
					<Link to="/subscription" className="landing-page__primary-action">Start 14‑day free trial</Link>
					<Link to="/support" className="landing-page__secondary-action">Contact sales</Link>
				</div>
			</section>

			{/* Footer navigation moved into global Footer component */}

			{showTrialModal && (
				<TrialModal
					onConfirm={() => { setShowTrialModal(false); window.location.href = '/subscription'; }}
					onCancel={() => setShowTrialModal(false)}
				/>
			)}
			{showPlanSelector && (
				<PlanSelector onClose={() => setShowPlanSelector(false)} />
			)}
		</div>
	);
};

export default Landing;
