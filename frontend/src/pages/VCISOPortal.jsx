import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import DashboardTabsNav from '../components/DashboardTabsNav';
import { normalizePlan } from '../utils/planTier';
import './VCISOPortal.css';

const PLAN_ORDER = ['free', 'starter', 'compliance_pro', 'enterprise_professional', 'enterprise_risk', 'enterprise_elite'];
const canAccessVCISO = (plan) => PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf('enterprise_elite');

const PRIORITY_COLORS = { critical: '#FF5C5C', high: '#FFB84D', medium: '#00C2E0', low: '#6E8499' };
const TYPE_ICONS = { recommendation: '💡', action: '🎯', checklist: '📋', advisory: '📝', alert: '🚨' };

// Sample vCISO notes for demo — in production these come from the backend
const DEMO_NOTES = [
  {
    id: 'v1', type: 'action', priority: 'critical',
    title: 'Patch CVE-2025-4421 — Critical .NET Vulnerability',
    body: 'This vulnerability affects your current .NET runtime and allows remote code execution. Patch immediately — this falls within your NIS2 72-hour remediation window. I\'ve added a full remediation checklist below.',
    checklist: ['Download .NET 9.0.6 patch from Microsoft', 'Test in staging environment first', 'Deploy to production during maintenance window', 'Verify patch with vulnerability scanner', 'Document remediation for NIS2 audit trail'],
    author: 'Gabriel Aloho', role: 'vCISO · Gue Cyber', date: '2026-06-22T09:14:00Z',
    due: '2026-06-27', status: 'open',
  },
  {
    id: 'v2', type: 'recommendation', priority: 'high',
    title: 'Enable MFA on All Admin Accounts',
    body: 'Your M365 tenant audit shows 3 admin accounts without MFA enabled. This is a NIS2 Art. 21(2)(h) requirement and a GDPR Art. 32 technical measure. This should be remediated within 2 weeks.',
    checklist: null,
    author: 'Gabriel Aloho', role: 'vCISO · Gue Cyber', date: '2026-06-20T14:30:00Z',
    due: '2026-07-04', status: 'open',
  },
  {
    id: 'v3', type: 'checklist', priority: 'medium',
    title: 'Monthly NIS2 Art. 21 Review — June 2026',
    body: 'Your monthly NIS2 posture review. Overall score: 78/100. Two areas need attention this month: incident response plan needs one update (see Compliance tab) and supply chain security documentation is incomplete.',
    checklist: ['Update incident response plan — Section 4.2', 'Request security questionnaires from top 3 suppliers', 'Complete NIS2 Art. 21(2)(d) supply chain section'],
    author: 'Gabriel Aloho', role: 'vCISO · Gue Cyber', date: '2026-06-18T10:00:00Z',
    due: '2026-06-30', status: 'in_progress',
  },
  {
    id: 'v4', type: 'advisory', priority: 'low',
    title: 'Q3 2026 Security Roadmap',
    body: 'Based on your current posture and NIS2 obligations, here is my recommended focus for Q3 2026. Priority areas: complete supply chain risk assessment, implement automated vulnerability scanning, and prepare for potential CCN audit.',
    checklist: null,
    author: 'Gabriel Aloho', role: 'vCISO · Gue Cyber', date: '2026-06-15T08:00:00Z',
    due: null, status: 'informational',
  },
];

