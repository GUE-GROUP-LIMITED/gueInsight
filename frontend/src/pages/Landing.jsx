import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import TrialModal from '../components/TrialModal';
import PlanSelector from '../components/PlanSelector';
import PublicHeader from '../components/PublicHeader';
import './Landing.css';
import { api } from '../services/api';

const FEATURES = [
  { icon: '🛡️', title: 'vCISO Portal', desc: 'Your assigned virtual CISO posts recommendations, action items and security notes directly to your dashboard — included in Enterprise plans.' },
  { icon: '📋', title: 'NIS2 Compliance', desc: 'Built-in NIS2 checklist, gap analysis, incident reporting with PDF export, and audit-ready evidence packs for Belgian regulators.' },
  { icon: '🔍', title: 'AI-Assisted Threat Intelligence', desc: 'Upload files, paste indicators or connect M365 / Google Workspace — automated IoC extraction, scoring, enrichment and faster triage in seconds.' },
  { icon: '📊', title: 'GDPR Tooling', desc: 'Data export, deletion requests, audit logging (90 days → unlimited) and data-subject request workflows built into every paid tier.' },
  { icon: '🔗', title: 'Cloud Connectors', desc: 'Microsoft 365 and Google Workspace integrations for user, device and policy discovery — spot GDPR and NIS2 gaps across your tenant.' },
  { icon: '🚨', title: 'Proactive Security Operations', desc: 'Custom alert rules, Slack / Teams notifications and weekly security summaries that help your team act before issues spread.' },
];

const TIERS = [
  {
    id: 'starter', name: 'Starter', price: '€0', period: 'Free forever',
    desc: 'Basic threat detection for individuals',
    items: ['Manual file / text analysis', 'Basic threat scoring', 'Email alerts', '2 MB file limit', '30-day log retention'],
    cta: 'Get Started Free', ctaPath: '/signup', ghost: true,
    badges: [],
  },
  {
    id: 'compliance_pro', name: 'Compliance Pro', price: '€29.90', period: '/month',
    desc: 'GDPR-focused threat detection with audit trails',
    items: ['All Starter features', 'GDPR export & deletion', 'Audit logging — 90 days', 'M365 basic integration', 'Email + Slack alerts', '8 MB file limit'],
    cta: 'Start 14-Day Trial', ctaPath: '/signup',
    badges: ['GDPR', 'M365'],
    highlighted: false,
  },
  {
    id: 'enterprise_risk', name: 'Enterprise Risk', price: '€499', period: '/month',
    desc: 'NIS2 + ISO 27001 critical infrastructure risk management',
    items: ['All Compliance Pro features', 'NIS2 incident reporting + PDF', 'Full M365 + Google Workspace', 'Privilege escalation detection', 'Device compliance monitoring', '1-year audit logging', 'Custom alert rules'],
    cta: 'Start 14-Day Trial', ctaPath: '/signup',
    badges: ['GDPR', 'NIS2', 'M365', 'GWS'],
    highlighted: true,
  },
  {
    id: 'enterprise_elite', name: 'Enterprise Elite', price: 'Custom', period: '',
    desc: 'vCISO portal + EU-only residency + unlimited scale',
    items: ['All Enterprise Risk features', '✦ vCISO Portal — expert notes & actions', 'EU-only data residency', 'Unlimited file size & retention', 'Priority incident response', 'Dedicated Gue Cyber support'],
    cta: 'Contact Sales', ctaPath: '/support',
    badges: ['GDPR', 'NIS2', 'M365', 'GWS', 'EU-Only', 'vCISO'],
    ghost: false, elite: true,
  },
];

const STEPS = [
  { n: '01', title: 'Sign up & choose a plan', desc: 'Start free or select a paid tier. Paid plans include a 14-day trial — your card is validated but not charged until the trial ends.' },
  { n: '02', title: 'Connect your environment', desc: 'Link Microsoft 365, Google Workspace or upload files directly. Your data stays in the EU.' },
  { n: '03', title: 'Get instant intelligence', desc: 'Automated IoC extraction, threat scoring and compliance gap analysis start immediately.' },
  { n: '04', title: 'Act on vCISO guidance', desc: 'Enterprise Elite subscribers receive expert recommendations, action items and notes posted directly to their dashboard by Gue Cyber.' },
];

