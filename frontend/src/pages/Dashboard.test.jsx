import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n/index';
import { AuthContext } from '../context/AuthContext';
import Dashboard from './Dashboard';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const defaultUser = {
  first_name: 'Demo',
  analysis_limits: {
    max_items_per_analysis: 75,
    max_text_chars: 100000,
    max_file_size_mb: 12,
  },
};

function renderDashboard(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <I18nProvider defaultLang="en">
        <AuthContext.Provider value={{ user: defaultUser, loading: false }}>
          <Dashboard />
        </AuthContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('Dashboard unified scanner', () => {
  beforeEach(() => {
    cleanup();
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue({
      data: {
        analysis_transactions: [],
        activity_events: [],
        billing_transactions: [],
      },
    });
  });

  it('defaults to file mode on threatintel workspace route and can switch to indicator mode', async () => {
    const user = userEvent.setup();
    renderDashboard('/threatintel');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/transactions?limit=8');
    });

    expect(screen.getByRole('tab', { name: /file upload/i })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /indicator, url, hash, domain/i }));
    expect(screen.getByRole('tab', { name: /indicator, url, hash, domain/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText(/example: hash, url, domain, or ip/i)).toBeInTheDocument();
  });

  it('opens in file mode when mode=file query is provided', async () => {
    renderDashboard('/dashboard?mode=file');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/transactions?limit=8');
    });

    const fileModeTabs = screen.getAllByRole('tab', { name: /file upload/i });
    expect(fileModeTabs.some((tab) => tab.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(screen.getByLabelText(/upload file/i)).toBeInTheDocument();
    expect(screen.getByText(/accepted: pdf, docx, txt, log, csv, json/i)).toBeInTheDocument();
  });

  it('submits threat intake and shows score breakdown inline', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((url) => {
      if (url === '/auth/transactions?limit=8') {
        return Promise.resolve({
          data: {
            analysis_transactions: [],
            activity_events: [],
            billing_transactions: [],
          },
        });
      }

      if (url === '/api/analysis/321') {
        return Promise.resolve({
          data: {
            analysis_id: 321,
            indicator: 'http://suspicious-example-login.com/verify',
            threat_level: 'Medium',
            threat_score: 46,
            indicators_of_compromise: [{ type: 'url', value: 'http://suspicious-example-login.com/verify' }],
            suspicious_patterns: [{ name: 'possible phishing lure keyword', confidence: 0.8 }],
            intake: {
              source: 'email_gateway',
              confidence: 'high',
              asset_criticality: 'critical',
              network_scope: 'external',
            },
            insights: {
              severity_rationale: 'Medium severity due to mixed signals: some suspicious patterns detected but not consistently malicious.',
            },
            threat_score_breakdown: {
              base_iocs: 5,
              base_patterns: 10,
              enrichment_virustotal: 0,
              enrichment_abuseipdb: 0,
              context_adjustment: 31,
              total: 46,
            },
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    mockPost.mockImplementation((url) => {
      if (url === '/api/threat-intel/intake') {
        return Promise.resolve({
          data: {
            status: 'success',
            analysisId: 321,
            threat_score: 46,
            threat_level: 'Medium',
            threat_score_breakdown: {
              base_iocs: 5,
              base_patterns: 10,
              enrichment_virustotal: 0,
              enrichment_abuseipdb: 0,
              context_adjustment: 31,
              total: 46,
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderDashboard('/threatintel');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/transactions?limit=8');
    });

    await user.click(screen.getByRole('tab', { name: /indicator, url, hash, domain/i }));
    await user.type(screen.getByLabelText(/indicator input/i), 'http://suspicious-example-login.com/verify');
    await user.selectOptions(screen.getByLabelText(/source/i), 'email_gateway');
    await user.selectOptions(screen.getByLabelText(/confidence/i), 'high');
    await user.selectOptions(screen.getByLabelText(/asset criticality/i), 'critical');
    await user.selectOptions(screen.getByLabelText(/network scope/i), 'external');

    const analysisForm = document.querySelector('.user-dashboard__analysis-form');
    expect(analysisForm).toBeTruthy();
    fireEvent.submit(analysisForm);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/threat-intel/intake', expect.objectContaining({
        indicator: 'http://suspicious-example-login.com/verify',
        source: 'email_gateway',
        confidence: 'high',
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /open full report/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/score 46\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/drivers:/i)).toBeInTheDocument();
    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open full report/i })).toHaveAttribute('href', '/analysis/321');
  });

  it('shows required source and confidence intake fields in file mode', async () => {
    renderDashboard('/threatintel');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/auth/transactions?limit=8');
    });

    expect(screen.getByRole('tab', { name: /file upload/i })).toHaveAttribute('aria-selected', 'true');

    const sourceSelect = screen.getByLabelText(/^source$/i);
    const confidenceSelect = screen.getByLabelText(/^confidence$/i);
    expect(sourceSelect).toBeRequired();
    expect(confidenceSelect).toBeRequired();
    expect(screen.getByText(/quick presets/i)).toBeInTheDocument();
  });
});
