import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PlanSelector from '../components/PlanSelector';
import PublicHeader from '../components/PublicHeader';
import { api } from '../services/api';
import './AuthPricing.css';
import { useTranslation } from '../i18n/index';

const normalizePlan = (plan) => {
	const value = String(plan || 'free').toLowerCase();
	if (value.includes('free')) return 'free';
	if (value.includes('starter') && !value.includes('enterprise')) return 'starter';
	if (value.includes('compliance')) return 'compliance_pro';
	if (value.includes('professional')) return 'enterprise_professional';
	if (value.includes('enterprise_risk') || value.includes('risk')) return 'enterprise_risk';
	if (value.includes('elite') || value.includes('enterprise')) return 'enterprise_elite';
	return 'free';
};

const humanizePlan = (plan) => {
	const normalized = normalizePlan(plan);
	if (normalized === 'free') return 'Free';
	if (normalized === 'starter') return 'Starter';
	if (normalized === 'compliance_pro') return 'Compliance Pro';
	if (normalized === 'enterprise_professional') return 'Enterprise Professional';
	if (normalized === 'enterprise_risk') return 'Enterprise Risk';
	if (normalized === 'enterprise_elite') return 'Enterprise Elite';
	return 'Free';
};

const PLAN_RANK = {
	free: 0,
	starter: 1,
	compliance_pro: 2,
	enterprise_professional: 3,
	enterprise_risk: 4,
	enterprise_elite: 5,
};

