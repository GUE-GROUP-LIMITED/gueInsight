import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './AnalysisResults.css';
import {
  IconShield,
  IconDownload,
  IconCopy,
  IconCheck,
  IconCheckCircle,
  IconAlertTriangle,
  IconFile,
  IconMail,
  IconLink,
  IconSearch,
  IconBell,
  IconZap,
  IconBarChart,
  IconX,
} from '../components/Icons';

export default function AnalysisResults() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareMethod, setShareMethod] = useState(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const [reportFormat, setReportFormat] = useState('pdf');

  const formatAdjustment = (value) => {
    const amount = Number(value || 0);
    return amount > 0 ? `+${amount}` : String(amount);
  };

  useEffect(() => {
    fetchResults();
  }, [analysisId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/analysis/${analysisId}`);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch analysis results');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format) => {
    try {
      const response = await api.get(`/api/analysis/${analysisId}/report?format=${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analysis-${analysisId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to download report: ' + (err.response?.data?.error || err.message));
    }
  };

  const shareViaEmail = async (e) => {
    e.preventDefault();
    try {
      setEmailStatus('sending');
      await api.post(`/api/analysis/${analysisId}/share`, {
        email: emailTo,
        format: reportFormat,
      });
      setEmailStatus('success');
      setEmailTo('');
      setTimeout(() => {
        setShareMethod(null);
        setEmailStatus(null);
      }, 3000);
    } catch (err) {
      setEmailStatus('error');
    }
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/analysis/${analysisId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  };

  if (loading) {
    return <div className="results-loading">Loading analysis results...</div>;
  }

  if (error) {
    return (
      <div className="results-error">
        <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconAlertTriangle size={16} color="#ef4444" /> {error}
        </p>
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
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor:
                  results.threat_level === 'High'
                    ? '#ef4444'
                    : results.threat_level === 'Medium'
                    ? '#f59e0b'
                    : '#10b981',
              }}
            />
          </span>
          <span className="threat-text">{results.threat_level || 'Unknown'}</span>
        </div>
      </section>

      {/* Action Bar */}
      <section className="results-actions">
        <div className="actions-left">
          <button className="btn btn-primary" onClick={() => downloadReport('pdf')}>
            <IconDownload size={15} /> Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => downloadReport('json')}>
            <IconCopy size={15} /> Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => downloadReport('csv')}>
            <IconBarChart size={15} /> Export CSV
          </button>
        </div>

        <div className="actions-right">
          <button 
            className="btn btn-accent"
            onClick={() => setShareMethod(shareMethod === 'email' ? null : 'email')}
          >
            <IconMail size={15} /> Send Email
          </button>
          <button className="btn btn-accent" onClick={copyShareLink}>
            <IconLink size={15} /> Share Link
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
        <div className="summary-card summary-card--score">
          <div className="summary-value">{results.threat_score ?? 0}</div>
          <div className="summary-label">Threat Score (0-100)</div>
        </div>
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

      {/* Threat Score Breakdown */}
      {results.threat_score_breakdown && (
        <section className="results-section">
          <h2>Threat Score Breakdown</h2>
          <div className="score-breakdown-grid">
            <div className="score-breakdown-item"><span>IOC signal</span><strong>{results.threat_score_breakdown.base_iocs || 0}</strong></div>
            <div className="score-breakdown-item"><span>Pattern signal</span><strong>{results.threat_score_breakdown.base_patterns || 0}</strong></div>
            <div className="score-breakdown-item"><span>VirusTotal signal</span><strong>{results.threat_score_breakdown.enrichment_virustotal || 0}</strong></div>
            <div className="score-breakdown-item"><span>AbuseIPDB signal</span><strong>{results.threat_score_breakdown.enrichment_abuseipdb || 0}</strong></div>
            <div className="score-breakdown-item"><span>Context adjustment</span><strong>{formatAdjustment(results.threat_score_breakdown.context_adjustment)}</strong></div>
            <div className="score-breakdown-item score-breakdown-item--total"><span>Total score</span><strong>{results.threat_score_breakdown.total || 0}</strong></div>
          </div>

          {Array.isArray(results.threat_score_breakdown.context_factors) && results.threat_score_breakdown.context_factors.length > 0 && (
            <div className="score-factors">
              <h3>Context factor details</h3>
              <ul>
                {results.threat_score_breakdown.context_factors.map((factor, idx) => (
                  <li key={`${factor.factor}-${idx}`}>
                    <span>{factor.factor.replaceAll('_', ' ')}: {factor.value}</span>
                    <strong>{formatAdjustment(factor.adjustment)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* File Metadata */}
      {results.metadata && (
        <section className="results-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconFile size={18} /> File Information
          </h2>
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
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertTriangle size={18} /> Indicators of Compromise (IoCs)
          </h2>
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
                  <IconCopy size={13} /> Copy
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suspicious Patterns */}
      {results.suspicious_patterns && results.suspicious_patterns.length > 0 && (
        <section className="results-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertTriangle size={18} /> Suspicious Patterns Detected
          </h2>
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
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconBell size={18} /> Alerts Triggered
          </h2>
          <div className="alerts-list">
            {results.alerts_triggered.map((alert, idx) => (
              <div key={idx} className="alert-item">
                <span className="alert-icon"><IconZap size={14} /></span>
                <span className="alert-text">{alert}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VirusTotal / Third-party Enrichment */}
      {results.enrichment && (
        <section className="results-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSearch size={18} /> Third-Party Intelligence
          </h2>
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
                <div className="enrichment-stat">
                  <label>Last Analysis:</label>
                  <span>{results.enrichment.abuseipdb.last_analysis || 'N/A'}</span>
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
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCheckCircle size={18} color="#10B981" /> Analysis Complete
          </h2>
          <p>No indicators of compromise or suspicious patterns detected in this analysis.</p>
        </section>
      )}

      {/* Footer Actions */}
      <section className="results-footer">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
          ← Back to Dashboard
        </button>
        <button onClick={() => navigate('/dashboard?mode=file')} className="btn btn-primary">
          Analyze Another Submission
        </button>
      </section>
    </div>
  );
}
