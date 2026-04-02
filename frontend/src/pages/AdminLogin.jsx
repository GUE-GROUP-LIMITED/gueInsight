import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext, normalizeRole } from '../context/AuthContext';
import './AdminLogin.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const adminSignupUrl = `${api.defaults.baseURL}/admin_signup`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/admin_login', { email, password }, { withCredentials: true });
      const sessionResponse = await api.get('/auth/session', { validateStatus: () => true });
      const authenticatedUser = sessionResponse.data?.user || null;
      setUser(authenticatedUser);
      const role = normalizeRole(authenticatedUser?.role);
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } catch (loginError) {
      const status = loginError?.response?.status;
      const responseData = loginError?.response?.data;
      const backendMessage =
        (responseData && typeof responseData === 'object' && (responseData.error || responseData.message)) ||
        (typeof responseData === 'string' ? responseData : '');

      let message = backendMessage;
      if (!message && (status === 401 || status === 403)) {
        message = 'Invalid credentials or insufficient permissions. Use a staff admin account.';
      }
      if (!message && status >= 500) {
        message = 'Server error while signing in. Please try again shortly.';
      }
      if (!message) {
        const baseUrl = api?.defaults?.baseURL || 'http://localhost:5000';
        message = `Cannot reach staff auth service. Confirm backend is running at ${baseUrl}.`;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <section className="admin-login__card">
        <div className="admin-login__brand-row">
          <div>
            <p className="admin-login__eyebrow">Staff access</p>
            <h1>Admin login</h1>
          </div>
          <Link to="/" className="admin-login__home-link">
            Home
          </Link>
        </div>

        <p className="admin-login__lead">
          Sign in with your company staff account. Subscriber accounts stay on the user side of the product, even when
          they manage multiple sub-users underneath them.
        </p>

        <form className="admin-login__form" onSubmit={handleSubmit}>
          <label className="admin-login__field">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@company.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="admin-login__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <div className="admin-login__error">{error}</div> : null}

          <button type="submit" className="admin-login__submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="admin-login__footer">
          <Link to="/login">User login</Link>
          <a href={adminSignupUrl}>Create staff account</a>
        </div>
      </section>
    </div>
  );
};

export default AdminLogin;