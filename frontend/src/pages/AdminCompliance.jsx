import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import ComplianceTierMatrix from '../components/ComplianceTierMatrix';
import NIS2IncidentReport from '../components/NIS2IncidentReport';
import { useTranslation } from '../i18n/index';
import './AdminCompliance.css';

const severityOrder = { critical: 3, warning: 2, info: 1 };

const AdminCompliance = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [securityEvents, setSecurityEvents] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [complianceReadiness, setComplianceReadiness] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState('');
  const [soc2ActionLoading, setSoc2ActionLoading] = useState(false);
  const [soc2Message, setSoc2Message] = useState('');
  const [soc2Controls, setSoc2Controls] = useState([]);
  const [soc2ControlSummary, setSoc2ControlSummary] = useState(null);
  const [soc2Artifacts, setSoc2Artifacts] = useState([]);
  const [soc2AvailableSources, setSoc2AvailableSources] = useState([]);
  const [soc2AvailableTypes, setSoc2AvailableTypes] = useState([]);
  const [soc2ArtifactFilters, setSoc2ArtifactFilters] = useState({
    search: '',
    source: 'all',
    type: 'all',
    control: 'all',
  });
  const [soc2ArtifactPage, setSoc2ArtifactPage] = useState(1);
  const [soc2ArtifactPagination, setSoc2ArtifactPagination] = useState({
    total: 0,
    total_pages: 1,
    limit: 25,
    page: 1,
  });
  const [soc2SelectedArtifactIds, setSoc2SelectedArtifactIds] = useState([]);
  const [soc2BulkControls, setSoc2BulkControls] = useState('');
  const [soc2BulkMode, setSoc2BulkMode] = useState('replace');
  const [soc2BulkSaving, setSoc2BulkSaving] = useState(false);
  const [soc2MappingDrafts, setSoc2MappingDrafts] = useState({});
  const [soc2MappingSavingId, setSoc2MappingSavingId] = useState(null);

  const loadSoc2Artifacts = async (targetPage = soc2ArtifactPage) => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('limit', String(soc2ArtifactPagination.limit || 25));
    if (soc2ArtifactFilters.source !== 'all') params.set('source', soc2ArtifactFilters.source);
    if (soc2ArtifactFilters.type !== 'all') params.set('type', soc2ArtifactFilters.type);
    if (soc2ArtifactFilters.control !== 'all') params.set('control', soc2ArtifactFilters.control);
    if (soc2ArtifactFilters.search.trim()) params.set('search', soc2ArtifactFilters.search.trim());

    const response = await api.get(`/api/evidence/artifacts?${params.toString()}`);
    setSoc2Artifacts(Array.isArray(response.data?.artifacts) ? response.data.artifacts : []);
    setSoc2AvailableSources(Array.isArray(response.data?.available_sources) ? response.data.available_sources : []);
    setSoc2AvailableTypes(Array.isArray(response.data?.available_types) ? response.data.available_types : []);
    setSoc2ArtifactPagination({
      total: Number(response.data?.total || 0),
      total_pages: Number(response.data?.total_pages || 1),
      limit: Number(response.data?.limit || 25),
      page: Number(response.data?.page || targetPage || 1),
    });
    setSoc2ArtifactPage(Number(response.data?.page || targetPage || 1));
    setSoc2SelectedArtifactIds([]);
  };

  const loadComplianceData = async () => {
    setLoading(true);
    setError('');
    try {
      const [eventsResponse, requestsResponse, readinessResponse, soc2MapResponse] = await Promise.all([
        api.get('/admin/security_events?limit=100'),
        api.get('/admin/deletion_requests'),
        api.get('/api/compliance/readiness'),
        api.get('/api/compliance/soc2/control-map'),
      ]);

      setSecurityEvents(Array.isArray(eventsResponse.data?.security_events) ? eventsResponse.data.security_events : []);
      setDeletionRequests(Array.isArray(requestsResponse.data?.deletion_requests) ? requestsResponse.data.deletion_requests : []);
      setComplianceReadiness(readinessResponse.data || null);
      setSoc2Controls(Array.isArray(soc2MapResponse.data?.controls) ? soc2MapResponse.data.controls : []);
      setSoc2ControlSummary(soc2MapResponse.data?.summary || null);
      await loadSoc2Artifacts(1);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('admin_compliance.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierId) => {
    setError('');
    try {
      const res = await api.post('/auth/subscription/upgrade', { plan: tierId });
      const checkoutUrl = res?.data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else if (res?.data?.receipt_url) {
        window.location.href = '/subscription?upgrade=success';
      } else {
        setError(t('admin_compliance.checkout_session_failed'));
      }
    } catch (err) {
      setError(err?.response?.data?.error || t('admin_compliance.checkout_failed'));
    }
  };

  const handleIncidentSubmit = async (incidentData) => {
    setIncidentSubmitting(true);
    setIncidentMessage('');
    setError('');
    try {
      const res = await api.post('/api/incidents/report-nis2', incidentData);
      const incidentId = res?.data?.incident_id || res?.data?.id;
      setIncidentMessage(t('admin_compliance.incident_submitted', { id: incidentId || 'N/A' }));
      if (incidentId) await handlePDFDownload(incidentId);
      await loadComplianceData();
    } catch (err) {
      setError(err?.response?.data?.error || t('admin_compliance.submit_failed'));
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
      setError(err?.response?.data?.error || t('admin_compliance.download_failed'));
    }
  };

  useEffect(() => {
    loadComplianceData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadSoc2Artifacts(1);
    }
  }, [soc2ArtifactFilters.search, soc2ArtifactFilters.source, soc2ArtifactFilters.type, soc2ArtifactFilters.control]);

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

  const allVisibleArtifactsSelected = useMemo(() => {
    if (!soc2Artifacts.length) return false;
    return soc2Artifacts.every((artifact) => soc2SelectedArtifactIds.includes(artifact.id));
  }, [soc2Artifacts, soc2SelectedArtifactIds]);

  const updateDeletionStatus = async (requestId, status) => {
    setUpdatingId(requestId);
    setError('');
    try {
      await api.patch(`/admin/deletion_requests/${requestId}`, { status });
      await loadComplianceData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('admin_compliance.update_failed'));
    } finally {
      setUpdatingId(null);
    }
  };

  const runSoc2EvidenceGather = async () => {
    setSoc2ActionLoading(true);
    setSoc2Message('');
    setError('');
    try {
      const res = await api.post('/admin/evidence/gather', {});
      const m365Artifacts = res?.data?.summary?.m365?.artifacts || 0;
      const gwsArtifacts = res?.data?.summary?.gws?.artifacts || 0;
      setSoc2Message(`SOC2 evidence collected successfully (${m365Artifacts + gwsArtifacts} artifacts).`);
      await loadComplianceData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to gather SOC2 evidence.');
    } finally {
      setSoc2ActionLoading(false);
    }
  };

  const runSoc2AccessMatrix = async () => {
    setSoc2ActionLoading(true);
    setSoc2Message('');
    setError('');
    try {
      const res = await api.post('/admin/evidence/generate-access-matrix', {});
      const rows = res?.data?.result?.rows || 0;
      setSoc2Message(`SOC2 access matrix generated (${rows} rows).`);
      await loadComplianceData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to generate SOC2 access matrix.');
    } finally {
      setSoc2ActionLoading(false);
    }
  };

  const downloadSoc2Artifact = async (artifactId) => {
    setError('');
    try {
      const response = await api.get(`/api/evidence/artifacts/${artifactId}/download`, { responseType: 'blob' });
      const contentDisposition = response.headers?.['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const fileName = match?.[1] || `artifact_${artifactId}.txt`;
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to download evidence artifact.');
    }
  };

  const saveSoc2ArtifactControls = async (artifactId) => {
    setSoc2MappingSavingId(artifactId);
    setError('');
    setSoc2Message('');
    try {
      const draft = String(soc2MappingDrafts[artifactId] || '');
      const controls = draft
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      await api.patch(`/api/evidence/artifacts/${artifactId}/controls`, { controls });
      setSoc2Message(`Updated SOC2 control mappings for artifact #${artifactId}.`);
      await Promise.all([
        loadSoc2Artifacts(soc2ArtifactPage),
        api.get('/api/compliance/soc2/control-map').then((res) => {
          setSoc2Controls(Array.isArray(res.data?.controls) ? res.data.controls : []);
          setSoc2ControlSummary(res.data?.summary || null);
        }),
      ]);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to update SOC2 control mappings.');
    } finally {
      setSoc2MappingSavingId(null);
    }
  };

  const applyBulkSoc2Controls = async () => {
    if (!soc2SelectedArtifactIds.length) {
      setError('Select at least one artifact to apply bulk control mapping.');
      return;
    }

    setSoc2BulkSaving(true);
    setError('');
    setSoc2Message('');
    try {
      const controls = soc2BulkControls
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      await api.patch('/api/evidence/artifacts/controls/bulk', {
        artifact_ids: soc2SelectedArtifactIds,
        controls,
        mode: soc2BulkMode,
      });

      setSoc2Message(`Applied SOC2 control mapping to ${soc2SelectedArtifactIds.length} artifact(s).`);
      await Promise.all([
        loadSoc2Artifacts(soc2ArtifactPage),
        api.get('/api/compliance/soc2/control-map').then((res) => {
          setSoc2Controls(Array.isArray(res.data?.controls) ? res.data.controls : []);
          setSoc2ControlSummary(res.data?.summary || null);
        }),
      ]);
      setSoc2SelectedArtifactIds([]);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed bulk SOC2 control mapping update.');
    } finally {
      setSoc2BulkSaving(false);
    }
  };

  const toggleArtifactSelection = (artifactId) => {
    setSoc2SelectedArtifactIds((current) => {
      if (current.includes(artifactId)) {
        return current.filter((item) => item !== artifactId);
      }
      return [...current, artifactId];
    });
  };

  const toggleSelectAllVisibleArtifacts = () => {
    if (allVisibleArtifactsSelected) {
      setSoc2SelectedArtifactIds([]);
      return;
    }
    setSoc2SelectedArtifactIds(soc2Artifacts.map((artifact) => artifact.id));
  };

  const exportSoc2AuditPacket = async () => {
    setSoc2ActionLoading(true);
    setSoc2Message('');
    setError('');
    try {
      const response = await api.get('/api/compliance/soc2/audit-packet', { responseType: 'blob' });
      const contentDisposition = response.headers?.['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const fileName = match?.[1] || 'soc2_audit_packet.zip';
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setSoc2Message('SOC2 audit packet exported successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to export SOC2 audit packet.');
    } finally {
      setSoc2ActionLoading(false);
    }
  };

  const soc2Overview = complianceReadiness?.compliance_overview?.soc2;

  return (
    <main className="admin-compliance-page">
      <header className="admin-compliance-page__header">
        <div>
          <p className="admin-compliance-page__eyebrow">{t('admin_compliance.eyebrow')}</p>
          <h1>{t('admin_compliance.heading')}</h1>
          <p>{t('admin_compliance.lead')}</p>
        </div>
        <Link to="/admin" className="admin-compliance-page__link">{t('admin_compliance.back_to_dashboard')}</Link>
      </header>

      <section className="admin-compliance-page__stats">
        <article>
          <span>{t('admin_compliance.security_events')}</span>
          <strong>{securityEvents.length}</strong>
        </article>
        <article>
          <span>{t('admin_compliance.critical')}</span>
          <strong>{severityBreakdown.critical}</strong>
        </article>
        <article>
          <span>{t('admin_compliance.warnings')}</span>
          <strong>{severityBreakdown.warning}</strong>
        </article>
        <article>
          <span>{t('admin_compliance.pending_deletions')}</span>
          <strong>{pendingRequests}</strong>
        </article>
      </section>

      <section className="admin-compliance-page__feature-area">
        <article className="admin-compliance-card admin-compliance-card--tiers">
          <h2>{t('admin_compliance.tiers')}</h2>
          <ComplianceTierMatrix currentTier="compliance_pro" onUpgrade={handleUpgrade} />
        </article>

        <article className="admin-compliance-card admin-compliance-card--incident">
          <h2>{t('admin_compliance.report_incident')}</h2>
          <NIS2IncidentReport
            onSubmit={handleIncidentSubmit}
            onDownloadPDF={handlePDFDownload}
          />
          {incidentSubmitting ? <p>{t('admin_compliance.submitting_incident')}</p> : null}
          {incidentMessage ? <p className="admin-compliance-success">{incidentMessage}</p> : null}
        </article>

        <article className="admin-compliance-card admin-compliance-card--soc2">
          <h2>SOC2 Readiness</h2>
          <p className="admin-compliance-card__muted">
            Generate and track SOC2 evidence artifacts for audit preparation.
          </p>
          <div className="admin-compliance-soc2-stats">
            <div>
              <span>Status</span>
              <strong>{soc2Overview?.status || 'in_progress'}</strong>
            </div>
            <div>
              <span>Controls coverage</span>
              <strong>{Number(soc2Overview?.controls_coverage || 0)}%</strong>
            </div>
            <div>
              <span>Evidence runs</span>
              <strong>{Number(soc2Overview?.evidence_gather_runs || 0)}</strong>
            </div>
            <div>
              <span>Access matrix runs</span>
              <strong>{Number(soc2Overview?.access_matrix_runs || 0)}</strong>
            </div>
          </div>
          <div className="admin-compliance-actions">
            <button type="button" disabled={soc2ActionLoading} onClick={runSoc2EvidenceGather}>
              Gather SOC2 Evidence
            </button>
            <button type="button" disabled={soc2ActionLoading} onClick={runSoc2AccessMatrix}>
              Generate Access Matrix
            </button>
            <button type="button" disabled={soc2ActionLoading} onClick={exportSoc2AuditPacket}>
              Export SOC2 Audit Packet
            </button>
          </div>
          {soc2ControlSummary ? (
            <p className="admin-compliance-card__muted">
              Controls: {soc2ControlSummary.implemented || 0} implemented, {soc2ControlSummary.partial || 0} partial, {soc2ControlSummary.not_started || 0} not started.
            </p>
          ) : null}
          {soc2Message ? <p className="admin-compliance-success">{soc2Message}</p> : null}
        </article>
      </section>

      {loading ? <p className="admin-compliance-page__feedback">{t('admin_compliance.loading')}</p> : null}
      {error ? <p className="admin-compliance-page__feedback admin-compliance-page__feedback--error">{error}</p> : null}

      <section className="admin-compliance-page__grid">
        <article className="admin-compliance-card">
          <h2>SOC2 Control Mapping</h2>
          <div className="admin-compliance-table-wrap">
            <table className="admin-compliance-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Evidence count</th>
                  <th>Hint</th>
                </tr>
              </thead>
              <tbody>
                {soc2Controls.map((control) => (
                  <tr key={control.control_id}>
                    <td>{control.control_id}</td>
                    <td>{control.framework_area || 'N/A'}</td>
                    <td>
                      <span className={`admin-compliance-pill admin-compliance-pill--${String(control.status || 'info').toLowerCase()}`}>
                        {control.status || 'not_started'}
                      </span>
                    </td>
                    <td>{Number(control.evidence_count || 0)}</td>
                    <td>{control.evidence_hint || 'N/A'}</td>
                  </tr>
                ))}
                {!loading && soc2Controls.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No SOC2 controls found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-compliance-card">
          <h2>SOC2 Evidence Artifacts</h2>
          <div className="admin-compliance-filters">
            <input
              type="text"
              placeholder="Search source/type/control"
              value={soc2ArtifactFilters.search}
              onChange={(event) => setSoc2ArtifactFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <select
              value={soc2ArtifactFilters.source}
              onChange={(event) => setSoc2ArtifactFilters((current) => ({ ...current, source: event.target.value }))}
            >
              <option value="all">All sources</option>
              {soc2AvailableSources.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              value={soc2ArtifactFilters.type}
              onChange={(event) => setSoc2ArtifactFilters((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="all">All types</option>
              {soc2AvailableTypes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              value={soc2ArtifactFilters.control}
              onChange={(event) => setSoc2ArtifactFilters((current) => ({ ...current, control: event.target.value }))}
            >
              <option value="all">All controls</option>
              {soc2Controls.map((control) => (
                <option key={control.control_id} value={control.control_id}>{control.control_id}</option>
              ))}
            </select>
          </div>
          <div className="admin-compliance-bulk-row">
            <input
              type="text"
              placeholder="Bulk controls (e.g. CC6.1, CC7.2)"
              value={soc2BulkControls}
              onChange={(event) => setSoc2BulkControls(event.target.value)}
            />
            <select value={soc2BulkMode} onChange={(event) => setSoc2BulkMode(event.target.value)}>
              <option value="replace">Replace</option>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
            <button type="button" disabled={soc2BulkSaving || !soc2SelectedArtifactIds.length} onClick={applyBulkSoc2Controls}>
              {soc2BulkSaving ? 'Applying...' : `Apply to selected (${soc2SelectedArtifactIds.length})`}
            </button>
          </div>
          <div className="admin-compliance-table-wrap">
            <table className="admin-compliance-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allVisibleArtifactsSelected}
                      onChange={toggleSelectAllVisibleArtifacts}
                      aria-label="Select all visible artifacts"
                    />
                  </th>
                  <th>Collected</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Controls</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {soc2Artifacts.map((artifact) => (
                  <tr key={artifact.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={soc2SelectedArtifactIds.includes(artifact.id)}
                        onChange={() => toggleArtifactSelection(artifact.id)}
                        aria-label={`Select artifact ${artifact.id}`}
                      />
                    </td>
                    <td>{artifact.collected_at ? new Date(artifact.collected_at).toLocaleString() : 'N/A'}</td>
                    <td>{artifact.source || 'N/A'}</td>
                    <td>{artifact.artifact_type || 'N/A'}</td>
                    <td>
                      <input
                        className="admin-compliance-control-input"
                        type="text"
                        value={soc2MappingDrafts[artifact.id] ?? (Array.isArray(artifact.control_mappings) ? artifact.control_mappings.join(', ') : '')}
                        onChange={(event) => setSoc2MappingDrafts((current) => ({ ...current, [artifact.id]: event.target.value }))}
                        placeholder="CC6.1, CC7.2"
                      />
                    </td>
                    <td className="admin-compliance-actions">
                      <button type="button" onClick={() => downloadSoc2Artifact(artifact.id)}>
                        Download
                      </button>
                      <button
                        type="button"
                        disabled={soc2MappingSavingId === artifact.id}
                        onClick={() => saveSoc2ArtifactControls(artifact.id)}
                      >
                        {soc2MappingSavingId === artifact.id ? 'Saving...' : 'Save controls'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && soc2Artifacts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No evidence artifacts found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="admin-compliance-pagination">
            <button
              type="button"
              disabled={soc2ArtifactPagination.page <= 1}
              onClick={() => loadSoc2Artifacts(Math.max(1, soc2ArtifactPagination.page - 1))}
            >
              Previous
            </button>
            <span>
              Page {soc2ArtifactPagination.page} of {soc2ArtifactPagination.total_pages} ({soc2ArtifactPagination.total} total)
            </span>
            <button
              type="button"
              disabled={soc2ArtifactPagination.page >= soc2ArtifactPagination.total_pages}
              onClick={() => loadSoc2Artifacts(Math.min(soc2ArtifactPagination.total_pages, soc2ArtifactPagination.page + 1))}
            >
              Next
            </button>
          </div>
        </article>

        <article className="admin-compliance-card">
          <h2>{t('admin_compliance.recent_events')}</h2>
          <div className="admin-compliance-table-wrap">
            <table className="admin-compliance-table">
              <thead>
                <tr>
                  <th>{t('admin_compliance.time')}</th>
                  <th>{t('admin_compliance.type')}</th>
                  <th>{t('admin_compliance.severity')}</th>
                  <th>{t('admin_compliance.user')}</th>
                  <th>{t('admin_compliance.ip')}</th>
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
                    <td colSpan={5}>{t('admin_compliance.no_events')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-compliance-card">
          <h2>{t('admin_compliance.deletion_requests')}</h2>
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
