import { useContext, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
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
				'/checkout/create-session',
				{ tier_id: selectedPlan, trial_days: trialDays },
				{ validateStatus: () => true }
			);

			if (response.status >= 200 && response.status < 300) {
				const checkoutUrl = response.data?.checkout_url;
				if (checkoutUrl) {
					setSuccessMessage(`Redirecting to secure checkout for a ${trialDays}-day free trial...`);
					window.location.assign(checkoutUrl);
					return;
				}
				setSuccessMessage('Checkout session created, but no redirect URL was returned.');
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
					<p className="auth-pricing-card__eyebrow">Payment</p>
					<h1>Choose a valid plan to continue</h1>
					<p>The selected plan is missing or invalid. Return to pricing and choose a paid plan.</p>
					<Link to="/subscription" className="pricing-card__cta">Back to plans</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="auth-pricing-page auth-pricing-page--pricing">
			<section className="pricing-hero">
				<p className="auth-pricing-card__eyebrow">Payment</p>
				<h1>Confirm your {selectedPlanDetails.name} plan</h1>
				<p>
					Start a <strong>{trialDays}-day free trial</strong> on <strong>{selectedPlanDetails.name}</strong> at {selectedPlanDetails.price}
					{selectedPlanDetails.cycle}. Stripe will validate your payment method before the trial begins.
				</p>
			</section>

			<section className="pricing-grid" aria-label="Payment confirmation">
				<article className="pricing-card pricing-card--recommended">
					<p className="pricing-card__badge">Secure checkout</p>
					<h2>{selectedPlanDetails.name}</h2>
					<p className="pricing-card__price">
						{selectedPlanDetails.price}<span>{selectedPlanDetails.cycle}</span>
					</p>
					<p className="pricing-card__description">
						Billing begins after the trial ends. Your payment method is validated now so the plan can auto-renew.
					</p>
					<ul>
						<li>{trialDays}-day free trial</li>
						<li>Payment method validated before trial starts</li>
						<li>Manage or change plan anytime</li>
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
						{submitting ? 'Processing...' : `Start ${trialDays}-day free trial`}
					</button>
					<Link to="/subscription" className="pricing-card__cta pricing-card__cta--ghost">Back to plans</Link>
				</article>
			</section>
		</main>
	);
};

export default Payment;
