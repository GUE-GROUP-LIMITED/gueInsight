import { useContext, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PlanSelector from '../components/PlanSelector';
import './AuthPricing.css';
import { useTranslation } from '../i18n/index';

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
	const { t } = useTranslation();
	const role = String(user?.role || '').toLowerCase();
	const [showPlanSelector, setShowPlanSelector] = useState(false);
	const plans = useMemo(() => ([
		{
			name: t('landing.starter'),
			key: 'starter',
			price: '€0',
			cycle: '/month',
			description: t('pricing_page.starter_desc'),
			features: t('pricing_page.starter_features'),
			cta: t('pricing_page.starter_cta'),
			recommended: false,
		},
		{
			name: t('landing.compliance_pro'),
			key: 'compliance_pro',
			price: '€29.90',
			cycle: '/month',
			description: t('pricing_page.pro_desc'),
			features: t('pricing_page.pro_features'),
			cta: t('pricing_page.trial_cta'),
			recommended: false,
		},
		{
			name: t('landing.enterprise_risk'),
			key: 'enterprise_risk',
			price: '€499.00',
			cycle: '/month',
			description: t('pricing_page.risk_desc'),
			features: t('pricing_page.risk_features'),
			cta: t('pricing_page.trial_cta'),
			recommended: true,
		},
		{
			name: 'Enterprise Elite',
			key: 'enterprise_elite',
			price: '€999.00',
			cycle: '/month',
			description: t('pricing_page.elite_desc'),
			features: t('pricing_page.elite_features'),
			cta: t('pricing_page.trial_cta'),
			recommended: false,
		},
	]), [t]);

	if (role === 'admin') {
		return <Navigate to="/admin" replace />;
	}

	const currentPlan = normalizePlan(user?.current_plan);
	const showCurrentPlan = Boolean(user);

	return (
		<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">{t('pricing.title')}</p>
				<h1>{t('pricing.hero_subtitle')}</h1>
				<p>{t('pricing_page.hero_body')}</p>
				{showCurrentPlan ? (
					<p><strong>{t('pricing.current_plan')}</strong> {humanizePlan(currentPlan)}. You can upgrade anytime.</p>
				) : null}
			</section>

			<section className="pricing-grid" aria-label={t('pricing_page.aria')}>
				{plans.map((plan) => (
					<article className={`pricing-card ${plan.recommended ? 'pricing-card--recommended' : ''}`} key={plan.name}>
						{plan.recommended && <p className="pricing-card__badge">{t('pricing.most_popular')}</p>}
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
								<span className="pricing-card__cta" aria-disabled="true">{t('pricing_page.current_plan_cta')}</span>
							) : plan.key === 'starter' ? (
								<Link to="/signup" className="pricing-card__cta">{plan.cta}</Link>
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
