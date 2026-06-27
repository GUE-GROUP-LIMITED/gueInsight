import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AnalysisResults from './AnalysisResults';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

describe('AnalysisResults score transparency', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();

    mockGet.mockImplementation((url) => {
      if (url === '/api/analysis/1') {
        return Promise.resolve({
          data: {
            analysis_id: 1,
            analysis_date: new Date().toISOString(),
            indicator: 'http://suspicious-example-login.com/verify',
            file_path: null,
            file_type: 'text/plain',
            metadata: { size: 1024, last_modified: 1718000000 },
            threat_level: 'Medium',
            threat_score: 46,
            indicators_of_compromise: [{ type: 'url', value: 'http://suspicious-example-login.com/verify', severity: 'Medium' }],
            suspicious_patterns: [{ name: 'possible phishing lure keyword', description: 'Keyword pattern', confidence: 0.8 }],
            alerts_triggered: [],
            enrichment: {
              virustotal: { detections: 0, last_analysis: 'N/A' },
            },
            threat_score_breakdown: {
              base_iocs: 5,
              base_patterns: 10,
              enrichment_virustotal: 0,
              enrichment_abuseipdb: 0,
              context_adjustment: 31,
              total: 46,
              context_factors: [
                { factor: 'confidence', value: 'high', adjustment: 8 },
                { factor: 'asset_criticality', value: 'critical', adjustment: 12 },
                { factor: 'network_scope', value: 'external', adjustment: 6 },
                { factor: 'source', value: 'email_gateway', adjustment: 5 },
              ],
            },
          },
        });
      }

      return Promise.resolve({ data: {} });
    });
  });

  it('renders threat score breakdown and context factor details', async () => {
    render(
      <MemoryRouter initialEntries={['/analysis/1']}>
        <Routes>
          <Route path="/analysis/:analysisId" element={<AnalysisResults />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/analysis/1');
    });

    expect(screen.getByText(/threat score \(0-100\)/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /threat score breakdown/i })).toBeInTheDocument();
    expect(screen.getByText(/context adjustment/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /context factor details/i })).toBeInTheDocument();
    expect(screen.getByText(/confidence: high/i)).toBeInTheDocument();
    expect(screen.getByText(/asset criticality: critical/i)).toBeInTheDocument();
  });
});
