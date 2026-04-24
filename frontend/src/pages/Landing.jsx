import { Link } from 'react-router-dom';
import './Landing.css';

const platformHighlights = [
	{
		title: 'Exposure-first command center',
		body: 'Map attack surface, identity risk, cloud posture, and endpoint signals from one intelligence view.',
	},
	{
		title: 'Decision-grade investigations',
		body: 'Correlate telemetry and enrichment data into clear stories analysts can trust and act on quickly.',
	},
	{
		title: 'Compliance-ready reporting',
		body: 'Generate stakeholder and auditor outputs with traceable evidence, timelines, and remediation context.',
	},
];

const workflowSteps = [
	{
		name: 'Discover',
		description: 'Continuously ingest assets, telemetry, and suspicious artifacts across your stack.',
	},
	{
		name: 'Prioritize',
		description: 'Score incidents by business impact and confidence so your team focuses where it matters.',
	},
	{
		name: 'Respond',
		description: 'Route actions, document containment progress, and export response-ready evidence packs.',
	},
];

const trustLogos = ['NHS Partner Teams', 'Global Energy SOC', 'Retail Group SecOps', 'Financial Services IR', 'Critical Infrastructure CSIRT'];

const proofStats = [
	{ value: '72%', label: 'faster incident triage for mixed telemetry environments' },
	{ value: '48h', label: 'average time to first response brief for security leads' },
	{ value: '99.9%', label: 'platform uptime target for always-on operations teams' },
];

const insightCards = [
	{
		kicker: 'Threat Brief',
		title: 'Ransomware operator behavior shifts in managed cloud estates',
		copy: 'A concise field summary for teams that need to adapt detection engineering this quarter.',
	},
	{
		kicker: 'Playbook',
		title: 'Executive-ready communication flow for active incidents',
		copy: 'How to align SOC, legal, and leadership updates without losing technical depth.',
	},
	{
		kicker: 'Guide',
		title: 'Building measurable cyber resilience with lean security teams',
		copy: 'A practical framework to connect risk reduction activities to business outcomes.',
	},
];

const Landing = () => {
	return (
		<div className="landing-page">
			<div className="landing-page__ambient" aria-hidden="true" />

			<div className="landing-page__utility-bar">
				<span>A GUECYBER Product • Enterprise Cybersecurity Platform</span>
				<Link to="/support">Need urgent support?</Link>
			</div>

			<header className="landing-page__topbar">
				<Link to="/" className="landing-page__brand">
					<span className="landing-page__brand-mark">GI</span>
					<span>GueInsight</span>
				</Link>
				<nav className="landing-page__nav" aria-label="Primary">
					<Link to="/">Platform</Link>
					<Link to="/subscription">Solutions</Link>
					<Link to="/support">Resources</Link>
					<Link to="/profile">Company</Link>
				</nav>
				<div className="landing-page__top-actions">
					<Link to="/login" className="landing-page__secondary-action">Log in</Link>
					<Link to="/signup" className="landing-page__primary-action">Start free trial</Link>
				</div>
			</header>

			<section className="landing-page__hero">
				<div className="landing-page__hero-copy">
					<p className="landing-page__eyebrow">Proactive Security Starts Here</p>
					<h1>Predict, prevent, detect, and respond faster with a unified cyber operations layer.</h1>
					<p className="landing-page__lead">
						Built by GUECYBER, GueInsight helps security and operations teams reduce exposure,
						accelerate investigations, and strengthen resilient digital operations.
					</p>
					<div className="landing-page__actions">
						<Link to="/signup" className="landing-page__primary-action">Request a live demo</Link>
						<Link to="/subscription" className="landing-page__secondary-action">Explore plans</Link>
					</div>
					<p className="landing-page__company-note">
						Part of the GUECYBER delivery ecosystem across Cybersecurity & Governance, Software & Cloud Engineering,
						and AI & Automation Enablement.
					</p>
					<div className="landing-page__trust-row" aria-label="Platform trust signals">
						<span>AI-guided triage</span>
						<span>Cross-domain visibility</span>
						<span>Audit-grade evidence</span>
					</div>
				</div>

				<div className="landing-page__hero-panel">
					<p className="landing-page__panel-title">Platform Snapshot</p>
					<h2>Secure, adapt, and defend with confidence.</h2>
					<div className="landing-page__proof-grid">
						{proofStats.map((stat) => (
							<article key={stat.value}>
								<p className="landing-page__proof-value">{stat.value}</p>
								<p className="landing-page__proof-label">{stat.label}</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="landing-page__logo-strip" aria-label="Trusted teams">
				{trustLogos.map((logo) => (
					<span key={logo}>{logo}</span>
				))}
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
					<p className="landing-page__eyebrow">Operating Model</p>
					<h2 id="workflow-title">From signal overload to focused cyber decisions in three steps</h2>
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

			<section className="landing-page__insights" aria-labelledby="insights-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">Insights</p>
					<h2 id="insights-title">Proactive security starts with real-world intelligence</h2>
				</div>
				<div className="landing-page__insight-grid">
					{insightCards.map((card) => (
						<article className="landing-page__insight-card" key={card.title}>
							<p>{card.kicker}</p>
							<h3>{card.title}</h3>
							<span>{card.copy}</span>
						</article>
					))}
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="conversion-title">
				<h2 id="conversion-title">Experience the next layer of proactive cybersecurity.</h2>
				<p>Book a guided walkthrough and see how your team can accelerate response without scaling complexity.</p>
				<div className="landing-page__actions">
					<Link to="/signup" className="landing-page__primary-action">Book your live demo</Link>
					<Link to="/login" className="landing-page__secondary-action">Open workspace</Link>
					<a
						href="https://www.guecyber.com/"
						target="_blank"
						rel="noreferrer"
						className="landing-page__secondary-action"
					>
						Visit GUECYBER
					</a>
				</div>
			</section>

			<footer className="landing-page__footer-links" aria-label="Landing footer links">
				<Link to="/">Platform</Link>
				<Link to="/login">Login</Link>
				<Link to="/subscription">Solutions</Link>
				<Link to="/support">Resources</Link>
			</footer>
		</div>
	);
};

export default Landing;
