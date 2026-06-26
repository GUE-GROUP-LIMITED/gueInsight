import axios from 'axios';

const getDefaultApiBase = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
  }

  if (import.meta.env.PROD) {
    // Production: use company domain with api subdomain
    return 'https://api.insights.guecyber.com';
  }

  // Development: match the active frontend host to avoid cross-site cookie issues.
  const devHost = typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';
  return `http://${devHost}:5000`;
};

const API_BASE = getDefaultApiBase();

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Example usage:
// api.get('/api/some_endpoint')
// api.post('/api/login', { email, password })