const FAQS = [
  { q: 'Do I need to give a payment card to try it?', a: 'Yes — we require a payment method at trial sign-up. The card is validated but you will not be charged until the 14-day trial ends, unless you keep the subscription.' },
  { q: 'What is the vCISO Portal?', a: 'Enterprise Elite subscribers get a dedicated section on their dashboard where Gabriel Aloho (Gue Cyber founder) or an assigned vCISO posts security recommendations, action items, and advisory notes directly to your account.' },
  { q: 'Is my data stored in the EU?', a: 'Yes. All data is processed and stored in the EU. Enterprise Elite adds an EU-only data residency guarantee with contractual commitments.' },
  { q: 'Will you delete our data if requested?', a: 'Yes. Compliance Pro and above include GDPR export and deletion features for data-subject requests, with full audit logging.' },
  { q: 'Is GueInsight NIS2 compliant?', a: 'Enterprise Risk and Elite tiers include NIS2 incident reporting, gap analysis, evidence packs and audit logging designed to support NIS2 compliance workflows for Belgian and EU organisations.' },
];

const CAPABILITIES = [
  {
    title: 'Analyze threats fast',
    desc: 'Upload files, paste indicators, or scan URLs to extract IoCs, score risk, and enrich findings in seconds.',
  },
  {
    title: 'Stay GDPR and NIS2 ready',
    desc: 'Use built-in export, deletion, incident reporting, and audit evidence workflows designed for Belgian and EU teams.',
  },
  {
    title: 'Connect your cloud stack',
    desc: 'Link Microsoft 365 or Google Workspace to discover users, devices, policies, and compliance gaps across the tenant.',
  },
  {
    title: 'Get vCISO guidance',
    desc: 'Enterprise Elite adds expert recommendations, action items, and monthly advisory notes directly in the dashboard.',
  },
  {
    title: 'Use AI for triage and next steps',
    desc: 'Summarize security events, cluster related alerts, and turn signals into practical remediation guidance faster.',
  },
];

const LIVE_ALERT_CLASS_MAP = {
  HIGH: 'lp__mock-alert--high',
  MED: 'lp__mock-alert--med',
  OK: 'lp__mock-alert--ok',
};

const LIVE_DOT_CLASS_MAP = {
  HIGH: 'lp__mock-adot',
  MED: 'lp__mock-adot lp__mock-adot--med',
  OK: 'lp__mock-adot lp__mock-adot--ok',
};

const LIVE_BADGE_CLASS_MAP = {
  HIGH: 'lp__mock-badge lp__mock-badge--high',
  MED: 'lp__mock-badge lp__mock-badge--med',
  OK: 'lp__mock-badge lp__mock-badge--ok',
};

const FALLBACK_HERO_STATE = {
  securityScore: 78,
  activeAlerts: 3,
  updatedAt: new Date().toISOString(),
  alerts: [
    { id: 'fallback-1', title: 'Phishing campaign targeting your domain', severity: 'HIGH' },
    { id: 'fallback-2', title: 'CVE-2025-4421 - critical patch missing', severity: 'HIGH' },
    { id: 'fallback-3', title: 'Suspicious login - unusual geography', severity: 'MED' },
    { id: 'fallback-4', title: 'Firewall rules - all checks passed', severity: 'OK' },
  ],
  vcisoNote: {
    authorName: 'Gabriel Aloho',
    note: "Patch CVE-2025-4421 this week. I've added a full remediation checklist under the Compliance tab.",
  },
};

