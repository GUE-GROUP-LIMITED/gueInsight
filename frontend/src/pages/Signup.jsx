import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Signup = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');
		const { error } = await supabase.auth.signUp({ email, password });
		if (error) setError(error.message);
		else setSuccess('Check your email to confirm your account!');
		setLoading(false);
	};

	return (
		<div>
			<h2>Sign Up</h2>
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
				<button type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
				{error && <div style={{ color: 'red' }}>{error}</div>}
				{success && <div style={{ color: 'green' }}>{success}</div>}
			</form>
		</div>
	);
};

export default Signup;
