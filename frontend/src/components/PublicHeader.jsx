import { Link } from 'react-router-dom';
import './PublicHeader.css';

const renderNavTarget = (to, children) => {
	if (!to) {
		return null;
	}

	if (to.startsWith('http')) {
		return (
			<a href={to} target="_blank" rel="noreferrer">
				{children}
			</a>
		);
	}

	if (to.startsWith('#')) {
		return <a href={to}>{children}</a>;
	}

	return <Link to={to}>{children}</Link>;
};

const PublicHeader = ({
	featureTo,
	howTo,
	whoTo,
	pricingTo,
	loginTo = '/login',
	showLogin = true,
	trialLabel = 'Start Free Trial',
	trialTo = '/signup',
	onTrialClick,
}) => {
	const TrialAction = onTrialClick ? 'button' : trialTo.startsWith('http') ? 'a' : Link;
	const trialProps = onTrialClick
		? { type: 'button', onClick: onTrialClick }
		: trialTo.startsWith('http')
			? { href: trialTo, target: '_blank', rel: 'noreferrer' }
			: { to: trialTo };

	return (
		<nav className="gi-nav" aria-label="Primary">
			<div className="gi-nav-inner">
				<div className="gi-nav-brand-group">
					<Link to="/" className="gi-nav-brand">
					<img src="/img/logo.png" alt="GueInsight" className="gi-nav-logo-mark" onError={(e) => { e.currentTarget.src = '/img/guecyber-logo.svg'; }} />
						<div className="gi-nav-name">Gue<span>Insight</span></div>
					</Link>
					<div className="gi-nav-by">by <a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a></div>
				</div>
				<ul className="gi-nav-links">
					<li>{renderNavTarget(featureTo, 'Features')}</li>
					<li>{renderNavTarget(howTo, 'How It Works')}</li>
					<li>{renderNavTarget(whoTo, "Who It's For")}</li>
					<li>{renderNavTarget(pricingTo, 'Pricing')}</li>
					<li><a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a></li>
				</ul>
				{showLogin ? <Link to={loginTo} className="gi-nav-login">Log In</Link> : null}
				<TrialAction className="gi-nav-cta" {...trialProps}>{trialLabel}</TrialAction>
			</div>
		</nav>
	);
};

export default PublicHeader;