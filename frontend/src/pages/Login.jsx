import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext, normalizeRole } from '../context/AuthContext';
import './AuthPricing.css';

const Login = () => {
	const navigate = useNavigate();
	const { setUser } = useContext(AuthContext);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [showResetPassword, setShowResetPassword] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		try {
			const response = await api.post('/auth/login', { email, password });
			const authenticatedUser = response.data?.user || null;
			setUser(authenticatedUser);
			setShowResetPassword(false);
			const role = normalizeRole(
				authenticatedUser?.role || authenticatedUser?.app_metadata?.role || authenticatedUser?.user_metadata?.role
			);
			navigate(role === 'admin' ? '/admin' : '/dashboard');
		} catch (err) {
			setError(err?.response?.data?.error || 'Login failed.');
			setShowResetPassword(true);
		}
		setLoading(false);
	};

	return (
		<main className="auth-pricing-page auth-pricing-page--auth">
			<section className="auth-pricing-card">
				<div className="auth-pricing-card__head">
					<p className="auth-pricing-card__eyebrow">Welcome back</p>
					<h1>Sign in to GueInsight</h1>
					<p>Access your threat analysis dashboard and continue your investigations.</p>
				</div>

				<form className="auth-pricing-form" onSubmit={handleSubmit}>
					<label htmlFor="login-email">Email</label>
					<input
						id="login-email"
						type="email"
						placeholder="you@company.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>

					<label htmlFor="login-password">Password</label>
					<input
						id="login-password"
						type="password"
						placeholder="Enter your password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>

					<button type="submit" disabled={loading}>
						{loading ? 'Signing you in...' : 'Log in'}
					</button>

					{error && <p className="auth-pricing-message auth-pricing-message--error">{error}</p>}

					<div className="auth-pricing-links auth-pricing-links--login">
						<Link to="/signup">Sign up</Link>
						{showResetPassword ? <Link to="/reset-password">Reset password</Link> : null}
					</div>
				</form>

			</section>
		</main>
	);
};

export default Login;
