import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './ComplianceDashboard.css';

const PLAN_ORDER = ['starter', 'compliance_pro', 'enterprise_risk', 'enterprise_elite'];

const NIS2_CHECKLIST = [
  { id: 'nis2_1', article: 'Art. 21(2)(a)', title: 'Risk analysis & information system security policies', tier: 'enterprise_risk' },
  { id: 'nis2_2', article: 'Art. 21(2)(b)', title: 'Incident handling procedures', tier: 'enterprise_risk' },
  { id: 'nis2_3', article: 'Art. 21(2)(c)', title: 'Business continuity & crisis management', tier: 'enterprise_risk' },
  { id: 'nis2_4', article: 'Art. 21(2)(d)', title: 'Supply chain security', tier: 'enterprise_risk' },
  { id: 'nis2_5', article: 'Art. 21(2)(e)', title: 'Security in network & information systems acquisition', tier: 'enterprise_risk' },
  { id: 'nis2_6', article: 'Art. 21(2)(f)', title: 'Cybersecurity training & awareness', tier: 'enterprise_risk' },
  { id: 'nis2_7', article: 'Art. 21(2)(g)', title: 'Cryptography & encryption policies', tier: 'enterprise_risk' },
  { id: 'nis2_8', article: 'Art. 21(2)(h)', title: 'Human resources security & access control', tier: 'enterprise_risk' },
  { id: 'nis2_9', article: 'Art. 23',        title: 'Incident reporting — 24h early warning to CCN', tier: 'enterprise_risk' },
  { id: 'nis2_10', article: 'Art. 23',       title: 'Incident reporting — 72h full notification', tier: 'enterprise_risk' },
];

const GDPR_CHECKLIST = [
  { id: 'gdpr_1', article: 'Art. 5',  title: 'Data processing principles documented', tier: 'compliance_pro' },
  { id: 'gdpr_2', article: 'Art. 13', title: 'Privacy notices in place', tier: 'compliance_pro' },
  { id: 'gdpr_3', article: 'Art. 17', title: 'Data deletion / right to erasure workflow', tier: 'compliance_pro' },
  { id: 'gdpr_4', article: 'Art. 20', title: 'Data portability / export available', tier: 'compliance_pro' },
  { id: 'gdpr_5', article: 'Art. 30', title: 'Records of processing activities (ROPA)', tier: 'compliance_pro' },
  { id: 'gdpr_6', article: 'Art. 32', title: 'Technical & organisational security measures', tier: 'compliance_pro' },
  { id: 'gdpr_7', article: 'Art. 33', title: 'Data breach notification to authority — 72h', tier: 'compliance_pro' },
  { id: 'gdpr_8', article: 'Art. 37', title: 'Data Protection Officer (DPO) appointed if required', tier: 'compliance_pro' },
];

const TIER_LABELS = {
  starter: 'Starter',
  compliance_pro: 'Compliance Pro',
  enterprise_risk: 'Enterprise Risk',
  enterprise_elite: 'Enterprise Elite',
};

function planMeetsRequirement(userPlan, requiredTier) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredTier);
}

