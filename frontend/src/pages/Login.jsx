import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext, normalizeRole } from '../context/AuthContext';
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
		<div className="auth-split">
			{/* ── LEFT PANEL ── */}
			<div className="auth-split__left">
				{/* Decorative circles */}
				<div className="auth-split__left-deco" aria-hidden="true" />
				<div className="auth-split__left-deco2" aria-hidden="true" />

				{/* Brand */}
				<Link to="/" className="auth-split__left-brand">
					<div className="auth-split__left-logo">
						<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
							<rect width="28" height="28" rx="7" fill="rgba(255,255,255,0.2)"/>
							<path d="M14 5L6 8.5V14C6 18.1 9.4 21.7 14 23C18.6 21.7 22 18.1 22 14V8.5L14 5Z" fill="white" fillOpacity="0.9"/>
							<path d="M11 14L13 16L17 12" stroke="#E8490A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					</div>
					<span className="auth-split__left-name">GueInsight<span className="auth-split__left-name-dot">.</span></span>
				</Link>

				{/* Content */}
				<div className="auth-split__left-content">
					<h1 className="auth-split__left-heading">
						Right where<br />you <em>belong.</em>
					</h1>
					<p className="auth-split__left-sub">
						For your people, your security,<br />and your beautifully specific concerns.
					</p>

					{/* Chat bubbles */}
					<div className="auth-split__bubbles">
						<div className="auth-split__bubble">
							<div className="auth-split__bubble-avatar" style={{ background: '#1A1A1A' }}>GA</div>
							<div className="auth-split__bubble-inner">
								<div className="auth-split__bubble-name">
									Gabriel <span className="auth-split__bubble-time">just now</span>
								</div>
								<div className="auth-split__bubble-text">hey! saved you a spot. 🔐</div>
							</div>
						</div>
						<div className="auth-split__bubble" style={{ marginLeft: 24 }}>
							<div className="auth-split__bubble-avatar" style={{ background: '#9A9490' }}>Y</div>
							<div className="auth-split__bubble-inner">
								<div className="auth-split__bubble-name">
									You <span className="auth-split__bubble-time">just now</span>
								</div>
								<div className="auth-split__bubble-text">feels like my kind of place.</div>
								<div className="auth-split__bubble-reaction">❤️ 3</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── RIGHT PANEL ── */}
			<div className="auth-split__right">
				{/* Top bar */}
				<div className="auth-split__right-topbar">
					<Link to="/" className="auth-split__right-back">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="m15 18-6-6 6-6"/>
						</svg>
						Back to home
					</Link>
					<span className="auth-split__right-join">
						New around here? <Link to={`/signup${location.search || ''}`}>Come on in ↗</Link>
					</span>
				</div>

				{/* Form area */}
				<div className="auth-split__right-body">
					<div className="auth-split__form-wrap">
						<h1 className="auth-split__form-heading">Hey, welcome back.</h1>
						<p className="auth-split__form-sub">The conversation's better with you in it.</p>

						{/* Email + password form */}
						<p style={{ fontSize: '0.8rem', color: '#9A9490', textAlign: 'center', margin: '0 0 16px' }}>
							or, the good old email way
						</p>

						<form className="auth-split__form" onSubmit={handleSubmit}>
							<div>
								<label className="auth-split__label" htmlFor="login-email">
									{t('login.email')}
								</label>
								<input
									id="login-email"
									type="email"
									placeholder={t('login.placeholder_email')}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="auth-split__input"
									required
								/>
							</div>

							<div>
								<label className="auth-split__label" htmlFor="login-password">
									{t('login.password')}
								</label>
								<input
									id="login-password"
									type="password"
									placeholder={t('login.placeholder_password')}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="auth-split__input"
									required
								/>
							</div>

							<button type="submit" className="auth-split__submit" disabled={loading}>
								<span>{loading ? t('login.signing') : t('login.log_in')}</span>
								<span className="auth-split__submit-arrow">›</span>
							</button>

							{success && <p className="auth-split__message auth-split__message--success">{success}</p>}
							{error && <p className="auth-split__message auth-split__message--error">{error}</p>}
						</form>

						<div className="auth-split__form-footer">
							{showResetPassword && (
								<p>
									Forgot your password? <Link to="/reset-password">{t('login.reset_password')}</Link>
								</p>
							)}
							<p style={{ marginTop: 8 }}>
								Don't have an account yet? <Link to={`/signup${location.search || ''}`}>Come on in ↗</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Login;
