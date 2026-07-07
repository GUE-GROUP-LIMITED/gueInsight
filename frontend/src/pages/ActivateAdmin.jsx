import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import { api } from '../services/api';
import './ActivateAdmin.css';

const ActivateAdmin = () => {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const submitActivation = async (event) => {
    event.preventDefault();
    if (!token) {
      setErrorMessage('Activation token is missing from this link.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      const response = await api.post('/auth/admin-invite/accept', {
        token,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        password,
      });

      setSuccessMessage(response.data?.message || 'Account activated successfully. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error?.response?.data?.error || 'Activation failed. Please request a new invitation link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="activate-admin-page">
      <PublicHeader
        showLogin={true}
        loginLabel="Admin Login"
        loginTo="/admin/login"
        trialLabel="Back to Home"
        trialTo="/"
      />

      <main className="activate-admin-page__content">
        <section className="activate-admin-page__panel" aria-label="Admin invitation activation">
          <p className="activate-admin-page__eyebrow">Enterprise Access</p>
          <h1>Activate your admin account</h1>
          <p>
            Complete your profile and set a strong password to activate your invited staff account.
          </p>

          {!token ? (
            <div className="activate-admin-page__notice is-error">
              This activation link is missing a token. Ask your administrator to send a fresh invite.
            </div>
          ) : null}

          {successMessage ? <div className="activate-admin-page__notice is-success">{successMessage}</div> : null}
          {errorMessage ? <div className="activate-admin-page__notice is-error">{errorMessage}</div> : null}

          <form className="activate-admin-page__form" onSubmit={submitActivation}>
            <label>
              First name
              <input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </label>

            <label>
              Last name
              <input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </label>

            <label>
              Phone number
              <input type="text" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>

            <button type="submit" disabled={submitting || !token}>
              {submitting ? 'Activating...' : 'Activate account'}
            </button>
          </form>

          <p className="activate-admin-page__footer">
            Already activated? <Link to="/admin/login">Continue to admin sign in</Link>
          </p>
        </section>
      </main>
    </div>
  );
};

export default ActivateAdmin;
