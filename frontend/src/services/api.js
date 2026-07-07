import axios from 'axios';

const getDefaultApiBase = () => {
  const configured = (import.meta.env.VITE_API_URL || '').trim();
  const frontendOnlyHosts = new Set(['insights.guecyber.com', 'www.insights.guecyber.com']);

  const normalizeConfiguredApi = (urlValue) => {
    if (!urlValue) {
      return '';
    }

    try {
      const parsed = new URL(urlValue);
      if (import.meta.env.PROD && frontendOnlyHosts.has(parsed.hostname)) {
        // Guard against a misconfigured frontend-domain API URL in production.
        return 'https://kuber.guecyber.com';
      }
      return parsed.origin;
    } catch {
      return urlValue;
    }
  };

  if (configured) {
    return normalizeConfiguredApi(configured);
  }

  if (import.meta.env.PROD) {
    // Production: prefer explicit VITE_API_URL; fallback to the live Render backend.
    return 'https://kuber.guecyber.com';
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
