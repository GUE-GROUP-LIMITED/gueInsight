import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './PublicHeader.css';

const renderNavTarget = (to, children) => {
	if (!to) return null;
	if (to.startsWith('http')) return <a href={to} target="_blank" rel="noreferrer">{children}</a>;
	if (to.startsWith('#')) return <a href={to}>{children}</a>;
	return <Link to={to}>{children}</Link>;
};

const PublicHeader = ({
	featureTo,
	howTo,
	whoTo,
	pricingTo,
	resourcesTo = '/resources',
	statusTo = '/status',
	loginTo = '/login',
	showLogin = true,
	trialLabel = 'Start Free Trial',
	trialTo = '/signup',
	onTrialClick,
}) => {
	const { user, logout, loading } = useContext(AuthContext);
	const isAuthenticated = Boolean(user);
	const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '';
	const [mobileOpen, setMobileOpen] = useState(false);

	const TrialAction = onTrialClick ? 'button' : trialTo.startsWith('http') ? 'a' : Link;
	const trialProps = onTrialClick
		? { type: 'button', onClick: onTrialClick }
		: trialTo.startsWith('http')
			? { href: trialTo, target: '_blank', rel: 'noreferrer' }
			: { to: trialTo };

	const handleLogout = async () => {
		try { await logout(); } finally { window.location.assign('/'); }
	};

	const closeMobile = () => setMobileOpen(false);

	return (
		<>
			<nav className="gi-nav" aria-label="Primary">
				<div className="gi-nav-inner">
					{/* Brand */}
					<div className="gi-nav-brand-group">
						<Link to="/" className="gi-nav-brand">
							{/* Real logo from /img/logo.png */}
							<img
								src="/img/logo.png"
								alt="GueInsight logo"
								className="gi-nav-logo-mark"
								width="30"
								height="30"
							/>
							<div className="gi-nav-name">GueInsight<span className="gi-nav-name-dot">.</span></div>
						</Link>
						<div className="gi-nav-by">by <a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a></div>
					</div>

					{/* Desktop nav links */}
					<ul className="gi-nav-links">
						<li>{renderNavTarget(featureTo, 'Features')}</li>
						<li>{renderNavTarget(howTo, 'How It Works')}</li>
						<li>{renderNavTarget(whoTo, "Who It's For")}</li>
						<li>{renderNavTarget(pricingTo, 'Pricing')}</li>
						<li>{renderNavTarget(resourcesTo, 'Resources')}</li>
						<li>{renderNavTarget(statusTo, 'Status')}</li>
						<li><a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a></li>
					</ul>

					{/* Desktop auth area */}
					<div className="gi-nav-auth">
						{showLogin && !loading ? (
							isAuthenticated ? (
								<>
									<span className="gi-nav-user" title={displayName}>{displayName}</span>
									<button type="button" className="gi-nav-login" onClick={handleLogout}>Log Out</button>
								</>
							) : (
								<Link to={loginTo} className="gi-nav-login">Log In</Link>
							)
						) : null}
						<TrialAction className="gi-nav-cta" {...trialProps}>{trialLabel}</TrialAction>
					</div>

					{/* Mobile hamburger */}
					<button
						type="button"
						className="gi-nav-toggle"
						onClick={() => setMobileOpen(prev => !prev)}
						aria-expanded={mobileOpen}
						aria-label="Toggle navigation menu"
					>
						<span />
						<span />
						<span />
					</button>
				</div>
			</nav>

			{/* Mobile menu */}
			<div className={`gi-nav-mobile-menu ${mobileOpen ? 'is-open' : ''}`}>
				{featureTo && <a className="gi-nav-mobile-link" href={featureTo} onClick={closeMobile}>Features</a>}
				{howTo && <a className="gi-nav-mobile-link" href={howTo} onClick={closeMobile}>How It Works</a>}
				{whoTo && <a className="gi-nav-mobile-link" href={whoTo} onClick={closeMobile}>Who It's For</a>}
				{pricingTo && <a className="gi-nav-mobile-link" href={pricingTo} onClick={closeMobile}>Pricing</a>}
				<Link className="gi-nav-mobile-link" to={resourcesTo || '/resources'} onClick={closeMobile}>Resources</Link>
				<Link className="gi-nav-mobile-link" to={statusTo || '/status'} onClick={closeMobile}>Status</Link>
				<a className="gi-nav-mobile-link" href="https://www.guecyber.com" target="_blank" rel="noreferrer" onClick={closeMobile}>Gue Cyber</a>
				<div className="gi-nav-mobile-actions">
					{showLogin && !loading ? (
						isAuthenticated ? (
							<button type="button" className="gi-nav-login" onClick={() => { handleLogout(); closeMobile(); }}>Log Out</button>
						) : (
							<Link to={loginTo} className="gi-nav-login" onClick={closeMobile}>Log In</Link>
						)
					) : null}
					<TrialAction className="gi-nav-cta" {...trialProps} onClick={closeMobile}>{trialLabel}</TrialAction>
				</div>
			</div>
		</>
	);
};

export default PublicHeader;