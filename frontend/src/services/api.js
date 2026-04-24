import axios from 'axios';

const getDefaultApiBase = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
  }

  if (import.meta.env.PROD) {
    return 'https://kuber.insights.guecyber.com';
  }

  return 'http://localhost:5000';
};

const API_BASE = getDefaultApiBase();

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Example usage:
// api.get('/api/some_endpoint')
// api.post('/api/login', { email, password })
