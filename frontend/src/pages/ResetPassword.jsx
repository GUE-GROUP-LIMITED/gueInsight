import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PublicHeader from '../components/PublicHeader';
import './AuthPricing.css';

const ResetPassword = () => {
  const location = useLocation();
  const isAdminFlow = location.pathname.startsWith('/admin');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccess('Check your email for password reset instructions!');
    setLoading(false);
  };

  return (
    <>
      {!isAdminFlow ? <PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/#pricing" trialTo="/signup" /> : null}
      <main className="auth-pricing-page auth-pricing-page--auth">
        <section className="auth-pricing-card">
        <div className="auth-pricing-card__head">
          <p className="auth-pricing-card__eyebrow">{isAdminFlow ? 'Staff Access' : 'Credential Recovery'}</p>
          <h1>{isAdminFlow ? 'Change your password' : 'Reset your password'}</h1>
          <p>
            {isAdminFlow
              ? 'Enter your account email and we will send a secure staff password reset link.'
              : 'Enter your account email and we will send a secure reset link.'}
          </p>
        </div>

        <form className="auth-pricing-form" onSubmit={handleSubmit}>
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : isAdminFlow ? 'Send staff reset link' : 'Send reset email'}
          </button>

          {error ? <p className="auth-pricing-message auth-pricing-message--error">{error}</p> : null}
          {success ? <p className="auth-pricing-message auth-pricing-message--success">{success}</p> : null}
        </form>
        </section>
      </main>
    </>
  );
};

export default ResetPassword;
