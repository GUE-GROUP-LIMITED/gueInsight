import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import ComplianceTierMatrix from '../components/ComplianceTierMatrix';
import NIS2IncidentReport from '../components/NIS2IncidentReport';
import './AdminCompliance.css';

const severityOrder = { critical: 3, warning: 2, info: 1 };

const AdminCompliance = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [securityEvents, setSecurityEvents] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState('');

  const loadComplianceData = async () => {
    setLoading(true);
    setError('');
    try {
      const [eventsResponse, requestsResponse] = await Promise.all([
        api.get('/admin/security_events?limit=100'),
        api.get('/admin/deletion_requests'),
      ]);

      setSecurityEvents(Array.isArray(eventsResponse.data?.security_events) ? eventsResponse.data.security_events : []);
      setDeletionRequests(Array.isArray(requestsResponse.data?.deletion_requests) ? requestsResponse.data.deletion_requests : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load compliance data right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierId) => {
    setError('');
    try {
      const res = await api.post('/checkout/create-session', { tier_id: tierId });
      const checkoutUrl = res?.data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError('Unable to create Stripe checkout session.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Stripe checkout failed.');
    }
  };

  const handleIncidentSubmit = async (incidentData) => {
    setIncidentSubmitting(true);
    setIncidentMessage('');
    setError('');
    try {
      const res = await api.post('/api/incidents/report-nis2', incidentData);
      const incidentId = res?.data?.incident_id || res?.data?.id;
      setIncidentMessage('Incident submitted. ID: ' + (incidentId || 'N/A'));
      if (incidentId) await handlePDFDownload(incidentId);
      await loadComplianceData();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to submit incident.');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handlePDFDownload = async (incidentId) => {
    setError('');
    try {
      const res = await api.get(`/api/incidents/nis2/${incidentId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `NIS2_Incident_${incidentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to download PDF.');
    }
  };

  useEffect(() => {
    loadComplianceData();
  }, []);

  const severityBreakdown = useMemo(() => {
    const counts = { info: 0, warning: 0, critical: 0 };
    securityEvents.forEach((event) => {
      const key = String(event.severity || '').toLowerCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [securityEvents]);

  const pendingRequests = useMemo(() => {
    return deletionRequests.filter((item) => String(item.status || '').toLowerCase() === 'pending').length;
  }, [deletionRequests]);

  const sortedSecurityEvents = useMemo(() => {
    return [...securityEvents].sort((a, b) => {
      const aScore = severityOrder[String(a.severity || '').toLowerCase()] || 0;
      const bScore = severityOrder[String(b.severity || '').toLowerCase()] || 0;
      if (aScore !== bScore) return bScore - aScore;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }, [securityEvents]);

  const updateDeletionStatus = async (requestId, status) => {
    setUpdatingId(requestId);
    setError('');
    try {
      await api.patch(`/admin/deletion_requests/${requestId}`, { status });
      await loadComplianceData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to update request status right now.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="admin-compliance-page">
      <header className="admin-compliance-page__header">
        <div>
          <p className="admin-compliance-page__eyebrow">Governance</p>
          <h1>Compliance operations center</h1>
          <p>Review security events and process GDPR deletion requests from one admin workspace.</p>
        </div>
        <Link to="/admin" className="admin-compliance-page__link">Back to dashboard</Link>
      </header>

      <section className="admin-compliance-page__stats">
        <article>
          <span>Security events</span>
          <strong>{securityEvents.length}</strong>
        </article>
        <article>
          <span>Critical</span>
          <strong>{severityBreakdown.critical}</strong>
        </article>
        <article>
          <span>Warnings</span>
          <strong>{severityBreakdown.warning}</strong>
        </article>
        <article>
          <span>Pending deletion requests</span>
          <strong>{pendingRequests}</strong>
        </article>
      </section>

      <section className="admin-compliance-page__feature-area">
        <article className="admin-compliance-card admin-compliance-card--tiers">
          <h2>Pricing & Compliance Tiers</h2>
          <ComplianceTierMatrix currentTier="compliance_pro" onUpgrade={handleUpgrade} />
        </article>

        <article className="admin-compliance-card admin-compliance-card--incident">
          <h2>Report NIS2 Incident</h2>
          <NIS2IncidentReport
            onSubmit={handleIncidentSubmit}
            onDownloadPDF={handlePDFDownload}
          />
          {incidentSubmitting ? <p>Submitting incident...</p> : null}
          {incidentMessage ? <p className="admin-compliance-success">{incidentMessage}</p> : null}
        </article>
      </section>

      {loading ? <p className="admin-compliance-page__feedback">Loading compliance data...</p> : null}
      {error ? <p className="admin-compliance-page__feedback admin-compliance-page__feedback--error">{error}</p> : null}

      <section className="admin-compliance-page__grid">
        <article className="admin-compliance-card">
          <h2>Recent security events</h2>
          <div className="admin-compliance-table-wrap">
            <table className="admin-compliance-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>User</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {sortedSecurityEvents.slice(0, 40).map((event) => (
                  <tr key={event.id}>
                    <td>{event.created_at ? new Date(event.created_at).toLocaleString() : 'N/A'}</td>
                    <td>{event.event_type || 'N/A'}</td>
                    <td>
                      <span className={`admin-compliance-pill admin-compliance-pill--${String(event.severity || 'info').toLowerCase()}`}>
                        {event.severity || 'info'}
                      </span>
                    </td>
                    <td>{event.user_email || `User #${event.user_id || 'N/A'}`}</td>
                    <td>{event.ip_address || 'N/A'}</td>
                  </tr>
                ))}
                {!loading && sortedSecurityEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No security events found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-compliance-card">
          <h2>Deletion requests</h2>
          <div className="admin-compliance-table-wrap">
            <table className="admin-compliance-table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deletionRequests.map((item) => {
                  const status = String(item.status || '').toLowerCase();
                  const isPending = status === 'pending';
                  return (
                    <tr key={item.id}>
                      <td>{item.requested_at ? new Date(item.requested_at).toLocaleString() : 'N/A'}</td>
                      <td>{item.user_email || `User #${item.user_id}`}</td>
                      <td>{item.status}</td>
                      <td>{item.reason || 'No reason provided.'}</td>
                      <td className="admin-compliance-actions">
                        <button
                          type="button"
                          disabled={!isPending || updatingId === item.id}
                          onClick={() => updateDeletionStatus(item.id, 'in_review')}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => updateDeletionStatus(item.id, 'processed')}
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && deletionRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No deletion requests found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
};

export default AdminCompliance;
