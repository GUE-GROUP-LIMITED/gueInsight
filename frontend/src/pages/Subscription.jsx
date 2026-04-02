import { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './AuthPricing.css';

const plans = [
	{
		name: 'Free',
		key: 'free',
		price: '$0',
		cycle: '/month',
		description: 'For getting started with basic checks and onboarding.',
		features: ['100 monthly indicator checks', 'Basic report exports', 'Community support'],
		cta: 'Start Free',
		recommended: false,
	},
	{
		name: 'Starter',
		key: 'premium_individual',
		price: '$19',
		cycle: '/month',
		description: 'For solo practitioners and early-stage teams.',
		features: ['500 monthly indicator checks', 'Threat summary reports', 'Email support'],
		cta: 'Choose Starter',
		recommended: false,
	},
	{
		name: 'Growth',
		key: 'premium_small_business',
		price: '$59',
		cycle: '/month',
		description: 'For growing SMB security teams needing faster collaboration.',
		features: ['5,000 monthly indicator checks', 'Team workspaces and role access', 'Priority support'],
		cta: 'Choose Growth',
		recommended: true,
	},
	{
		name: 'Scale',
		key: 'premium_large_business',
		price: '$149',
		cycle: '/month',
		description: 'For high-volume operations and managed security workflows.',
		features: ['25,000 monthly indicator checks', 'Advanced exports and reporting', 'Dedicated onboarding'],
		cta: 'Choose Scale',
		recommended: false,
	},
];

const normalizePlan = (plan) => {
	const value = String(plan || 'free').toLowerCase();
	if (value.includes('free')) return 'free';
	if (value.includes('individual') || value.includes('starter')) return 'premium_individual';
	if (value.includes('large')) return 'premium_large_business';
	if (value.includes('small') || value.includes('growth')) return 'premium_small_business';
	return value;
};

const humanizePlan = (plan) => {
	const normalized = normalizePlan(plan);
	if (normalized === 'free') return 'Free';
	if (normalized === 'premium_individual') return 'Starter';
	if (normalized === 'premium_small_business') return 'Growth';
	if (normalized === 'premium_large_business') return 'Scale';
	return 'Free';
};

const Subscription = () => {
	const { user } = useContext(AuthContext);
	const role = String(user?.role || '').toLowerCase();

	if (role === 'admin') {
		return <Navigate to="/admin" replace />;
	}

	const currentPlan = normalizePlan(user?.current_plan);
	const showCurrentPlan = Boolean(user);

	return (
		<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">Pricing</p>
				<h1>Flexible plans for modern cyber security teams</h1>
				<p>Start small, scale when needed, and keep your threat analysis workflow predictable.</p>
				{showCurrentPlan ? (
					<p><strong>Current plan:</strong> {humanizePlan(currentPlan)}. You can upgrade anytime.</p>
				) : null}
			</section>

			<section className="pricing-grid" aria-label="Subscription plans">
				{plans.map((plan) => (
					<article className={`pricing-card ${plan.recommended ? 'pricing-card--recommended' : ''}`} key={plan.name}>
						{plan.recommended && <p className="pricing-card__badge">Most popular</p>}
						<h2>{plan.name}</h2>
						<p className="pricing-card__price">
							{plan.price}<span>{plan.cycle}</span>
						</p>
						<p className="pricing-card__description">{plan.description}</p>
						<ul>
							{plan.features.map((feature) => (
								<li key={feature}>{feature}</li>
							))}
						</ul>
						{user ? (
							plan.key === currentPlan ? (
								<span className="pricing-card__cta" aria-disabled="true">Current plan</span>
							) : (
								<Link to={`/payment?plan=${encodeURIComponent(plan.key)}`} className="pricing-card__cta">
									Upgrade to {plan.name}
								</Link>
							)
						) : (
							<Link to="/signup" className="pricing-card__cta">{plan.cta}</Link>
						)}
					</article>
				))}
			</section>
		</main>
	);
};

export default Subscription;
