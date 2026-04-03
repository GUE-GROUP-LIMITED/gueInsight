import { Link } from 'react-router-dom';
import './Landing.css';

const platformHighlights = [
	{
		title: 'Analyst-first signal board',
		body: 'Bring endpoint, email, and cloud signals into one stream so your team can prioritize fast.',
	},
	{
		title: 'Explainable risk context',
		body: 'Every indicator is scored with transparent context so your team knows why it matters.',
	},
	{
		title: 'Report-ready output',
		body: 'Generate executive and technical-ready reports in a format your clients and auditors can use.',
	},
];

const workflowSteps = [
	{
		name: 'Collect',
		description: 'Ingest files, domains, hashes, and suspicious URLs from your existing tools.',
	},
	{
		name: 'Correlate',
		description: 'Automate enrichment and confidence scoring to surface high-priority activity first.',
	},
	{
		name: 'Contain',
		description: 'Export response-ready reports and remediation notes for analysts, managers, and clients.',
	},
];

const threatSignals = [
	'IOC confidence normalization',
	'Cross-source enrichment checks',
	'Role-based workspace controls',
	'Audit-friendly report timelines',
];

const Landing = () => {
	return (
		<div className="landing-page">
			<div className="landing-page__grid-overlay" aria-hidden="true" />

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
					<p className="landing-page__eyebrow">Cyber Defense Command Layer</p>
					<h1>See less noise. Stop real threats faster.</h1>
					<p className="landing-page__lead">
						GueInsight gives growing security teams a mission-ready workspace for triage, investigation,
						and response without enterprise overhead.
					</p>
					<div className="landing-page__actions">
						<Link to="/signup" className="landing-page__primary-action">Start free trial</Link>
						<Link to="/login" className="landing-page__secondary-action">Log in</Link>
					</div>
					<div className="landing-page__trust-row" aria-label="Platform trust signals">
						<span>Realtime triage</span>
						<span>Zero-friction onboarding</span>
						<span>Audit-ready reporting</span>
					</div>
				</div>

				<div className="landing-page__panel landing-page__panel--terminal">
					<p className="landing-page__panel-title">Threat Console Snapshot</p>
					<p className="landing-page__panel-line">source: mail-gateway / endpoint / dns</p>
					<p className="landing-page__panel-line">status: correlation active</p>
					<p className="landing-page__panel-line">queue: 13 indicators pending</p>
					<p className="landing-page__panel-line">priority: high confidence signals first</p>
					<div className="landing-page__signal-list">
						{threatSignals.map((signal) => (
							<span key={signal}>{signal}</span>
						))}
					</div>
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
					<p className="landing-page__eyebrow">Workflow</p>
					<h2 id="workflow-title">From detection to decision in 3 controlled steps</h2>
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
				<h2 id="conversion-title">Deploy a cleaner cyber operations flow for your team.</h2>
				<p>Start with a right-sized plan and scale as your investigation volume grows.</p>
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