function ComplianceScore({ checked, total, label }) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
  const color = pct >= 80 ? '#00E5A0' : pct >= 50 ? '#FFB84D' : '#FF5C5C';
  return (
    <div className="cd__score-card">
      <svg className="cd__score-ring" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(0,194,224,0.1)" strokeWidth="5" />
        <circle
          cx="28" cy="28" r="24" fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${2 * Math.PI * 24}`}
          strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="800" fill={color} fontFamily="Syne,sans-serif">{pct}%</text>
      </svg>
      <div>
        <p className="cd__score-label">{label}</p>
        <p className="cd__score-sub">{checked} / {total} items complete</p>
      </div>
    </div>
  );
}

function ChecklistItem({ item, checked, onChange, locked }) {
  return (
    <div className={`cd__check-item ${locked ? 'cd__check-item--locked' : ''} ${checked ? 'cd__check-item--done' : ''}`}>
      <button
        className="cd__check-btn"
        onClick={() => !locked && onChange(item.id, !checked)}
        disabled={locked}
        aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
      >
        {locked ? '🔒' : checked ? '✓' : '○'}
      </button>
      <div className="cd__check-body">
        <span className="cd__check-article">{item.article}</span>
        <span className="cd__check-title">{item.title}</span>
      </div>
      {locked && (
        <Link to="/subscription" className="cd__check-upgrade">
          Upgrade to {TIER_LABELS[item.tier]}
        </Link>
      )}
    </div>
  );
}

export default function ComplianceDashboard() {
  const { user } = useContext(AuthContext);
  const userPlan = user?.plan || user?.subscription?.plan || 'starter';

  const [nis2Checks, setNis2Checks]   = useState({});
  const [gdprChecks, setGdprChecks]   = useState({});
  const [incidents, setIncidents]      = useState([]);
  const [loadingInc, setLoadingInc]   = useState(false);
  const [activeTab, setActiveTab]      = useState('nis2');

  // Load saved checks from localStorage (no backend needed for checklist state)
  useEffect(() => {
    const saved = localStorage.getItem(`gi_compliance_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNis2Checks(parsed.nis2 || {});
        setGdprChecks(parsed.gdpr || {});
      } catch {}
    }
  }, [user?.id]);

  const saveChecks = (nis2, gdpr) => {
    localStorage.setItem(`gi_compliance_${user?.id}`, JSON.stringify({ nis2, gdpr }));
  };

  const handleNis2Change = (id, val) => {
    const next = { ...nis2Checks, [id]: val };
    setNis2Checks(next);
    saveChecks(next, gdprChecks);
  };
  const handleGdprChange = (id, val) => {
    const next = { ...gdprChecks, [id]: val };
    setGdprChecks(next);
    saveChecks(nis2Checks, next);
  };

  // Load incidents if plan allows
  useEffect(() => {
    if (!planMeetsRequirement(userPlan, 'enterprise_risk')) return;
    setLoadingInc(true);
    api.get('/admin/security_events?limit=20')
      .then(r => setIncidents(Array.isArray(r.data?.security_events) ? r.data.security_events : []))
      .catch(() => setIncidents([]))
      .finally(() => setLoadingInc(false));
  }, [userPlan]);

  const nis2Done  = NIS2_CHECKLIST.filter(i => nis2Checks[i.id]).length;
  const gdprDone  = GDPR_CHECKLIST.filter(i => gdprChecks[i.id]).length;
  const totalDone = nis2Done + gdprDone;
  const totalAll  = NIS2_CHECKLIST.length + GDPR_CHECKLIST.length;

  const canGdpr = planMeetsRequirement(userPlan, 'compliance_pro');
  const canNis2 = planMeetsRequirement(userPlan, 'enterprise_risk');

  return (
    <div className="cd">
      {/* Header */}
      <div className="cd__header">
        <div>
          <p className="cd__eyebrow">// Compliance Dashboard</p>
          <h2>NIS2 &amp; GDPR Compliance</h2>
          <p className="cd__lead">Track your compliance posture, manage checklists, and report incidents.</p>
        </div>
        <div className="cd__scores">
          <ComplianceScore checked={totalDone} total={totalAll} label="Overall Score" />
          <ComplianceScore checked={nis2Done}  total={NIS2_CHECKLIST.length} label="NIS2 Score" />
          <ComplianceScore checked={gdprDone}  total={GDPR_CHECKLIST.length} label="GDPR Score" />
        </div>
      </div>

      {/* Tabs */}
      <div className="cd__tabs">
        {['nis2','gdpr','incidents'].map(tab => (
          <button
            key={tab}
            className={`cd__tab ${activeTab === tab ? 'cd__tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'nis2' ? '📋 NIS2 Checklist' : tab === 'gdpr' ? '🔐 GDPR Checklist' : '🚨 Incidents'}
            {!canNis2 && tab === 'nis2' && <span className="cd__tab-lock">🔒</span>}
            {!canGdpr && tab === 'gdpr' && <span className="cd__tab-lock">🔒</span>}
            {!canNis2 && tab === 'incidents' && <span className="cd__tab-lock">🔒</span>}
          </button>
        ))}
      </div>

      {/* NIS2 TAB */}
      {activeTab === 'nis2' && (
        <div className="cd__panel">
          {!canNis2 && (
            <div className="cd__upgrade-banner">
              <div>
                <strong>NIS2 compliance tools require Enterprise Risk or Elite.</strong>
                <p>Upgrade to access NIS2 checklists, gap analysis, incident reporting, and audit evidence packs.</p>
              </div>
              <Link to="/subscription" className="cd__upgrade-btn">Upgrade Plan →</Link>
            </div>
          )}
          <div className="cd__checklist">
            {NIS2_CHECKLIST.map(item => (
              <ChecklistItem
                key={item.id}
                item={item}
                checked={!!nis2Checks[item.id]}
                onChange={handleNis2Change}
                locked={!canNis2}
              />
            ))}
          </div>
          {canNis2 && (
            <div className="cd__actions">
              <Link to="/support" className="cd__action-btn">📄 Download NIS2 Evidence Pack</Link>
              <Link to="/support" className="cd__action-btn cd__action-btn--secondary">🚨 Report NIS2 Incident</Link>
            </div>
          )}
        </div>
      )}

      {/* GDPR TAB */}
      {activeTab === 'gdpr' && (
        <div className="cd__panel">
          {!canGdpr && (
            <div className="cd__upgrade-banner">
              <div>
                <strong>GDPR tools require Compliance Pro or higher.</strong>
                <p>Upgrade to access GDPR checklists, data export/deletion workflows, and audit logging.</p>
              </div>
              <Link to="/subscription" className="cd__upgrade-btn">Upgrade Plan →</Link>
            </div>
          )}
          <div className="cd__checklist">
            {GDPR_CHECKLIST.map(item => (
              <ChecklistItem
                key={item.id}
                item={item}
                checked={!!gdprChecks[item.id]}
                onChange={handleGdprChange}
                locked={!canGdpr}
              />
            ))}
          </div>
          {canGdpr && (
            <div className="cd__actions">
              <Link to="/profile" className="cd__action-btn">📤 Submit Data Export Request</Link>
              <Link to="/profile" className="cd__action-btn cd__action-btn--secondary">🗑️ Submit Deletion Request</Link>
            </div>
          )}
        </div>
      )}

      {/* INCIDENTS TAB */}
      {activeTab === 'incidents' && (
        <div className="cd__panel">
          {!canNis2 && (
            <div className="cd__upgrade-banner">
              <div>
                <strong>Incident management requires Enterprise Risk or Elite.</strong>
                <p>Upgrade to access security event tracking, NIS2 incident reporting, and PDF export.</p>
              </div>
              <Link to="/subscription" className="cd__upgrade-btn">Upgrade Plan →</Link>
            </div>
          )}
          {canNis2 && (
            <>
              {loadingInc && <p className="cd__loading">Loading security events…</p>}
              {!loadingInc && incidents.length === 0 && (
                <p className="cd__empty">No security events recorded. Your posture looks clean.</p>
              )}
              <div className="cd__incidents">
                {incidents.map((ev, i) => (
                  <div key={i} className={`cd__incident cd__incident--${String(ev.severity || 'info').toLowerCase()}`}>
                    <div className="cd__incident-head">
                      <span className={`cd__sev cd__sev--${String(ev.severity || 'info').toLowerCase()}`}>{ev.severity || 'INFO'}</span>
                      <span className="cd__incident-time">{ev.created_at ? new Date(ev.created_at).toLocaleString() : 'N/A'}</span>
                    </div>
                    <p className="cd__incident-title">{ev.event_type || ev.title || 'Security Event'}</p>
                    <p className="cd__incident-desc">{ev.description || ev.detail || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="cd__actions">
                <Link to="/support" className="cd__action-btn">🚨 File NIS2 Incident Report</Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