const Subscription = () => {
	const { user } = useContext(AuthContext);
	const { t } = useTranslation();
	const role = String(user?.role || '').toLowerCase();
	const [showPlanSelector, setShowPlanSelector] = useState(false);
	const plans = useMemo(() => ([
		{
			name: 'Free',
			key: 'free',
			price: '€0',
			cycle: '/month',
			description: 'Get started with basic analysis and learning.',
			features: ['Basic file types (TXT, JSON, XML, logs)', 'Manual analysis', 'Community support'],
			cta: 'Start Free',
			recommended: false,
		},
		{
			name: 'Starter',
			key: 'starter',
			price: '€49.90',
			cycle: '/month',
			description: 'For small teams and individual professionals.',
			features: ['PDF, PCAP, logs analysis', 'Basic threat detection', 'Email support', '30-day retention'],
			cta: t('pricing_page.trial_cta'),
			recommended: false,
		},
		{
			name: t('landing.compliance_pro'),
			key: 'compliance_pro',
			price: '€99.90',
			cycle: '/month',
			description: t('pricing_page.pro_desc'),
			features: t('pricing_page.pro_features'),
			cta: t('pricing_page.trial_cta'),
			recommended: false,
		},
		{
			name: 'Enterprise Professional',
			key: 'enterprise_professional',
			price: '€299.90',
			cycle: '/month',
			description: 'GDPR + NIS2 compliance for growing enterprises.',
			features: ['All file types + databases', 'Full GDPR compliance tools', 'NIS2 risk management', 'M365 + Google Workspace', '90-day retention & audit logs'],
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

	const currentPlan = normalizePlan(user?.current_plan);
	const showCurrentPlan = Boolean(user);
	const [subDetails, setSubDetails] = useState(null);
	const isFreePlan = currentPlan === 'free';
	const [planSelectorTarget, setPlanSelectorTarget] = useState('starter');
	const [actionLoadingPlan, setActionLoadingPlan] = useState(null);
	const [actionError, setActionError] = useState('');

	useEffect(() => {
		if (!user) return;
		api.get('/auth/subscription').then(res => setSubDetails(res.data)).catch(() => {});
	}, [user]);

	if (role === 'admin') {
		return <Navigate to="/admin" replace />;
	}

	const formatDate = (iso) => {
		if (!iso) return null;
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
	};

	const daysUntil = (iso) => {
		if (!iso) return null;
		const diff = new Date(iso) - new Date();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	};

	const isPaidSubscriber = Boolean(showCurrentPlan && !isFreePlan);

	const getActionLabel = (planKey, defaultCta) => {
		if (!isPaidSubscriber) return defaultCta;
		if (planKey === 'free') return 'Downgrade to Free';
		const targetRank = PLAN_RANK[planKey] ?? 0;
		const currentRank = PLAN_RANK[currentPlan] ?? 0;
		if (targetRank > currentRank) return 'Upgrade plan';
		if (targetRank < currentRank) return 'Downgrade plan';
		return t('pricing_page.current_plan_cta');
	};

	const changeToStarter = async () => {
		setActionError('');
		setActionLoadingPlan('starter');
		try {
			const resp = await api.post('/auth/subscription/upgrade', { plan: 'starter' });
			if (resp.status === 200) {
				window.location.href = '/subscription?upgrade=success';
				return;
			}
			setActionError('Failed to update subscription.');
		} catch (e) {
			setActionError(e?.response?.data?.error || 'Failed to update subscription.');
		} finally {
			setActionLoadingPlan(null);
		}
	};

	return (
		<>
			<PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/subscription" />
			<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">{t('pricing.title')}</p>
				<h1>{t('pricing.hero_subtitle')}</h1>
				<p>{t('pricing_page.hero_body')}</p>
				{showCurrentPlan ? (
				<p><strong>{t('pricing.current_plan')}</strong> {humanizePlan(currentPlan)}. {!isFreePlan ? 'You can upgrade or downgrade anytime.' : 'Upgrade to unlock advanced features.'}</p>
				) : null}
			</section>

		{showCurrentPlan && subDetails && !isFreePlan && (
				<section className="sub-status-panel">
					<div className="sub-status-item">
						<span className="sub-status-label">Plan type</span>
						<span className={`sub-status-value sub-status-badge ${subDetails.is_trial ? 'sub-status-badge--trial' : 'sub-status-badge--paid'}`}>
							{subDetails.is_trial ? '⏳ Free trial' : '✓ Full subscription'}
						</span>
					</div>
					<div className="sub-status-item">
						<span className="sub-status-label">Started</span>
						<span className="sub-status-value">{formatDate(subDetails.start_date) || '—'}</span>
					</div>
					<div className="sub-status-item">
						<span className="sub-status-label">{subDetails.is_trial ? 'Trial ends' : 'Renews'}</span>
						<span className="sub-status-value">
							{formatDate(subDetails.end_date) || '—'}
							{daysUntil(subDetails.end_date) !== null && (
								<span className={`sub-status-days ${daysUntil(subDetails.end_date) <= 7 ? 'sub-status-days--urgent' : ''}`}>
									{daysUntil(subDetails.end_date) > 0
										? ` (${daysUntil(subDetails.end_date)} days)`
										: ' (expired)'}
								</span>
							)}
						</span>
					</div>
					<div className="sub-status-item">
						<span className="sub-status-label">Status</span>
						<span className={`sub-status-value sub-status-badge ${subDetails.status === 'active' ? 'sub-status-badge--active' : 'sub-status-badge--expired'}`}>
							{subDetails.status === 'active' ? '🟢 Active' : '🔴 Expired'}
						</span>
					</div>
					<div className="sub-status-item sub-status-item--link">
						<span className="sub-status-label">Billing history</span>
						<Link to="/profile#billing" className="sub-status-history-link">View invoices &amp; receipts →</Link>
					</div>
				</section>
			)}

			<section className="pricing-grid" aria-label={t('pricing_page.aria')}>
				{plans.map((plan) => (
					<article className={`pricing-card ${plan.recommended ? 'pricing-card--recommended' : ''} ${plan.key === currentPlan ? 'pricing-card--current' : ''}`} key={plan.name}>
						{plan.recommended && <p className="pricing-card__badge">{t('pricing.most_popular')}</p>}
					{plan.key === currentPlan && showCurrentPlan && <p className="pricing-card__current-badge">✓ Your current plan</p>}
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
						) : plan.key === 'free' ? (
							<button
								className="pricing-card__cta"
								disabled={actionLoadingPlan === 'free'}
								onClick={() => {
									setActionError('');
									setActionLoadingPlan('free');
									api.post('/auth/subscription/upgrade', { plan: 'free' })
										.then(() => window.location.href = '/subscription?upgrade=success')
										.catch(e => {
											setActionError(e?.response?.data?.error || 'Failed to update subscription.');
											setActionLoadingPlan(null);
										});
								}}
							>
								{actionLoadingPlan === 'free' ? 'Updating...' : getActionLabel(plan.key, plan.cta)}
								</button>
							) : (
								<button
									className="pricing-card__cta"
									onClick={() => {
										setPlanSelectorTarget(plan.key);
										setShowPlanSelector(true);
									}}
								>
									{getActionLabel(plan.key, plan.cta)}
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

			{actionError ? <p className="auth-error-text">{actionError}</p> : null}

			{showPlanSelector && (
				<PlanSelector
					onClose={() => setShowPlanSelector(false)}
					initialSelected={planSelectorTarget}
					currentPlan={currentPlan}
					isPaidSubscriber={isPaidSubscriber}
				/>
			)}
		</main>
		</>
	);
};

export default Subscription;
