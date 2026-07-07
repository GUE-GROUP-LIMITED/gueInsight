import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import { api } from '../services/api';
import './AuthPricing.css';

const ResetPassword = () => {
  const location = useLocation();
  const isAdminFlow = location.pathname.startsWith('/admin');
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('token');
  const isConfirmFlow = Boolean(resetToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const withTimeout = (promise, timeoutMs = 15000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Reset request timed out. Please try again.')), timeoutMs);
      }),
    ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isConfirmFlow) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const { data } = await withTimeout(
          api.post('/auth/password/reset/confirm', {
            token: resetToken,
            password,
          })
        );

        setSuccess(data?.message || 'Password updated successfully. You can now sign in.');
        return;
      }

      const { data } = await withTimeout(
        api.post('/auth/password/reset/request', {
          email,
          redirect_to: `${window.location.origin}/reset-password`,
        })
      );
      setSuccess(data?.message || 'If that account exists, a reset email has been sent.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to send reset email right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isAdminFlow ? <PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/subscription" trialTo="/subscription" /> : null}
      <main className="auth-pricing-page auth-pricing-page--auth">
        <section className="auth-pricing-card">
        <div className="auth-pricing-card__head">
          <p className="auth-pricing-card__eyebrow">{isAdminFlow ? 'Staff Access' : 'Credential Recovery'}</p>
          <h1>{isConfirmFlow ? 'Set a new password' : isAdminFlow ? 'Change your password' : 'Reset your password'}</h1>
          <p>
            {isConfirmFlow
              ? 'Enter your new password to complete account recovery.'
              : isAdminFlow
              ? 'Enter your account email and we will send a secure staff password reset link.'
              : 'Enter your account email and we will send a secure reset link.'}
          </p>
        </div>

        <form className="auth-pricing-form" onSubmit={handleSubmit}>
          {!isConfirmFlow ? (
            <>
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </>
          ) : (
            <>
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                placeholder="Enter a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? 'Sending...'
              : isConfirmFlow
                ? 'Update password'
                : isAdminFlow
                  ? 'Send staff reset link'
                  : 'Send reset email'}
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
