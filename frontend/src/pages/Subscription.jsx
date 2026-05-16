import { useContext, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PlanSelector from '../components/PlanSelector';
import './AuthPricing.css';

const plans = [
	{
		name: 'Starter',
		key: 'starter',
		price: '€0',
		cycle: '/month',
		description: 'For getting started with basic analysis and onboarding.',
		features: ['Basic file types (TXT, JSON, XML, logs)', 'Manual analysis', 'Community support'],
		cta: 'Start Free',
		recommended: false,
	},
	{
		name: 'Compliance Pro',
		key: 'compliance_pro',
		price: '€29.90',
		cycle: '/month',
		description: 'GDPR-focused threat detection with audit trails and compliance workflows.',
		features: ['PDF, PCAP, logs analysis', 'GDPR export & deletion tools', '90-day retention', 'M365 connector (basic)'],
		cta: 'Start 14-day free trial',
		recommended: false,
	},
	{
		name: 'Enterprise Risk',
		key: 'enterprise_risk',
		price: '€499.00',
		cycle: '/month',
		description: 'NIS2 + ISO27001 risk management for critical infrastructure and enterprises.',
		features: ['All file types + databases', 'Full GDPR & NIS2 reporting', '1-year retention & audit logs', 'M365 + Google Workspace'],
		cta: 'Start 14-day free trial',
		recommended: true,
	},
	{
		name: 'Enterprise Elite',
		key: 'enterprise_elite',
		price: '€999.00',
		cycle: '/month',
		description: 'White-glove SOC2 compliance, EU data residency, and dedicated support.',
		features: ['Unlimited file types & volume', 'API access & webhooks', 'EU-only data residency', 'Dedicated onboarding & support'],
		cta: 'Start 14-day free trial',
		recommended: false,
	},
];

const normalizePlan = (plan) => {
	const value = String(plan || 'starter').toLowerCase();
	if (value.includes('free') || value.includes('starter')) return 'starter';
	if (value.includes('compliance')) return 'compliance_pro';
	if (value.includes('enterprise_risk') || value.includes('risk')) return 'enterprise_risk';
	if (value.includes('elite') || value.includes('enterprise')) return 'enterprise_elite';
	return 'starter';
};

const humanizePlan = (plan) => {
	const normalized = normalizePlan(plan);
	if (normalized === 'starter') return 'Starter';
	if (normalized === 'compliance_pro') return 'Compliance Pro';
	if (normalized === 'enterprise_risk') return 'Enterprise Risk';
	if (normalized === 'enterprise_elite') return 'Enterprise Elite';
	return 'Starter';
};

const Subscription = () => {
	const { user } = useContext(AuthContext);
	const role = String(user?.role || '').toLowerCase();
	const [showPlanSelector, setShowPlanSelector] = useState(false);

	if (role === 'admin') {
		return <Navigate to="/admin" replace />;
	}

	const currentPlan = normalizePlan(user?.current_plan);
	const showCurrentPlan = Boolean(user);

	return (
		<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">Pricing</p>
				<h1>GDPR & NIS2-ready compliance analysis for every team</h1>
				<p>Upload files or connect M365/Google Workspace to analyze threats, audit tenants, and generate compliance evidence.</p>
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
							) : plan.key === 'starter' ? (
								<Link to="/signup" className="pricing-card__cta">Start Free</Link>
							) : (
								<button className="pricing-card__cta" onClick={() => setShowPlanSelector(true)}>
									{plan.cta}
								</button>
							)
						) : plan.key === 'starter' ? (
							<Link to="/signup" className="pricing-card__cta">{plan.cta}</Link>
						) : (
							<Link to="/login" className="pricing-card__cta">{plan.cta}</Link>
						)}
					</article>
				))}
			</section>

			{showPlanSelector && (
				<PlanSelector onClose={() => setShowPlanSelector(false)} />
			)}
		</main>
	);
};

export default Subscription;
