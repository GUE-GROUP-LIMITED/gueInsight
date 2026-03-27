import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) setError(error.message);
		setLoading(false);
	};

	return (
		<div>
			<h2>Login</h2>
			<form onSubmit={handleSubmit}>
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={e => setEmail(e.target.value)}
					required
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={e => setPassword(e.target.value)}
					required
				/>
				<button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
				{error && <div style={{ color: 'red' }}>{error}</div>}
			</form>
		</div>
	);
};

export default Login;
