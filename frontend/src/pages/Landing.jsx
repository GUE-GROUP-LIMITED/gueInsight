import { Link } from 'react-router-dom';
import './Landing.css';

const platformHighlights = [
	{
		title: 'Built for lean teams',
		body: 'Give small security teams one place to triage alerts without switching between multiple tools.',
	},
	{
		title: 'Actionable risk decisions',
		body: 'Turn raw indicators into clear next steps your analysts can act on in minutes, not hours.',
	},
	{
		title: 'Simple team collaboration',
		body: 'Share findings and reports across your team with role-based access under one subscription.',
	},
];

const workflowSteps = [
	{
		name: 'Ingest',
		description: 'Upload files or paste indicators from email alerts, SIEM, or endpoint tools.',
	},
	{
		name: 'Correlate',
		description: 'Run enrichment and checks to prioritize what matters most to your team first.',
	},
	{
		name: 'Respond',
		description: 'Generate clear reports for technical and non-technical stakeholders in one click.',
	},
];

const Landing = () => {
	return (
		<div className="landing-page">
			<header className="landing-page__topbar">
				<Link to="/" className="landing-page__brand">GueInsight</Link>
				<nav className="landing-page__nav" aria-label="Primary">
					<Link to="/">Home</Link>
					<Link to="/login">Login</Link>
					<Link to="/signup">Signup</Link>
					<Link to="/subscription">Plans</Link>
				</nav>
			</header>

			<section className="landing-page__hero">
				<div className="landing-page__hero-copy">
					<p className="landing-page__eyebrow">Cyber Security for SMB Teams</p>
					<h1>Cut alert noise and respond to threats faster.</h1>
					<p className="landing-page__lead">
						GueInsight gives growing security teams a practical workflow to ingest, investigate, and
						report threats without enterprise complexity.
					</p>
					<div className="landing-page__actions">
						<Link to="/signup" className="landing-page__primary-action">Start free trial</Link>
						<Link to="/login" className="landing-page__secondary-action">Log in</Link>
					</div>
					<div className="landing-page__trust-row" aria-label="Platform trust signals">
						<span>Fast onboarding</span>
						<span>Secure session auth</span>
						<span>Report-ready output</span>
					</div>
				</div>

				<div className="landing-page__panel landing-page__panel--status">
					<p className="landing-page__panel-title">What SMB teams get</p>
					<ul>
						<li><strong>One workspace</strong> for files, URLs, and IOC investigations</li>
						<li><strong>Faster triage</strong> with clear risk context and prioritization</li>
						<li><strong>Export-ready reports</strong> for clients, management, and audits</li>
					</ul>
				</div>
			</section>

			<section className="landing-page__highlights">
				{platformHighlights.map((item) => (
					<article className="landing-page__card" key={item.title}>
						<h2>{item.title}</h2>
						<p>{item.body}</p>
					</article>
				))}
			</section>

			<section className="landing-page__workflow" aria-labelledby="workflow-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">How it works</p>
					<h2 id="workflow-title">From alert to action in three steps</h2>
				</div>
				<div className="landing-page__workflow-grid">
					{workflowSteps.map((step, index) => (
						<article className="landing-page__workflow-step" key={step.name}>
							<p className="landing-page__workflow-index">0{index + 1}</p>
							<h3>{step.name}</h3>
							<p>{step.description}</p>
						</article>
					))}
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="conversion-title">
				<h2 id="conversion-title">Ready to scale security without adding tool sprawl?</h2>
				<p>Start with a plan that fits your team and upgrade as your security operations grow.</p>
				<div className="landing-page__actions">
					<Link to="/signup" className="landing-page__primary-action">Create your account</Link>
					<Link to="/subscription" className="landing-page__secondary-action">View plans</Link>
				</div>
			</section>

			<footer className="landing-page__footer-links" aria-label="Landing footer links">
				<Link to="/">Home</Link>
				<Link to="/login">Login</Link>
				<Link to="/signup">Signup</Link>
				<Link to="/subscription">Plans</Link>
			</footer>
		</div>
	);
};

export default Landing;