function getRelativeUpdateLabel(isoDate) {
  if (!isoDate) {
    return 'Updated now';
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Updated now';
  }

  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs < 60_000) {
    return 'Updated just now';
  }
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export default function Landing() {
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [heroSnapshot, setHeroSnapshot] = useState(FALLBACK_HERO_STATE);

  useEffect(() => {
    let isMounted = true;
    let pollIntervalId = null;
    let eventSource = null;
    let fallbackPollingStarted = false;

    const applySnapshot = (data) => {
      const normalizedAlerts = Array.isArray(data.alerts)
        ? data.alerts.slice(0, 4).map((alert, index) => {
            const severity = String(alert?.severity || 'OK').toUpperCase();
            return {
              id: alert?.id || `live-${index}`,
              title: String(alert?.title || 'Platform security event processed'),
              severity: ['HIGH', 'MED', 'OK'].includes(severity) ? severity : 'OK',
            };
          })
        : FALLBACK_HERO_STATE.alerts;

      return {
        securityScore: Number.isFinite(Number(data.security_score))
          ? Math.max(0, Math.min(99, Number(data.security_score)))
          : FALLBACK_HERO_STATE.securityScore,
        activeAlerts: Number.isFinite(Number(data.active_alerts)) ? Number(data.active_alerts) : 0,
        updatedAt: data.updated_at || new Date().toISOString(),
        alerts: normalizedAlerts,
        vcisoNote: {
          authorName: data?.vciso_note?.author_name || 'Gue Cyber vCISO Team',
          note: data?.vciso_note?.note || FALLBACK_HERO_STATE.vcisoNote.note,
        },
      };
    };

    const loadLandingSnapshot = async () => {
      try {
        const response = await api.get('/api/public/landing-snapshot');
        if (isMounted) {
          setHeroSnapshot(applySnapshot(response?.data || {}));
        }
      } catch {
        if (isMounted) {
          setHeroSnapshot((prev) => prev || FALLBACK_HERO_STATE);
        }
      }
    };

    const startFallbackPolling = () => {
      if (fallbackPollingStarted) {
        return;
      }
      fallbackPollingStarted = true;
      loadLandingSnapshot();
      pollIntervalId = setInterval(loadLandingSnapshot, 30_000);
    };

    const sseBase = (api?.defaults?.baseURL || '').replace(/\/$/, '');
    const sseUrl = sseBase
      ? `${sseBase}/api/public/landing-snapshot/stream`
      : '/api/public/landing-snapshot/stream';

    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });
      eventSource.addEventListener('snapshot', (event) => {
        if (!isMounted) {
          return;
        }
        try {
          const payload = JSON.parse(event.data);
          setHeroSnapshot(applySnapshot(payload));
        } catch {
          // Ignore malformed stream events and keep the latest valid snapshot.
        }
      });
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }

    // Keep a quick baseline value in case stream connection is delayed.
    loadLandingSnapshot();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    };
  }, []);

  const scoreUpdateLabel = useMemo(
    () => getRelativeUpdateLabel(heroSnapshot.updatedAt),
    [heroSnapshot.updatedAt]
  );

  return (
    <div className="lp">
      <div className="lp__ambient" aria-hidden="true" />

      {/* UTILITY BAR */}
      <div className="lp__utility">
        <span>🇧🇪 A <a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a> product · Registered Belgian Enterprise</span>
        <Link to="/support">Need urgent support?</Link>
      </div>

      <PublicHeader
        featureTo="#features"
        howTo="#how"
        whoTo="#who"
        pricingTo="#pricing"
        loginTo="/login"
        trialTo="/signup"
      />

      {/* HERO */}
      <section className="lp__hero">
        <div className="lp__hero-left">
          <p className="lp__eyebrow">GueInsight — Threat Intelligence, Compliance &amp; vCISO in one platform</p>
          <h1>Your Security Dashboard.<br /><em>Expert-Backed.</em></h1>
          <p className="lp__lead">
            GueInsight gives Belgian and European organisations real-time threat intelligence, AI-assisted triage, NIS2 &amp; GDPR compliance tools, and — on Enterprise Elite — a <strong>virtual CISO portal</strong> where Gue Cyber experts post recommendations directly to your dashboard.
          </p>
          <div className="lp__capability-summary" aria-label="Platform capabilities">
            <span>Analyze threats</span>
            <span>Manage compliance</span>
            <span>Connect cloud systems</span>
            <span>Work with a vCISO</span>
            <span>Use AI-assisted triage</span>
          </div>
          <div className="lp__hero-actions">
            <button className="lp__btn lp__btn--primary" onClick={() => setShowPlanSelector(true)}>
              Start 14-Day Free Trial
            </button>
            <Link to="/subscription" className="lp__btn lp__btn--ghost">View Plans →</Link>
          </div>
          <div className="lp__trust-row">
            <span>⚡ Fast IoC extraction</span>
            <span>📋 NIS2 &amp; GDPR ready</span>
            <span>🛡️ vCISO guidance</span>
            <span>🇪🇺 EU data residency</span>
          </div>
        </div>

        <div className="lp__hero-panel">
          {/* live-style dashboard mockup */}
          <div className="lp__mock-bar">
            <span className="lp__mock-dot" style={{background:'#FF5F57'}}/>
            <span className="lp__mock-dot" style={{background:'#FFBD2E'}}/>
            <span className="lp__mock-dot" style={{background:'#28CA41'}}/>
            <span className="lp__mock-url">insights.guecyber.com · Dashboard</span>
          </div>
          <div className="lp__mock-body">
            <div className="lp__mock-tabs">
              <span className="lp__mock-tab lp__mock-tab--active">Threat Intel</span>
              <span className="lp__mock-tab">Compliance</span>
              <span className="lp__mock-tab">vCISO</span>
            </div>
            <div className="lp__mock-score-row">
              <div className="lp__mock-ring" style={{ '--ring-fill': heroSnapshot.securityScore }}>
                <span>{heroSnapshot.securityScore}</span>
              </div>
              <div>
                <p className="lp__mock-score-label">Security Score</p>
                <p className="lp__mock-score-sub">{heroSnapshot.activeAlerts} active alerts · {scoreUpdateLabel}</p>
              </div>
            </div>
            <div className="lp__mock-alerts">
              {heroSnapshot.alerts.map((alert) => (
                <div
                  className={`lp__mock-alert ${LIVE_ALERT_CLASS_MAP[alert.severity] || LIVE_ALERT_CLASS_MAP.OK}`}
                  key={alert.id}
                >
                  <span className={LIVE_DOT_CLASS_MAP[alert.severity] || LIVE_DOT_CLASS_MAP.OK} />
                  <span>{alert.title}</span>
                  <span className={LIVE_BADGE_CLASS_MAP[alert.severity] || LIVE_BADGE_CLASS_MAP.OK}>{alert.severity}</span>
                </div>
              ))}
            </div>
            <div className="lp__mock-vciso">
              <p className="lp__mock-vciso-label">💬 vCISO Note — {heroSnapshot.vcisoNote.authorName}</p>
              <p className="lp__mock-vciso-text">"{heroSnapshot.vcisoNote.note}"</p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="lp__section lp__section--capabilities" id="capabilities">
        <div className="lp__section-head lp__section-head--compact">
          <p className="lp__eyebrow">// Core capabilities</p>
          <h2>What the platform lets you do</h2>
          <p className="lp__section-sub">Five actions cover most teams’ day-to-day needs: detect, comply, connect, get expert guidance, and accelerate triage with AI-assisted security ops.</p>
        </div>
        <div className="lp__capabilities-grid">
          {CAPABILITIES.map((capability, index) => (
            <article className="lp__capability-card" key={capability.title}>
              <div className="lp__capability-index">0{index + 1}</div>
              <h3>{capability.title}</h3>
              <p>{capability.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* NIS2 BANNER */}
      <div className="lp__nis2-banner">
        <div>
          <strong>⚠️ NIS2 is now enforced in Belgium.</strong>{' '}
          Organisations in critical sectors face fines up to <strong>€10 million</strong> for non-compliance. GueInsight's Enterprise Risk and Elite tiers include full NIS2 incident reporting, gap analysis, and audit evidence.
        </div>
        <Link to="/subscription" className="lp__btn lp__btn--nis2">See NIS2 Plans →</Link>
      </div>

      {/* FEATURES GRID */}
      <section className="lp__section" id="features">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// What you get</p>
          <h2>Everything Your Organisation Needs<br />In One Dashboard</h2>
          <p className="lp__section-sub">From real-time threat intelligence to NIS2 compliance and virtual CISO guidance — all subscription-gated and ready to use.</p>
        </div>
        <div className="lp__features-grid">
          {FEATURES.map(f => (
            <article className="lp__feature-card" key={f.title}>
              <div className="lp__feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp__section lp__section--alt" id="how">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// Getting started</p>
          <h2>Up and Running in Minutes</h2>
        </div>
        <div className="lp__steps">
          {STEPS.map(s => (
            <div className="lp__step" key={s.n}>
              <div className="lp__step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VCISO HIGHLIGHT */}
      <section className="lp__vciso-section">
        <div className="lp__vciso-left">
          <p className="lp__eyebrow">// Enterprise Elite exclusive</p>
          <h2>Your Virtual CISO.<br />Right Inside Your Dashboard.</h2>
          <p>Most cybersecurity tools give you data. GueInsight Enterprise Elite gives you an <strong>expert</strong>. Gabriel Aloho — founder of Gue Cyber, MSc in Information Security &amp; Digital Forensics — posts personalised security recommendations, action items, and advisory notes directly to your dashboard.</p>
          <ul className="lp__vciso-list">
            <li>✦ Personalised security recommendations</li>
            <li>✦ Action items with priority and deadlines</li>
            <li>✦ NIS2 remediation checklists</li>
            <li>✦ Monthly vCISO review summaries</li>
            <li>✦ Direct line to Gue Cyber expertise</li>
          </ul>
          <div className="lp__hero-actions" style={{marginTop:'28px'}}>
            <Link to="/support" className="lp__btn lp__btn--primary">Talk to Gue Cyber</Link>
            <Link to="/subscription" className="lp__btn lp__btn--ghost">See Elite Plan →</Link>
          </div>
        </div>
        <div className="lp__vciso-right">
          <div className="lp__vciso-card">
            <div className="lp__vciso-card-head">
              <div className="lp__vciso-avatar">GA</div>
              <div>
                <p className="lp__vciso-name">Gabriel Aloho</p>
                <p className="lp__vciso-role">vCISO · Gue Cyber · MSc InfoSec</p>
              </div>
              <span className="lp__vciso-live">LIVE</span>
            </div>
            <div className="lp__vciso-note">
              <p className="lp__vciso-note-label">🔴 Action Required</p>
              <p className="lp__vciso-note-title">Patch CVE-2025-4421 — Critical</p>
              <p className="lp__vciso-note-body">This vulnerability affects your current .NET runtime. I've added a full remediation checklist. Patch before Friday to stay within your NIS2 72-hour window.</p>
              <div className="lp__vciso-note-meta">Due: Friday · Priority: Critical</div>
            </div>
            <div className="lp__vciso-note" style={{marginTop:'10px', opacity:0.7}}>
              <p className="lp__vciso-note-label">📋 Compliance Update</p>
              <p className="lp__vciso-note-title">NIS2 Article 21 — Monthly Check</p>
              <p className="lp__vciso-note-body">Your incident response plan needs one update — see Compliance tab for the specific gap I've flagged this month.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp__section" id="pricing">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// Plans & pricing</p>
          <h2>Simple, Transparent Pricing</h2>
          <p className="lp__section-sub">Start free. Upgrade when ready. No long-term contracts on monthly plans.</p>
        </div>
        <div className="lp__pricing-grid">
          {TIERS.map(tier => (
            <div className={`lp__tier ${tier.highlighted ? 'lp__tier--highlighted' : ''} ${tier.elite ? 'lp__tier--elite' : ''}`} key={tier.id}>
              {tier.highlighted && <div className="lp__tier-badge">⚡ Most Popular</div>}
              {tier.elite && <div className="lp__tier-badge lp__tier-badge--elite">✦ vCISO Included</div>}
              <div className="lp__tier-top">
                <p className="lp__tier-name">{tier.name}</p>
                <p className="lp__tier-desc">{tier.desc}</p>
                <div className="lp__tier-price">
                  <span className="lp__tier-amount">{tier.price}</span>
                  {tier.period && <span className="lp__tier-period">{tier.period}</span>}
                </div>
                {tier.badges.length > 0 && (
                  <div className="lp__tier-badges">
                    {tier.badges.map(b => <span key={b} className={`lp__cbadge lp__cbadge--${b.toLowerCase().replace('-','')}`}>{b}</span>)}
                  </div>
                )}
              </div>
              <ul className="lp__tier-features">
                {tier.items.map(item => (
                  <li key={item} className={item.startsWith('✦') ? 'lp__tier-feature--star' : ''}>{item}</li>
                ))}
              </ul>
              <Link
                to={tier.ctaPath}
                className={`lp__btn lp__tier-cta ${tier.ghost ? 'lp__btn--ghost' : tier.elite ? 'lp__btn--elite' : 'lp__btn--primary'}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="lp__pricing-note">* Trials are 14 days. Payment method required at signup — not charged until trial ends. Cancel anytime.</p>
      </section>

      {/* COMPLIANCE TABLE */}
      <section className="lp__section lp__section--alt">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// Compliance coverage</p>
          <h2>What Each Plan Covers</h2>
        </div>
        <div className="lp__table-wrap">
          <table className="lp__compare">
            <thead>
              <tr><th>Feature</th><th>Starter</th><th>Compliance Pro</th><th>Enterprise Risk</th><th>Enterprise Elite</th></tr>
            </thead>
            <tbody>
              <tr><td>Threat intelligence feed</td><td>Basic</td><td>Full</td><td>Full</td><td>Full</td></tr>
              <tr><td>GDPR export &amp; deletion</td><td>—</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Audit logging</td><td>—</td><td>90 days</td><td>1 year</td><td>Unlimited</td></tr>
              <tr><td>NIS2 incident reporting</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
              <tr><td>M365 integration</td><td>—</td><td>Basic</td><td>Full</td><td>Full</td></tr>
              <tr><td>Google Workspace</td><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
              <tr><td>EU-only data residency</td><td>—</td><td>—</td><td>—</td><td>✓</td></tr>
              <tr className="lp__compare-star"><td>vCISO Portal</td><td>—</td><td>—</td><td>—</td><td>✦ Included</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="lp__section" id="who">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// Who should use GueInsight</p>
          <h2>Built for Teams Without a Full SOC</h2>
        </div>
        <div className="lp__who-grid">
          {[
            { icon:'🏢', title:'SMEs & Mid-Market', desc:'Professional-grade threat intelligence and NIS2 compliance without enterprise pricing or complexity.' },
            { icon:'🛡️', title:'IT & Security Teams', desc:'Lightweight investigation layer to supplement SIEM/EDR — fast IoC extraction, enrichment and alerting.' },
            { icon:'📋', title:'Compliance Teams', desc:'GDPR and NIS2-ready workflows, audit logging, evidence packs and incident reporting built in.' },
            { icon:'🏦', title:'Public Sector & Finance', desc:'EU-only residency, audit-first design and traceable evidence for regulators and auditors.' },
          ].map(w => (
            <article className="lp__who-card" key={w.title}>
              <div className="lp__who-icon">{w.icon}</div>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* BUILT BY */}
      <section className="lp__built-by">
        <div className="lp__built-avatar">GA</div>
        <div className="lp__built-text">
          <p className="lp__eyebrow">// Built &amp; operated by</p>
          <h3>Gabriel Aloho · Founder, Gue Cyber</h3>
          <p>GueInsight isn't a white-labelled tool — it was designed and built from scratch by a cybersecurity professional with 15+ years of experience. MSc in Information Security &amp; Digital Forensics (University of East London). VDAB Cybersecurity certified. Registered enterprise in Belgium. When you subscribe to Enterprise Elite, you get Gabriel directly as your vCISO.</p>
        </div>
        <div className="lp__built-links">
          <a href="https://www.guecyber.com" target="_blank" rel="noreferrer" className="lp__btn lp__btn--ghost">🛡️ Visit Gue Cyber</a>
          <a href="https://www.gabrielaloho.com" target="_blank" rel="noreferrer" className="lp__btn lp__btn--ghost">👤 gabrielaloho.com</a>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp__section lp__section--alt">
        <div className="lp__section-head">
          <p className="lp__eyebrow">// FAQ</p>
          <h2>Common Questions</h2>
        </div>
        <div className="lp__faq">
          {FAQS.map((faq, i) => (
            <div className={`lp__faq-item ${openFaq === i ? 'lp__faq-item--open' : ''}`} key={i}>
              <button className="lp__faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{faq.q}</span>
                <span className="lp__faq-chevron">{openFaq === i ? '▲' : '▼'}</span>
              </button>
              {openFaq === i && <p className="lp__faq-a">{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp__final-cta">
        <h2>Ready to Secure Your Organisation?</h2>
        <p>Start free — or jump straight into a 14-day trial of a paid plan. No commitment until the trial ends.</p>
        <div className="lp__hero-actions">
          <button className="lp__btn lp__btn--primary" onClick={() => setShowPlanSelector(true)}>Start 14-Day Free Trial</button>
          <Link to="/support" className="lp__btn lp__btn--ghost">Talk to Gue Cyber →</Link>
        </div>
      </section>

      {showTrialModal && (
        <TrialModal
          onConfirm={() => { setShowTrialModal(false); window.location.href = '/subscription'; }}
          onCancel={() => setShowTrialModal(false)}
        />
      )}
      {showPlanSelector && <PlanSelector onClose={() => setShowPlanSelector(false)} />}
    </div>
  );
}
