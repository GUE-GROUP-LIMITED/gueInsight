import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext, normalizeRole } from '../context/AuthContext';
import PublicHeader from '../components/PublicHeader';
import './AuthPricing.css';
import { useTranslation } from '../i18n/index';

const Login = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { setAuthResponse } = useContext(AuthContext);
	const { t } = useTranslation();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [showResetPassword, setShowResetPassword] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('verified') === '1') {
			setSuccess(t('login.verified_message'));
		}
	}, [location.search, t]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			const response = await api.post('/auth/login', { email, password });
			setAuthResponse(response.data || {});
			setShowResetPassword(false);
			const nextTarget = new URLSearchParams(location.search).get('next');
			const role = normalizeRole(
				response.data?.user?.role || response.data?.user?.app_metadata?.role || response.data?.user?.user_metadata?.role
			);
			navigate(role === 'admin' ? '/admin' : (nextTarget || '/dashboard'));
		} catch (err) {
			setError(err?.response?.data?.error || 'Login failed.');
			setShowResetPassword(true);
		}
		setLoading(false);
	};

	return (
		<>
			<PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/subscription" trialTo="/subscription" />
			<main className="auth-pricing-page auth-pricing-page--auth">
				<section className="auth-pricing-card">
				<div className="auth-pricing-card__head">
					<p className="auth-pricing-card__eyebrow">{t('login.eyebrow')}</p>
					<h1>{t('login.heading')}</h1>
					<p>{t('login.lead')}</p>
				</div>

				<form className="auth-pricing-form" onSubmit={handleSubmit}>
					<label htmlFor="login-email">{t('login.email')}</label>
					<input
						id="login-email"
						type="email"
						placeholder={t('login.placeholder_email')}
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>

					<label htmlFor="login-password">{t('login.password')}</label>
					<input
						id="login-password"
						type="password"
						placeholder={t('login.placeholder_password')}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>

					<button type="submit" disabled={loading}>
						{loading ? t('login.signing') : t('login.log_in')}
					</button>

					{success && <p className="auth-pricing-message auth-pricing-message--success">{success}</p>}
					{error && <p className="auth-pricing-message auth-pricing-message--error">{error}</p>}

					<div className="auth-pricing-links auth-pricing-links--login">
						<Link to={`/signup${location.search || ''}`}>{t('login.sign_up')}</Link>
						{showResetPassword ? <Link to="/reset-password">{t('login.reset_password')}</Link> : null}
					</div>
				</form>

				</section>
			</main>
		</>
	);
};

export default Login;
