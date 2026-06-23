import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './AnalysisResults.css';

export default function AnalysisResults() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareMethod, setShareMethod] = useState(null);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    fetchAnalysisResults();
  }, [analysisId]);

  const fetchAnalysisResults = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/analysis/${analysisId}`);
      setResults(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analysis results');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format = 'pdf') => {
    try {
      const response = await api.get(`/api/analysis/${analysisId}/download?format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analysis-${analysisId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (err) {
      alert('Failed to download report');
    }
  };

  const sendViaEmail = async () => {
    if (!emailInput) {
      alert('Please enter an email address');
      return;
    }
    try {
      await api.post(`/api/analysis/${analysisId}/share`, {
        email: emailInput,
        method: 'email'
      });
      alert('Report sent successfully!');
      setShareMethod(null);
      setEmailInput('');
    } catch (err) {
      alert('Failed to send email');
    }
  };

  const copyShareLink = async () => {
    try {
      const response = await api.post(`/api/analysis/${analysisId}/share`, {
        method: 'link'
      });
      const shareUrl = `${window.location.origin}${response.data.share_url || `/api/analysis/shared/${response.data.share_token}`}`;
      navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (err) {
      alert('Failed to create share link');
    }
  };

  if (loading) {
    return <div className="results-loading">⏳ Analyzing results...</div>;
  }

  if (error) {
    return (
      <div className="results-error">
        <p>❌ {error}</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  if (!results) {
    return <div className="results-error">No results found</div>;
  }

  return (
    <div className="analysis-results">
      {/* Header */}
      <section className="results-header">
        <div className="results-title-block">
          <h1>Analysis Results</h1>
          <p className="results-subtitle">
            {results.file_path || results.indicator} • {new Date(results.analysis_date).toLocaleString()}
          </p>
        </div>

        {/* Threat Level Badge */}
        <div className={`threat-badge threat-${results.threat_level?.toLowerCase() || 'low'}`}>
          <span className="threat-icon">
            {results.threat_level === 'High' ? '🔴' : results.threat_level === 'Medium' ? '🟡' : '🟢'}
          </span>
          <span className="threat-text">{results.threat_level || 'Unknown'}</span>
        </div>
      </section>

      {/* Action Bar */}
      <section className="results-actions">
        <div className="actions-left">
          <button className="btn btn-primary" onClick={() => downloadReport('pdf')}>
            📥 Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => downloadReport('json')}>
            📋 Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => downloadReport('csv')}>
            📊 Export CSV
          </button>

        </div>

        <div className="actions-right">
          <button 
            className="btn btn-accent"
            onClick={() => setShareMethod(shareMethod === 'email' ? null : 'email')}
          >
            ✉️ Send Email
          </button>
          <button className="btn btn-accent" onClick={copyShareLink}>
            🔗 Share Link
          </button>
        </div>
      </section>

      {/* Email Share Panel */}
      {shareMethod === 'email' && (
        <div className="share-panel">
          <input
            type="email"
            placeholder="recipient@company.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="share-input"
          />
          <button onClick={sendViaEmail} className="btn btn-primary">Send</button>
          <button onClick={() => setShareMethod(null)} className="btn btn-secondary">Cancel</button>
        </div>
      )}

      {/* Summary Stats */}
      <section className="results-summary">
        <div className="summary-card">
          <div className="summary-value">{results.indicators_of_compromise?.length || 0}</div>
          <div className="summary-label">Indicators Found</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{results.suspicious_patterns?.length || 0}</div>
          <div className="summary-label">Suspicious Patterns</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{results.alerts_triggered?.length || 0}</div>
          <div className="summary-label">Alerts Triggered</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{results.metadata?.size ? (results.metadata.size / 1024).toFixed(1) : 0} KB</div>
          <div className="summary-label">File Size</div>
        </div>
      </section>

      {/* File Metadata */}
      {results.metadata && (
        <section className="results-section">
          <h2>📄 File Information</h2>
          <div className="metadata-grid">
            <div className="metadata-item">
              <label>File Type:</label>
              <span>{results.file_type || 'Unknown'}</span>
            </div>
            <div className="metadata-item">
              <label>Size:</label>
              <span>{(results.metadata.size / 1024).toFixed(2)} KB</span>
            </div>
            <div className="metadata-item">
              <label>Last Modified:</label>
              <span>{new Date(results.metadata.last_modified * 1000).toLocaleString()}</span>
            </div>
          </div>
        </section>
      )}

      {/* Indicators of Compromise */}
      {results.indicators_of_compromise && results.indicators_of_compromise.length > 0 && (
        <section className="results-section">
          <h2>🚨 Indicators of Compromise (IoCs)</h2>
          <div className="ioc-container">
            {results.indicators_of_compromise.map((ioc, idx) => (
              <div key={idx} className={`ioc-card ioc-${ioc.type}`}>
                <div className="ioc-type-badge">{ioc.type}</div>
                <div className="ioc-value">{ioc.value}</div>
                {ioc.severity && (
                  <div className={`ioc-severity severity-${ioc.severity.toLowerCase()}`}>
                    {ioc.severity}
                  </div>
                )}
                {ioc.description && (
                  <div className="ioc-description">{ioc.description}</div>
                )}
                <button 
                  className="ioc-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(ioc.value);
                    alert('Copied to clipboard!');
                  }}
                >
                  📋 Copy
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suspicious Patterns */}
      {results.suspicious_patterns && results.suspicious_patterns.length > 0 && (
        <section className="results-section">
          <h2>⚠️ Suspicious Patterns Detected</h2>
          <div className="patterns-list">
            {results.suspicious_patterns.map((pattern, idx) => (
              <div key={idx} className="pattern-item">
                <div className="pattern-header">
                  <span className="pattern-name">{pattern.name}</span>
                  <span className={`pattern-confidence confidence-${(pattern.confidence * 100).toFixed(0)}`}>
                    {(pattern.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="pattern-description">{pattern.description}</p>
                {pattern.evidence && (
                  <div className="pattern-evidence">
                    <strong>Evidence:</strong> {pattern.evidence}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerts Triggered */}
      {results.alerts_triggered && results.alerts_triggered.length > 0 && (
        <section className="results-section">
          <h2>🔔 Alerts Triggered</h2>
          <div className="alerts-list">
            {results.alerts_triggered.map((alert, idx) => (
              <div key={idx} className="alert-item">
                <span className="alert-icon">⚡</span>
                <span className="alert-text">{alert}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VirusTotal / Third-party Enrichment */}
      {results.enrichment && (
        <section className="results-section">
          <h2>🔍 Third-Party Intelligence</h2>
          <div className="enrichment-grid">
            {results.enrichment.virustotal && (
              <div className="enrichment-card">
                <h3>VirusTotal</h3>
                <div className="enrichment-stat">
                  <label>Detections:</label>
                  <span>{results.enrichment.virustotal.detections || 'N/A'}</span>
                </div>
                <div className="enrichment-stat">
                  <label>Last Analysis:</label>
                  <span>{results.enrichment.virustotal.last_analysis || 'N/A'}</span>
                </div>
                <a href={`https://www.virustotal.com/gui/search/${results.indicator}`} 
                   target="_blank" rel="noopener noreferrer" className="external-link">
                  View on VirusTotal →
                </a>
              </div>
            )}
            {results.enrichment.abuseipdb && (
              <div className="enrichment-card">
                <h3>AbuseIPDB</h3>
                <div className="enrichment-stat">
                  <label>Abuse Score:</label>
                  <span>{results.enrichment.abuseipdb.abuse_score || 'N/A'}%</span>
                </div>
                <a href={`https://www.abuseipdb.com/check/${results.indicator}`} 
                   target="_blank" rel="noopener noreferrer" className="external-link">
                  View on AbuseIPDB →
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* No Threats Found */}
      {(!results.indicators_of_compromise || results.indicators_of_compromise.length === 0) &&
       (!results.suspicious_patterns || results.suspicious_patterns.length === 0) && (
        <section className="results-section results-clean">
          <h2>✅ Analysis Complete</h2>
          <p>No indicators of compromise or suspicious patterns detected in this analysis.</p>
        </section>
      )}

      {/* Footer Actions */}
      <section className="results-footer">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          ← Back to Dashboard
        </button>
        <button onClick={() => navigate('/upload')} className="btn btn-primary">
          Analyze Another File
        </button>
      </section>
    </div>
  );
}
