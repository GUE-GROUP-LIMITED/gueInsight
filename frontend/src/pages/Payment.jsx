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

	const selectedPlanDetails = PLAN_DETAILS[selectedPlan] || null;

	const handleUpgrade = async () => {
		if (!selectedPlanDetails || submitting) return;
		setSubmitting(true);
		setErrorMessage('');
		setSuccessMessage('');

		try {
			const response = await api.post('/auth/subscription/upgrade', { plan: selectedPlan }, { validateStatus: () => true });

			if (response.status >= 200 && response.status < 300) {
				if (response.data?.user) {
					setUser(response.data.user);
				}
				setSuccessMessage('Your plan has been upgraded successfully. Redirecting to dashboard...');
				window.setTimeout(() => {
					navigate('/dashboard', { replace: true });
				}, 1200);
				return;
			}

			setErrorMessage(response.data?.error || 'Unable to complete this upgrade right now.');
		} catch {
			setErrorMessage('Unable to complete this upgrade right now.');
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
					You are upgrading to <strong>{selectedPlanDetails.name}</strong> at {selectedPlanDetails.price}
					{selectedPlanDetails.cycle}.
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
						Billing starts immediately and your account access updates right away.
					</p>
					<ul>
						<li>30-day billing period</li>
						<li>Plan access is applied instantly</li>
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
						{submitting ? 'Processing...' : `Confirm ${selectedPlanDetails.name} upgrade`}
					</button>
					<Link to="/subscription" className="pricing-card__cta pricing-card__cta--ghost">Back to plans</Link>
				</article>
			</section>
		</main>
	);
};

export default Payment;