function NoteCard({ note, onCheckItem }) {
  const [expanded, setExpanded] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});

  const handleCheck = (idx) => {
    const next = { ...checkedItems, [idx]: !checkedItems[idx] };
    setCheckedItems(next);
  };

  const daysUntilDue = note.due
    ? Math.ceil((new Date(note.due) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <article className={`vp__note vp__note--${note.priority}`}>
      <div className="vp__note-head">
        <div className="vp__note-meta">
          <span className="vp__note-icon">{TYPE_ICONS[note.type] || '📝'}</span>
          <span className={`vp__note-priority vp__note-priority--${note.priority}`}>{note.priority.toUpperCase()}</span>
          <span className="vp__note-type">{note.type}</span>
          {note.status !== 'informational' && (
            <span className={`vp__note-status vp__note-status--${note.status}`}>
              {note.status === 'open' ? 'Open' : note.status === 'in_progress' ? 'In Progress' : 'Done'}
            </span>
          )}
        </div>
        {daysUntilDue !== null && (
          <span className={`vp__note-due ${daysUntilDue <= 3 ? 'vp__note-due--urgent' : ''}`}>
            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`}
          </span>
        )}
      </div>

      <h3 className="vp__note-title">{note.title}</h3>
      <p className="vp__note-body">{note.body}</p>

      {note.checklist && (
        <div className="vp__note-checklist">
          {(expanded ? note.checklist : note.checklist.slice(0, 2)).map((item, i) => (
            <div key={i} className={`vp__cl-item ${checkedItems[i] ? 'vp__cl-item--done' : ''}`}>
              <button className="vp__cl-btn" onClick={() => handleCheck(i)}>
                {checkedItems[i] ? '✓' : '○'}
              </button>
              <span>{item}</span>
            </div>
          ))}
          {note.checklist.length > 2 && (
            <button className="vp__expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? '▲ Show less' : `▼ Show ${note.checklist.length - 2} more items`}
            </button>
          )}
        </div>
      )}

      <div className="vp__note-footer">
        <div className="vp__note-author">
          <div className="vp__author-avatar">GA</div>
          <div>
            <p className="vp__author-name">{note.author}</p>
            <p className="vp__author-role">{note.role}</p>
          </div>
        </div>
        <span className="vp__note-date">{new Date(note.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
      </div>
    </article>
  );
}

export default function VCISOPortal() {
  const { user } = useContext(AuthContext);
  const userPlan = normalizePlan(user?.current_plan || user?.plan || user?.subscription?.plan || 'free');
  const hasAccess = canAccessVCISO(userPlan);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!hasAccess) return;
    setLoading(true);
    // Try to fetch from backend; fall back to demo notes
    api.get('/api/vciso/notes')
      .then(r => {
        const fetched = Array.isArray(r.data?.notes) ? r.data.notes : [];
        setNotes(fetched.length > 0 ? fetched : DEMO_NOTES);
      })
      .catch(() => setNotes(DEMO_NOTES))
      .finally(() => setLoading(false));
  }, [hasAccess]);

  const filtered = filter === 'all' ? notes : notes.filter(n => n.status === filter || n.priority === filter || n.type === filter);

  if (!hasAccess) {
    return (
      <div className="vp">
        <DashboardTabsNav />

        <div className="vp__locked">
          <div className="vp__locked-icon">🛡️</div>
          <h2>vCISO Portal</h2>
          <p>The vCISO Portal is available on <strong>Enterprise Elite</strong>. Your assigned virtual CISO — Gabriel Aloho (Gue Cyber) — posts personalised security recommendations, action items, NIS2 remediation checklists, and monthly advisory notes directly to your dashboard.</p>
          <div className="vp__locked-features">
            {['Personalised security recommendations', 'Action items with priority & deadlines', 'NIS2 remediation checklists', 'Monthly vCISO review summaries', 'Direct Gue Cyber expertise'].map(f => (
              <div key={f} className="vp__locked-feature">✦ {f}</div>
            ))}
          </div>
          <div className="vp__locked-actions">
            <Link to="/subscription" className="vp__btn vp__btn--primary">Upgrade to Enterprise Elite</Link>
            <Link to="/support" className="vp__btn vp__btn--ghost">Talk to Gue Cyber</Link>
          </div>
          <div className="vp__locked-preview">
            <p className="vp__preview-label">// Preview — what you'll see inside</p>
            <NoteCard note={DEMO_NOTES[0]} />
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="vp">
      <DashboardTabsNav />

      <div className="vp__header">
        <div>
          <p className="vp__eyebrow">// Enterprise Elite · vCISO Portal</p>
          <h2>Virtual CISO Dashboard</h2>
          <p className="vp__lead">Personalised security guidance from Gabriel Aloho · Gue Cyber</p>
        </div>
        <div className="vp__vciso-tag">
          <div className="vp__vciso-avatar">GA</div>
          <div>
            <p className="vp__vciso-name">Gabriel Aloho</p>
            <p className="vp__vciso-role">vCISO · Gue Cyber · MSc InfoSec</p>
          </div>
          <span className="vp__live-badge">LIVE</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="vp__stats">
        {[
          { label: 'Open Actions', value: notes.filter(n=>n.status==='open').length, color: '#FF5C5C' },
          { label: 'In Progress',  value: notes.filter(n=>n.status==='in_progress').length, color: '#FFB84D' },
          { label: 'Critical',     value: notes.filter(n=>n.priority==='critical').length, color: '#FF5C5C' },
          { label: 'Total Notes',  value: notes.length, color: '#00C2E0' },
        ].map(s => (
          <div key={s.label} className="vp__stat">
            <span className="vp__stat-val" style={{color: s.color}}>{s.value}</span>
            <span className="vp__stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="vp__filters">
        {['all','open','in_progress','critical','high','recommendation','action'].map(f => (
          <button
            key={f}
            className={`vp__filter ${filter === f ? 'vp__filter--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="vp__loading">Loading vCISO notes…</p>}
      {!loading && filtered.length === 0 && (
        <p className="vp__empty">No notes match this filter.</p>
      )}
      <div className="vp__notes">
        {filtered.map(note => <NoteCard key={note.id} note={note} />)}
      </div>

      <div className="vp__contact">
        <p>Need to reach your vCISO directly?</p>
        <Link to="/support" className="vp__btn vp__btn--ghost">📩 Message Gue Cyber</Link>
      </div>
    </div>
  );
}
