import { useContext, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';
import './AuthPricing.css';

const PLAN_DETAILS = {
	premium_individual: { name: 'Starter', price: '$19', cycle: '/month' },
	premium_small_business: { name: 'Growth', price: '$59', cycle: '/month' },
	premium_large_business: { name: 'Scale', price: '$149', cycle: '/month' },
};

const normalizePlan = (plan) => {
	const value = String(plan || '').toLowerCase();
	if (value === 'starter') return 'premium_individual';
	if (value === 'growth') return 'premium_small_business';
	if (value === 'scale') return 'premium_large_business';
	return value;
};

const Payment = () => {
	const { search } = useLocation();
	const navigate = useNavigate();
	const { setUser } = useContext(AuthContext);
	const { t } = useTranslation();
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	const selectedPlan = useMemo(() => {
		const params = new URLSearchParams(search);
		return normalizePlan(params.get('plan'));
	}, [search]);

	const trialDays = useMemo(() => {
		const params = new URLSearchParams(search);
		const parsed = Number.parseInt(params.get('trial') || '14', 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
	}, [search]);

	const selectedPlanDetails = PLAN_DETAILS[selectedPlan] || null;

	const handleUpgrade = async () => {
		if (!selectedPlanDetails || submitting) return;
		setSubmitting(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const response = await api.post(
				'/auth/subscription/upgrade',
				{ plan: selectedPlan },
				{ validateStatus: () => true }
			);

			if (response.status >= 200 && response.status < 300) {
				const checkoutUrl = response.data?.checkout_url;
				if (checkoutUrl) {
					setSuccessMessage(`Redirecting to secure checkout for a ${trialDays}-day free trial...`);
					window.location.assign(checkoutUrl);
					return;
				}
				if (response.data?.receipt_url) {
					window.location.assign('/subscription?upgrade=success');
					return;
				}
				setSuccessMessage('Subscription updated successfully.');
				return;
			}

			setErrorMessage(response.data?.error || 'Unable to start the trial checkout right now.');
		} catch {
			setErrorMessage('Unable to start the trial checkout right now.');
		} finally {
			setSubmitting(false);
		}
	};

	if (!selectedPlanDetails) {
		return (
			<main className="auth-pricing-page auth-pricing-page--pricing">
				<section className="pricing-hero">
					<p className="auth-pricing-card__eyebrow">{t('payment.title')}</p>
					<h1>{t('payment.missing_plan')}</h1>
					<p>{t('payment.missing_plan')}</p>
					<Link to="/subscription" className="pricing-card__cta">{t('payment.back_to_plans')}</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">{t('payment.title')}</p>
				<h1>{t('payment.confirm_plan', { plan: selectedPlanDetails.name })}</h1>
				<p>
					{t('payment.trial_summary', {
						days: trialDays,
						plan: selectedPlanDetails.name,
						price: selectedPlanDetails.price,
						cycle: selectedPlanDetails.cycle,
					})}
				</p>
			</section>

			<section className="pricing-grid" aria-label={t('payment.payment_confirmation')}>
				<article className="pricing-card pricing-card--recommended">
					<p className="pricing-card__badge">{t('payment.secure_checkout')}</p>
					<h2>{selectedPlanDetails.name}</h2>
					<p className="pricing-card__price">
						{selectedPlanDetails.price}<span>{selectedPlanDetails.cycle}</span>
					</p>
					<p className="pricing-card__description">{t('payment.billing_begins')}</p>
					<ul>
						<li>{t('payment.trial_day', { days: trialDays })}</li>
						<li>{t('payment.validate_before')}</li>
						<li>{t('payment.manage_anytime')}</li>
					</ul>

					{errorMessage ? <p className="auth-pricing-card__error">{errorMessage}</p> : null}
					{successMessage ? <p className="auth-pricing-card__notice">{successMessage}</p> : null}

					<button
						type="button"
						className="pricing-card__cta"
						onClick={handleUpgrade}
						disabled={submitting}
						aria-busy={submitting}
					>
						{submitting ? t('payment.processing') : t('payment.start_trial', { days: trialDays })}
					</button>
					<Link to="/subscription" className="pricing-card__cta pricing-card__cta--ghost">{t('payment.back_to_plans')}</Link>
				</article>
			</section>
		</main>
	);
};

export default Payment;
