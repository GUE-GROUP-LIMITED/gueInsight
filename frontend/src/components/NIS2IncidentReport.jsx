import React, { useState } from 'react';
import './NIS2IncidentReport.css';

/* eslint-disable react/no-unescaped-entities */
/**
 * NIS2 Incident Reporting Component
 * Allows admins to report critical infrastructure incidents
 * Supports: ransomware, data_breach, ddos, supply_chain
 * Generates PDF for regulator submission
 */

const NIS2IncidentReport = ({ onSubmit, onDownloadPDF }) => {
  const [formData, setFormData] = useState({
    incident_type: 'ransomware',
    severity: 'high',
    affected_systems: '',
    initial_detection_at: new Date().toISOString().split('T')[0],
    description: '',
    actions_taken: '',
    notification_recipient: '',
  });

  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');
  const [incidentId, setIncidentId] = useState(null);

  const incidentTypes = [
    { value: 'ransomware', label: 'Ransomware Attack' },
    { value: 'data_breach', label: 'Data Breach' },
    { value: 'ddos', label: 'DDoS Attack' },
    { value: 'supply_chain', label: 'Supply Chain Compromise' },
  ];

  const severityLevels = [
    { value: 'critical', label: 'Critical', color: '#d32f2f' },
    { value: 'high', label: 'High', color: '#f57c00' },
    { value: 'medium', label: 'Medium', color: '#fbc02d' },
    { value: 'low', label: 'Low', color: '#388e3c' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      // Format datetime for ISO 8601 with time
      const detectionTime = new Date(formData.initial_detection_at).toISOString();

      const response = await fetch('/api/incidents/report-nis2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...formData,
          initial_detection_at: detectionTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setIncidentId(data.incident_id);
      setStatus('success');
      setMessage(`Incident #${data.incident_id} reported successfully. You can now download the PDF for regulator submission.`);

      // Call callback if provided
      if (onSubmit) {
        onSubmit(data);
      }

      // Reset form after success
      setTimeout(() => {
        setFormData({
          incident_type: 'ransomware',
          severity: 'high',
          affected_systems: '',
          initial_detection_at: new Date().toISOString().split('T')[0],
          description: '',
          actions_taken: '',
          notification_recipient: '',
        });
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(`Error reporting incident: ${error.message}`);
      console.error('NIS2 report error:', error);
    } finally {
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!incidentId) return;

    try {
      const response = await fetch(`/api/incidents/nis2/${incidentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NIS2_Incident_${incidentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (onDownloadPDF) {
        onDownloadPDF(incidentId);
      }
    } catch (error) {
      setMessage(`Error downloading PDF: ${error.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="nis2-incident-report">
      <div className="report-header">
        <h2>NIS2 Incident Report</h2>
        <p className="report-subtitle">
          Report critical infrastructure incidents to competent authorities
        </p>
        <div className="nis2-info">
          <strong>🔒 Directive:</strong> NIS2 Directive (EU 2022/2555) - Mandatory for critical infrastructure operators
        </div>
      </div>

      <form onSubmit={handleSubmit} className="incident-form">
        {/* Incident Type */}
        <div className="form-group">
          <label htmlFor="incident_type">
            Incident Type <span className="required">*</span>
          </label>
          <select
            id="incident_type"
            name="incident_type"
            value={formData.incident_type}
            onChange={handleInputChange}
            required
          >
            {incidentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div className="form-group">
          <label htmlFor="severity">
            Severity Level <span className="required">*</span>
          </label>
          <div className="severity-selector">
            {severityLevels.map((level) => (
              <label key={level.value} className="severity-option">
                <input
                  type="radio"
                  name="severity"
                  value={level.value}
                  checked={formData.severity === level.value}
                  onChange={handleInputChange}
                />
                <span
                  className="severity-badge"
                  style={{ borderColor: level.color, color: level.color }}
                >
                  {level.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Affected Systems */}
        <div className="form-group">
          <label htmlFor="affected_systems">
            Affected Systems <span className="required">*</span>
          </label>
          <input
            type="text"
            id="affected_systems"
            name="affected_systems"
            placeholder="e.g., Email, VPN, File Share, Domain Controllers"
            value={formData.affected_systems}
            onChange={handleInputChange}
            required
          />
          <small>Comma-separated list of affected systems</small>
        </div>

        {/* Detection Time */}
        <div className="form-group">
          <label htmlFor="initial_detection_at">
            Initial Detection Time <span className="required">*</span>
          </label>
          <input
            type="date"
            id="initial_detection_at"
            name="initial_detection_at"
            value={formData.initial_detection_at}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">
            Incident Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows="5"
            placeholder="Provide a detailed description of the incident, timeline, and impact..."
            value={formData.description}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Actions Taken */}
        <div className="form-group">
          <label htmlFor="actions_taken">
            Actions Taken <span className="required">*</span>
          </label>
          <textarea
            id="actions_taken"
            name="actions_taken"
            rows="4"
            placeholder="Describe remediation steps, containment measures, and current status..."
            value={formData.actions_taken}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Notification Recipient */}
        <div className="form-group">
          <label htmlFor="notification_recipient">
            Notification Recipient (Competent Authority)
          </label>
          <input
            type="email"
            id="notification_recipient"
            name="notification_recipient"
            placeholder="e.g., incident@bsi.de (German BSI)"
            value={formData.notification_recipient}
            onChange={handleInputChange}
          />
          <small>Email of the competent authority (BSI, ENISA, etc.)</small>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`status-message ${status}`}>
            {status === 'loading' && <span className="spinner"></span>}
            {status === 'success' && <span className="icon">✓</span>}
            {status === 'error' && <span className="icon">✕</span>}
            <span>{message}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Reporting...' : 'Report Incident'}
          </button>

          {incidentId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadPDF}
            >
              📄 Download PDF for Regulator
            </button>
          )}
        </div>
      </form>

      {/* Authority Contacts */}
      <div className="authority-contacts">
        <h3>Competent Authorities by Country</h3>
        <div className="contacts-grid">
          <div className="contact-card">
            <strong>🇩🇪 Germany</strong>
            <p>Bundesamt für Sicherheit in der Informationstechnik (BSI)</p>
            <a href="mailto:incident@bsi.de">incident@bsi.de</a>
          </div>
          <div className="contact-card">
            <strong>🇫🇷 France</strong>
            <p>Agence nationale de la sécurité des systèmes d'information (ANSSI)</p>
            <a href="mailto:report@anssi.gouv.fr">report@anssi.gouv.fr</a>
          </div>
          <div className="contact-card">
            <strong>🇳🇱 Netherlands</strong>
            <p>Dutch National Cyber Security Centre (NCSC)</p>
            <a href="mailto:incident@ncsc.nl">incident@ncsc.nl</a>
          </div>
          <div className="contact-card">
            <strong>🇪🇺 EU</strong>
            <p>European Network and Information Security Agency (ENISA)</p>
            <a href="https://www.enisa.europa.eu/">www.enisa.europa.eu</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NIS2IncidentReport;
