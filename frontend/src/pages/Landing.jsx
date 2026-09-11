import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import TrialModal from '../components/TrialModal';
import PublicHeader from '../components/PublicHeader';
import {
  IconShield, IconShieldCheck, IconSearch, IconClipboard, IconDatabase,
  IconBell, IconLink, IconZap, IconGlobe, IconCheckCircle,
  IconUsers, IconBuilding, IconBook, IconMonitor, IconSmartphone,
  IconAsterisk, IconArrowRight, IconBarChart, IconLayers, IconLock, IconGitHub,
  IconMessage, IconStar, IconAlertTriangle, IconUser, IconBank, LogoGueInsight,
} from '../components/Icons';
import './Landing.css';
import { api } from '../services/api';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const FEATURES = [
  { icon: <IconShieldCheck size={22} />, title: 'vCISO Portal', desc: 'Your assigned virtual CISO posts recommendations, action items and security notes directly to your dashboard — included in Enterprise plans.' },
  { icon: <IconClipboard size={22} />, title: 'NIS2 Compliance', desc: 'Built-in NIS2 checklist, gap analysis, incident reporting with PDF export, and audit-ready evidence packs for Belgian regulators.' },
  { icon: <IconSearch size={22} />, title: 'AI-Assisted Threat Intelligence', desc: 'Upload files, paste indicators or connect M365 / Google Workspace — automated IoC extraction, scoring, enrichment and faster triage in seconds.' },
  { icon: <IconDatabase size={22} />, title: 'GDPR Tooling', desc: 'Data export, deletion requests, audit logging (90 days → unlimited) and data-subject request workflows built into every paid tier.' },
  { icon: <IconLink size={22} />, title: 'Cloud Connectors', desc: 'Microsoft 365 and Google Workspace integrations for user, device and policy discovery — spot GDPR and NIS2 gaps across your tenant.' },
  { icon: <IconBell size={22} />, title: 'Proactive Security Operations', desc: 'Custom alert rules, Slack / Teams notifications and weekly security summaries that help your team act before issues spread.' },
];

const TRUST_PACK = [
  {
    title: 'Readiness, not certification',
    body: 'SOC2 Type II readiness assessment and ISO 27001-aligned controls are presented as readiness claims, not as third-party certifications we do not hold.',
  },
  {
    title: 'Operational proof points',
    body: 'EU-only residency, audit packs, export/delete workflows, and vCISO guidance all surface in the public product flow and dashboard.',
  },
  {
    title: 'Verifiable product motion',
    body: 'The live landing snapshot, support workflow, documentation, and multi-language UI are all public and usable without a sales call.',
  },
];

const USE_CASE_NOTES = [
  {
    title: 'Security team triage',
    body: 'Reduce manual review time by routing indicators, alerts, and remediation steps into one dashboard view.',
  },
  {
    title: 'Compliance operations',
    body: 'Keep GDPR export, deletion, and incident evidence flows visible and repeatable for audit preparation.',
  },
  {
    title: 'Executive reporting',
    body: 'Use the same platform outputs to brief leadership on risk posture, incident trends, and follow-up actions.',
  },
];

const TIERS = [
  {
    id: 'free', name: 'Free', price: '€0', period: 'forever',
    desc: 'Basic threat detection for individuals',
    items: ['Manual file / text analysis', 'Basic threat scoring', 'Email alerts', '2 MB file limit', '30-day log retention'],
    cta: 'Get Started Free', ctaPath: '/signup', ghost: true,
    badges: [],
  },
  {
    id: 'starter', name: 'Starter', price: '€49.90', period: '/month',
    desc: 'For small teams and individual professionals',
    items: ['PDF, PCAP, logs analysis', 'Basic threat detection', 'Email support', '30-day retention'],
    cta: 'Start 14-Day Trial', ctaPath: '/signup',
    badges: [],
  },
  {
    id: 'compliance_pro', name: 'Compliance Pro', price: '€99.90', period: '/month',
    desc: 'GDPR-focused threat detection with audit trails',
    items: ['All Starter features', 'GDPR export & deletion', 'Audit logging — 90 days', 'M365 basic integration', 'Email + Slack alerts', '8 MB file limit'],
    cta: 'Start 14-Day Trial', ctaPath: '/signup',
    badges: ['GDPR', 'M365'],
    highlighted: false,
  },
  {
    id: 'enterprise_professional', name: 'Enterprise Professional', price: '€299.90', period: '/month',
    desc: 'GDPR + NIS2 compliance for growing enterprises',
    items: ['All file types + databases', 'Full GDPR compliance tools', 'NIS2 risk management', 'M365 + Google Workspace', '90-day retention & audit logs'],
    cta: 'Start 14-Day Trial', ctaPath: '/signup',
    badges: ['GDPR', 'NIS2'],
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
  { n: '01', title: 'Sign up & choose a plan', desc: 'Start on Free, or select a paid tier. Paid plans include a 14-day trial — your card is validated but not charged until the trial ends.' },
  { n: '02', title: 'Connect your environment', desc: 'Link Microsoft 365, Google Workspace or upload files directly. Your data stays in the EU.' },
  { n: '03', title: 'Get instant intelligence', desc: 'Automated IoC extraction, threat scoring and compliance gap analysis start immediately.' },
  { n: '04', title: 'Act on vCISO guidance', desc: 'Enterprise Elite subscribers receive expert recommendations, action items and notes posted directly to their dashboard by Gue Cyber.' },
];

const FAQS = [
  { q: 'Do I need to give a payment card to try it?', a: 'Yes — paid plans require a payment method at trial sign-up. The card is validated but you will not be charged until the 14-day trial ends, unless you keep the subscription.' },
  { q: 'What is the vCISO Portal?', a: 'Enterprise Elite subscribers get a dedicated section on their dashboard where Gabriel Aloho (Gue Cyber founder) or an assigned vCISO posts security recommendations, action items, and advisory notes directly to your account.' },
  { q: 'Is my data stored in the EU?', a: 'Yes. All data is processed and stored in the EU. Enterprise Elite adds an EU-only data residency guarantee with contractual commitments.' },
  { q: 'Will you delete our data if requested?', a: 'Yes. Compliance Pro and above include GDPR export and deletion features for data-subject requests, with full audit logging.' },
  { q: 'Is GueInsight NIS2 compliant?', a: 'Enterprise Risk and Elite tiers include NIS2 incident reporting, gap analysis, evidence packs and audit logging designed to support NIS2 compliance workflows for Belgian and EU organisations.' },
];

const CAPABILITIES = [
  { title: 'Analyze threats fast', desc: 'Upload files, paste indicators, or scan URLs to extract IoCs, score risk, and enrich findings in seconds.' },
  { title: 'Stay GDPR and NIS2 ready', desc: 'Use built-in export, deletion, incident reporting, and audit evidence workflows designed for Belgian and EU teams.' },
  { title: 'Connect your cloud stack', desc: 'Link Microsoft 365 or Google Workspace to discover users, devices, policies, and compliance gaps across the tenant.' },
  { title: 'Get vCISO guidance', desc: 'Enterprise Elite adds expert recommendations, action items, and monthly advisory notes directly in the dashboard.' },
  { title: 'Use AI for triage and next steps', desc: 'Summarize security events, cluster related alerts, and turn signals into practical remediation guidance faster.' },
];

const LIVE_ALERT_CLASS_MAP = { HIGH: 'lp__mock-alert--high', MED: 'lp__mock-alert--med', OK: 'lp__mock-alert--ok' };
const LIVE_DOT_CLASS_MAP   = { HIGH: 'lp__mock-adot', MED: 'lp__mock-adot lp__mock-adot--med', OK: 'lp__mock-adot lp__mock-adot--ok' };
const LIVE_BADGE_CLASS_MAP = { HIGH: 'lp__mock-badge lp__mock-badge--high', MED: 'lp__mock-badge lp__mock-badge--med', OK: 'lp__mock-badge lp__mock-badge--ok' };

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
  if (!isoDate) return 'Updated now';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Updated now';
  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs < 60_000) return 'Updated just now';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

// SVG icon set for the avatar/blob grid — no emojis
const AVATAR_BLOBS_ICONS = [
  <IconShield size={28} />, <IconSearch size={28} />, <IconBarChart size={28} />,
  <IconLink size={28} />, <IconBell size={28} />, <IconClipboard size={28} />,
  <IconZap size={28} />, <IconBuilding size={28} />, <IconGlobe size={28} />,
  <IconMessage size={28} />, <IconLock size={28} />, <IconCheckCircle size={28} />,
];

export default function Landing() {
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
        if (isMounted) setHeroSnapshot(applySnapshot(response?.data || {}));
      } catch {
        if (isMounted) setHeroSnapshot((prev) => prev || FALLBACK_HERO_STATE);
      }
    };

    const startFallbackPolling = () => {
      if (fallbackPollingStarted) return;
      fallbackPollingStarted = true;
      loadLandingSnapshot();
      pollIntervalId = setInterval(loadLandingSnapshot, 30_000);
    };

    const sseBase = (api?.defaults?.baseURL || '').replace(/\/$/, '');
    const sseUrl = sseBase ? `${sseBase}/api/public/landing-snapshot/stream` : '/api/public/landing-snapshot/stream';

    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });
      eventSource.addEventListener('snapshot', (event) => {
        if (!isMounted) return;
        try { setHeroSnapshot(applySnapshot(JSON.parse(event.data))); } catch { /* ignore */ }
      });
      eventSource.onerror = () => {
        if (eventSource) { eventSource.close(); eventSource = null; }
        startFallbackPolling();
      };
    } catch { startFallbackPolling(); }

    loadLandingSnapshot();

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, []);

  const landingRef = useRef(null);
  const scoreUpdateLabel = useMemo(() => getRelativeUpdateLabel(heroSnapshot.updatedAt), [heroSnapshot.updatedAt]);

  // ── ORCHESTRATED GSAP SCRUBBED SCROLL ANIMATIONS (EVERY SECTION) ──
  useEffect(() => {
    const ctx = gsap.context(() => {
      // 0. Top Scroll Progress Indicator (continuous scrub with page scroll)
      gsap.to('.lp__scroll-progress-fill', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.lp',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      });

      // 1. HERO SECTION: Multi-directional Floating Parallax & 3D Tilt
      // Floating Parallax Badges (silky smooth counter-drift)
      gsap.to('.lp__hero-deco--tl', {
        y: -95,
        x: -28,
        rotation: -16,
        ease: 'sine.out',
        scrollTrigger: {
          trigger: '.lp__hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.3,
        },
      });

      gsap.to('.lp__hero-deco--tr', {
        y: -125,
        x: 38,
        rotation: 40,
        ease: 'sine.out',
        scrollTrigger: {
          trigger: '.lp__hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.4,
        },
      });

      gsap.to('.lp__hero-deco--ml', {
        y: 70,
        x: -20,
        rotation: 14,
        ease: 'sine.out',
        scrollTrigger: {
          trigger: '.lp__hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.3,
        },
      });

      gsap.to('.lp__hero-deco--mr', {
        y: 90,
        x: 30,
        rotation: -14,
        ease: 'sine.out',
        scrollTrigger: {
          trigger: '.lp__hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.4,
        },
      });

      // Hero text parallax: title, lead, and actions softly glide and fade as you scroll down
      gsap.to('.lp__hero-top', {
        y: -45,
        opacity: 0.85,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: '.lp__hero',
          start: 'top top',
          end: 'bottom 40%',
          scrub: 1.2,
        },
      });

      // Dashboard Mockup 3D Perspective Scrub (Levels out to flat, then smoothly recedes)
      const panelTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: '.lp__hero-panel-wrap',
          start: 'top 95%',
          end: 'bottom 15%',
          scrub: 1.2,
        },
      });
      panelTimeline
        .fromTo(
          '.lp__hero-panel-wrap',
          { rotateX: 12, scale: 0.92, y: 50, transformPerspective: 1200 },
          { rotateX: 0, scale: 1, y: 0, ease: 'power2.out', duration: 1 }
        )
        .to('.lp__hero-panel-wrap', {
          scale: 0.96,
          y: -30,
          opacity: 0.88,
          ease: 'power1.in',
          duration: 0.8,
        });

      // Mockup internal alerts cascade scrub
      const mockAlerts = gsap.utils.toArray('.lp__mock-alert');
      mockAlerts.forEach((alert, i) => {
        gsap.fromTo(
          alert,
          { x: -16, opacity: 0.4 },
          {
            x: 0,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: alert,
              start: 'top 92%',
              end: 'top 65%',
              scrub: 1.1,
            },
          }
        );
      });

      // 2. TAGLINE BAR: Scrubbed reveal & gentle focus
      gsap.fromTo(
        '.lp__tagline',
        { opacity: 0.35, scale: 0.96, y: 24 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__tagline-bar',
            start: 'top 88%',
            end: 'center 50%',
            scrub: 1.2,
          },
        }
      );

      // 3. CORE CAPABILITIES: Staggered Multi-Plane Wave Scrub
      gsap.fromTo(
        '.lp__section--capabilities .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__section--capabilities',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const capCards = gsap.utils.toArray('.lp__capability-card');
      capCards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 42 + (i % 2) * 22, opacity: 0.35, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              end: 'top 52%',
              scrub: 1.25,
            },
          }
        );

        // Capability index number subtle scrubbed pop
        const idxBadge = card.querySelector('.lp__capability-index');
        if (idxBadge) {
          gsap.fromTo(
            idxBadge,
            { scale: 0.9, opacity: 0.7 },
            {
              scale: 1.06,
              opacity: 1,
              ease: 'power1.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                end: 'top 55%',
                scrub: 1.2,
              },
            }
          );
        }
      });

      // 4. NIS2 WARNING BANNER: Scrubbed expansion
      gsap.fromTo(
        '.lp__nis2-banner',
        { scale: 0.93, y: 28, opacity: 0.5 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__nis2-banner',
            start: 'top 92%',
            end: 'top 55%',
            scrub: 1.2,
          },
        }
      );

      // 5. FEATURES SECTION: Cascade 3D Wave Scrub & icon lift
      gsap.fromTo(
        '#features .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#features',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const featureCards = gsap.utils.toArray('#features .lp__feature-card');
      featureCards.forEach((card, idx) => {
        // 3-column phase offset creates a gorgeous curved wave into view
        const columnOffset = (idx % 3 === 1) ? 55 : (idx % 3 === 0) ? 35 : 45;
        gsap.fromTo(
          card,
          { y: columnOffset, opacity: 0.32, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 93%',
              end: 'top 52%',
              scrub: 1.3,
            },
          }
        );

        const icon = card.querySelector('.lp__feature-icon');
        if (icon) {
          gsap.fromTo(
            icon,
            { y: 10, scale: 0.92 },
            {
              y: 0,
              scale: 1,
              ease: 'power1.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                end: 'top 55%',
                scrub: 1.2,
              },
            }
          );
        }
      });

      // 6. ABOUT SECTION: Differential Parallax Split (Left copy vs Right icon grid)
      gsap.fromTo(
        '.lp__about-left',
        { y: 32, opacity: 0.45 },
        {
          y: -22,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.lp__about-section',
            start: 'top 88%',
            end: 'bottom 15%',
            scrub: 1.3,
          },
        }
      );

      gsap.fromTo(
        '.lp__avatar-grid',
        { y: 65, opacity: 0.4 },
        {
          y: -50,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.lp__about-section',
            start: 'top 88%',
            end: 'bottom 15%',
            scrub: 1.45,
          },
        }
      );

      // Avatar blobs wave scrub (alternating rotation & scale breathing)
      const avatarBlobs = gsap.utils.toArray('.lp__avatar-blob');
      avatarBlobs.forEach((blob, i) => {
        gsap.fromTo(
          blob,
          { scale: 0.84, rotation: (i % 2 === 0 ? -10 : 10) },
          {
            scale: 1,
            rotation: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '.lp__avatar-grid',
              start: 'top 92%',
              end: 'center 35%',
              scrub: 1.25,
            },
          }
        );
      });

      // 7. TRUST PACK & USE CASES (#proof): Dedicated Section Scrub
      gsap.fromTo(
        '#proof .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#proof',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const proofCards = gsap.utils.toArray('#proof .lp__feature-card');
      proofCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { y: 38 + (idx % 3) * 15, opacity: 0.35, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 93%',
              end: 'top 55%',
              scrub: 1.25,
            },
          }
        );
      });

      // 8. HOW IT WORKS (STEPS): Sequential Step Scrub
      gsap.fromTo(
        '#how .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#how',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const stepItems = gsap.utils.toArray('.lp__step');
      stepItems.forEach((step) => {
        gsap.fromTo(
          step,
          { y: 32, opacity: 0.35, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: step,
              start: 'top 92%',
              end: 'top 58%',
              scrub: 1.2,
            },
          }
        );

        const stepNumber = step.querySelector('.lp__step-n');
        if (stepNumber) {
          gsap.fromTo(
            stepNumber,
            { scale: 0.88, opacity: 0.65 },
            {
              scale: 1.08,
              opacity: 1,
              ease: 'power1.out',
              scrollTrigger: {
                trigger: step,
                start: 'top 90%',
                end: 'top 55%',
                scrub: 1.2,
              },
            }
          );
        }
      });

      // 9. vCISO HIGHLIGHT: Left vs Right 3D Perspective Scrub
      gsap.fromTo(
        '.lp__vciso-left',
        { x: -40, opacity: 0.35 },
        {
          x: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__vciso-section',
            start: 'top 88%',
            end: 'top 45%',
            scrub: 1.25,
          },
        }
      );

      gsap.fromTo(
        '.lp__vciso-right',
        { x: 40, rotateY: -8, opacity: 0.35, transformPerspective: 1000 },
        {
          x: 0,
          rotateY: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__vciso-section',
            start: 'top 88%',
            end: 'top 45%',
            scrub: 1.25,
          },
        }
      );

      // vCISO live badge subtle pulse on scrub
      gsap.fromTo(
        '.lp__vciso-live',
        { scale: 0.85 },
        {
          scale: 1.08,
          ease: 'sine.out',
          scrollTrigger: {
            trigger: '.lp__vciso-section',
            start: 'top 85%',
            end: 'center 45%',
            scrub: 1.2,
          },
        }
      );

      // 10. NATIVE APP TEASER: Scrubbed Device Mockup Rise & Differential Parallax
      gsap.fromTo(
        '.lp__app-teaser',
        { scale: 0.93, y: 35, opacity: 0.65 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__app-teaser',
            start: 'top 88%',
            end: 'top 45%',
            scrub: 1.2,
          },
        }
      );

      gsap.fromTo(
        '.lp__device-mockup',
        { y: 55, scale: 0.94, opacity: 0.5 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__app-teaser',
            start: 'top 85%',
            end: 'top 40%',
            scrub: 1.3,
          },
        }
      );

      // 11. PRICING SECTION: Elevated Tier Scrub Focus
      gsap.fromTo(
        '#pricing .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#pricing',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const tiers = gsap.utils.toArray('.lp__tier');
      tiers.forEach((tier) => {
        const isHighlighted = tier.classList.contains('lp__tier--highlighted') || tier.classList.contains('lp__tier--elite');
        gsap.fromTo(
          tier,
          { y: 42, opacity: 0.35, scale: 0.95 },
          {
            y: isHighlighted ? -10 : 0,
            opacity: 1,
            scale: isHighlighted ? 1.025 : 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: tier,
              start: 'top 93%',
              end: 'top 52%',
              scrub: 1.25,
            },
          }
        );
      });

      // 12. COMPLIANCE TABLE: Scrubbed Slide-Up & Scale
      gsap.fromTo(
        '.lp__table-wrap',
        { y: 38, opacity: 0.35, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__table-wrap',
            start: 'top 92%',
            end: 'top 52%',
            scrub: 1.25,
          },
        }
      );

      // 13. WHO IT'S FOR: Staggered scrub & icon lift
      gsap.fromTo(
        '#who .lp__section-head',
        { y: 32, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#who',
            start: 'top 88%',
            end: 'top 55%',
            scrub: 1.1,
          },
        }
      );

      const whoCards = gsap.utils.toArray('.lp__who-card');
      whoCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { y: 38 + (idx % 2) * 18, opacity: 0.35, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 93%',
              end: 'top 55%',
              scrub: 1.25,
            },
          }
        );

        const icon = card.querySelector('.lp__who-icon');
        if (icon) {
          gsap.fromTo(
            icon,
            { y: 8, scale: 0.92 },
            {
              y: 0,
              scale: 1.08,
              ease: 'power1.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                end: 'top 55%',
                scrub: 1.2,
              },
            }
          );
        }
      });

      // 14. BUILT BY FOUNDER SECTION: Card & Avatar Scrub
      gsap.fromTo(
        '.lp__built-by',
        { y: 38, opacity: 0.35, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__built-by',
            start: 'top 92%',
            end: 'top 55%',
            scrub: 1.25,
          },
        }
      );

      gsap.fromTo(
        '.lp__built-avatar',
        { scale: 0.84, opacity: 0.6 },
        {
          scale: 1,
          opacity: 1,
          ease: 'back.out(1.5)',
          scrollTrigger: {
            trigger: '.lp__built-by',
            start: 'top 90%',
            end: 'top 50%',
            scrub: 1.2,
          },
        }
      );

      // 15. FAQ ACCORDION: Cascade Scrub
      const faqItems = gsap.utils.toArray('.lp__faq-item');
      faqItems.forEach((faq) => {
        gsap.fromTo(
          faq,
          { y: 26, opacity: 0.4 },
          {
            y: 0,
            opacity: 1,
            ease: 'power1.out',
            scrollTrigger: {
              trigger: faq,
              start: 'top 93%',
              end: 'top 68%',
              scrub: 1.1,
            },
          }
        );
      });

      // 16. FINAL CTA: Expansion & Ambient Glow Scrub
      gsap.fromTo(
        '.lp__final-cta',
        { scale: 0.92, borderRadius: '44px', opacity: 0.75 },
        {
          scale: 1,
          borderRadius: '24px',
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.lp__final-cta',
            start: 'top 92%',
            end: 'center 60%',
            scrub: 1.2,
          },
        }
      );

      // Continuous sparkle rotation scrubbed with overall page scroll
      gsap.to('.lp__sparkle', {
        rotation: 720,
        ease: 'none',
        scrollTrigger: {
          trigger: '.lp',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
        },
      });

      // ── BOUNCE ENTRANCE & HOVER MICRO-ANIMATIONS ──
      // Hero eyebrow spring bounce
      gsap.from('.lp__eyebrow', {
        y: -28,
        opacity: 0,
        scale: 0.86,
        duration: 1,
        ease: 'back.out(2)',
        delay: 0.1,
      });

      // Floating avatars elastic pop entrance
      gsap.from('.lp__float-avatar', {
        scale: 0,
        opacity: 0,
        duration: 1.1,
        stagger: 0.12,
        ease: 'elastic.out(1.1, 0.4)',
        delay: 0.25,
      });

      // Continuous gentle physics-based float on avatars
      gsap.to('.lp__float-avatar', {
        y: '+=6',
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: {
          each: 0.35,
          from: 'random',
        },
      });

      // Hover feedback on feature cards (scale & glow without conflicting with scroll y)
      featureCards.forEach((card) => {
        const icon = card.querySelector('.lp__feature-icon');
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            scale: 1.022,
            duration: 0.35,
            ease: 'back.out(2)',
            boxShadow: '0 20px 40px rgba(232, 73, 10, 0.13)',
            borderColor: '#E8490A',
          });
          if (icon) {
            gsap.to(icon, {
              scale: 1.18,
              rotation: 6,
              duration: 0.4,
              ease: 'back.out(2.5)',
            });
          }
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderColor: '#E8E4DF',
          });
          if (icon) {
            gsap.to(icon, {
              scale: 1,
              rotation: 0,
              duration: 0.3,
              ease: 'power2.out',
            });
          }
        });
      });

      // Hover feedback on capability cards
      capCards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            scale: 1.02,
            duration: 0.35,
            ease: 'back.out(2)',
            boxShadow: '0 14px 32px rgba(0,0,0,0.09)',
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            scale: 1,
            duration: 0.28,
            ease: 'power2.out',
            boxShadow: 'none',
          });
        });
      });

      // Hover feedback on audience cards
      whoCards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            scale: 1.02,
            duration: 0.32,
            ease: 'back.out(2)',
            boxShadow: '0 14px 32px rgba(0,0,0,0.08)',
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            scale: 1,
            duration: 0.28,
            ease: 'power2.out',
            boxShadow: 'none',
          });
        });
      });

      // Interactive hover on avatar blobs
      avatarBlobs.forEach((blob) => {
        blob.addEventListener('mouseenter', () => {
          gsap.to(blob, {
            scale: 1.28,
            rotation: gsap.utils.random(-8, 8),
            duration: 0.4,
            ease: 'elastic.out(1.2, 0.3)',
          });
        });
        blob.addEventListener('mouseleave', () => {
          gsap.to(blob, {
            scale: 1,
            rotation: 0,
            duration: 0.3,
            ease: 'power2.out',
          });
        });
      });

      // Buttons hover bounce
      const buttons = gsap.utils.toArray('.lp__btn--primary, .lp__btn--cta, .lp__tier-cta');
      buttons.forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          gsap.to(btn, {
            scale: 1.04,
            duration: 0.25,
            ease: 'back.out(2)',
          });
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(btn, {
            scale: 1,
            duration: 0.25,
            ease: 'power2.out',
          });
        });
        btn.addEventListener('mousedown', () => {
          gsap.to(btn, {
            scale: 0.96,
            duration: 0.1,
            ease: 'power1.out',
          });
        });
        btn.addEventListener('mouseup', () => {
          gsap.to(btn, {
            scale: 1.04,
            duration: 0.2,
            ease: 'back.out(2)',
          });
        });
      });

    }, landingRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="lp" ref={landingRef}>
      {/* ── TOP SCRUBBED SCROLL PROGRESS BAR ── */}
      <div className="lp__scroll-progress" aria-hidden="true">
        <div className="lp__scroll-progress-fill" />
      </div>

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
        trialLabel="View Plans"
        trialTo="/subscription"
      />

      {/* ══════════ HERO ══════════ */}
      <section className="lp__hero">
        <div className="lp__hero-top">

          {/* Floating decorative avatars */}
          <div className="lp__hero-deco lp__hero-deco--tl">
            <div className="lp__float-avatar lp__float-avatar--sm"><IconShield size={20} color="#E8490A" /></div>
          </div>
          <div className="lp__hero-deco lp__hero-deco--tr">
            <IconAsterisk size={28} color="#E8490A" className="lp__sparkle" />
          </div>
          <div className="lp__hero-deco lp__hero-deco--ml" style={{ left: '5%' }}>
            <div className="lp__float-avatar"><IconSearch size={22} color="#E8490A" /></div>
          </div>
          <div className="lp__hero-deco lp__hero-deco--mr" style={{ right: '5%' }}>
            <div className="lp__float-avatar lp__float-avatar--lg"><IconBuilding size={28} color="#E8490A" /></div>
          </div>

          {/* Eyebrow pill */}
          <p className="lp__eyebrow">
            <IconGlobe size={14} color="#E8490A" />
            GueInsight — Threat Intelligence, Compliance &amp; vCISO in one platform
          </p>

          {/* Main headline */}
          <h1>
            Your Security Dashboard.
            <span className="lp__hero-h1-line2"><em>Expert-Backed.</em></span>
          </h1>

          {/* Lead paragraph */}
          <p className="lp__lead">
            GueInsight gives Belgian and European organisations real-time threat intelligence, AI-assisted triage, NIS2 &amp; GDPR compliance tools, and — on Enterprise Elite — a <strong>virtual CISO portal</strong> where Gue Cyber experts post recommendations directly to your dashboard.
          </p>

          {/* Capability summary pills */}
          <div className="lp__capability-summary" aria-label="Platform capabilities">
            <span>Analyze threats</span>
            <span>Manage compliance</span>
            <span>Connect cloud systems</span>
            <span>Work with a vCISO</span>
            <span>Use AI-assisted triage</span>
          </div>

          {/* CTA buttons */}
          <div className="lp__hero-actions">
            <Link to="/subscription" className="lp__btn lp__btn--primary">View Plans <IconArrowRight size={16} /></Link>
            <Link to="/subscription" className="lp__btn lp__btn--ghost">See all features</Link>
          </div>

          {/* Trust indicators */}
          <div className="lp__trust-row">
            <span><IconZap size={14} color="#E8490A" /> Fast IoC extraction</span>
            <span><IconClipboard size={14} color="#E8490A" /> NIS2 &amp; GDPR ready</span>
            <span><IconShieldCheck size={14} color="#E8490A" /> vCISO guidance</span>
            <span><IconGlobe size={14} color="#E8490A" /> EU data residency</span>
          </div>
        </div>

        {/* HERO DASHBOARD MOCKUP */}
        <div className="lp__hero-panel-wrap">
          <div className="lp__hero-panel">
            {/* Window chrome */}
            <div className="lp__mock-bar">
              <span className="lp__mock-dot" style={{ background: '#FF5F57' }} />
              <span className="lp__mock-dot" style={{ background: '#FFBD2E' }} />
              <span className="lp__mock-dot" style={{ background: '#28CA41' }} />
              <span className="lp__mock-url">insights.guecyber.com · Dashboard</span>
            </div>

            {/* Main body — sidebar + content */}
            <div className="lp__mock-body">
              {/* Sidebar */}
              <div className="lp__mock-sidebar">
                <div className="lp__mock-server-icon"><IconShield size={18} color="#E8490A" /></div>
                <div className="lp__mock-channel-group">THREAT INTEL</div>
                <div className="lp__mock-channel lp__mock-channel--active">
                  <span>#</span> overview
                </div>
                <div className="lp__mock-channel"><span>#</span> alerts</div>
                <div className="lp__mock-channel"><span>#</span> ioc-feed</div>
                <div className="lp__mock-channel"><span>#</span> off-topic</div>
                <div className="lp__mock-channel-group" style={{ marginTop: 8 }}>COMPLIANCE</div>
                <div className="lp__mock-channel"><span>#</span> nis2</div>
                <div className="lp__mock-channel"><span>#</span> vciso</div>
              </div>

              {/* Main content */}
              <div className="lp__mock-main">
                <div className="lp__mock-channel-header">
                  <span>#</span> overview
                </div>

                {/* Tabs */}
                <div className="lp__mock-tabs">
                  <span className="lp__mock-tab lp__mock-tab--active">Threat Intel</span>
                  <span className="lp__mock-tab">Compliance</span>
                  <span className="lp__mock-tab">vCISO</span>
                </div>

                {/* Score ring */}
                <div className="lp__mock-score-row">
                  <div className="lp__mock-ring" style={{ '--ring-fill': heroSnapshot.securityScore }}>
                    <span>{heroSnapshot.securityScore}</span>
                  </div>
                  <div>
                    <p className="lp__mock-score-label">Security Score</p>
                    <p className="lp__mock-score-sub">{heroSnapshot.activeAlerts} active alerts · {scoreUpdateLabel}</p>
                  </div>
                </div>

                {/* Alerts */}
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

                {/* vCISO note */}
                <div className="lp__mock-vciso">
                  <p className="lp__mock-vciso-label">💬 vCISO Note — {heroSnapshot.vcisoNote.authorName}</p>
                  <p className="lp__mock-vciso-text">"{heroSnapshot.vcisoNote.note}"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TAGLINE BAR ══════════ */}
      <div className="lp__tagline-bar">
        <div className="lp__container">
          <p className="lp__tagline">
            For the <strong>security teams</strong>. The <strong>compliance officers</strong>. The <em>"are we NIS2 ready?"</em> people.
          </p>
        </div>
      </div>

      {/* ══════════ CORE CAPABILITIES ══════════ */}
      <section className="lp__section lp__section--capabilities" id="capabilities">
        <div className="lp__section-head lp__section-head--compact">
          <span className="lp__section-eyebrow">// Core capabilities</span>
          <h2>What the platform lets you do</h2>
          <p className="lp__section-sub">Five actions cover most teams' day-to-day needs: detect, comply, connect, get expert guidance, and accelerate triage with AI-assisted security ops.</p>
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

      {/* ══════════ NIS2 BANNER ══════════ */}
      <div className="lp__nis2-banner">
        <div>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconAlertTriangle size={16} color="#DC2626" /> NIS2 is now enforced in Belgium.</strong>{' '}
          Organisations in critical sectors face fines up to <strong>€10 million</strong> for non-compliance. GueInsight's Enterprise Risk and Elite tiers include full NIS2 incident reporting, gap analysis, and audit evidence.
        </div>
        <Link to="/subscription" className="lp__btn lp__btn--nis2">See NIS2 Plans <IconArrowRight size={14} /></Link>
      </div>

      {/* ══════════ FEATURES GRID ══════════ */}
      <div className="lp__section--alt">
        <section className="lp__section-inner" id="features">
          <div className="lp__section-head">
            <span className="lp__section-eyebrow">// What you get</span>
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
      </div>

      {/* ══════════ ABOUT / OPEN SOURCE SECTION ══════════ */}
      <div className="lp__about-section">
        {/* Left text */}
        <div className="lp__about-left">
        <span className="lp__about-eyebrow"><IconAsterisk size={14} color="#E8490A" /> About GueInsight</span>
          <h2>A little less enterprise.<br />A lot more intelligence.</h2>
          <p>
            We believe cybersecurity shouldn't require a full SOC budget. So we're building focused, affordable tools for organisations who want real security insight — not just dashboards. No big pitch. Just good security.
          </p>
          <p>
            GueInsight is built by <strong>Gabriel Aloho</strong> — founder of <a href="https://www.guecyber.com" target="_blank" rel="noreferrer" style={{ color: 'var(--orange)', fontWeight: 600 }}>Gue Cyber</a>, MSc in Information Security &amp; Digital Forensics, registered enterprise in Belgium.
          </p>
          <div className="lp__about-cta">
            <a
              href="https://github.com/GUE-GROUP-LIMITED"
              target="_blank"
              rel="noreferrer"
              className="lp__btn lp__btn--ghost"
              style={{ display: 'inline-flex' }}
            >
              <IconGitHub size={16} />
              Star on GitHub
            </a>
          </div>
        </div>

        {/* Right — icon grid */}
        <div className="lp__avatar-grid" aria-hidden="true">
          {AVATAR_BLOBS_ICONS.map((iconEl, i) => (
            <div
              key={i}
              className="lp__avatar-blob"
              style={{ animationDelay: `${i * 0.28}s`, color: '#E8490A' }}
            >
              {iconEl}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ TRUST PACK ══════════ */}
      <div className="lp__section--alt" id="proof">
        <section className="lp__section-inner">
          <div className="lp__section-head">
            <span className="lp__section-eyebrow">// Trust pack</span>
            <h2>What buyers should verify before they buy</h2>
            <p className="lp__section-sub">This section keeps the public page honest: it highlights what is verified, what is a readiness claim, and where the product already shows measurable output.</p>
          </div>
          <div className="lp__features-grid">
            {TRUST_PACK.map((item) => (
              <article className="lp__feature-card" key={item.title}>
                <div className="lp__feature-icon"><IconCheckCircle size={22} color="#16a34a" /></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <div className="lp__features-grid" style={{ marginTop: '16px' }}>
            {USE_CASE_NOTES.map((item) => (
              <article className="lp__feature-card" key={item.title}>
                <div className="lp__feature-icon"><IconLayers size={22} color="#E8490A" /></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="lp__section" id="how">
        <div className="lp__section-head">
          <span className="lp__section-eyebrow">// Getting started</span>
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

      {/* ══════════ vCISO HIGHLIGHT ══════════ */}
      <div className="lp__section--alt">
        <div className="lp__vciso-section">
          <div className="lp__vciso-left">
            <p className="lp__eyebrow" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: 'rgba(232,73,10,0.08)', color: 'var(--orange)', borderRadius: '100px', padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>// Enterprise Elite exclusive</p>
            <h2>Your Virtual CISO.<br />Right Inside Your Dashboard.</h2>
            <p>Most cybersecurity tools give you data. GueInsight Enterprise Elite gives you an <strong>expert</strong>. Gabriel Aloho — founder of Gue Cyber, MSc in Information Security &amp; Digital Forensics — posts personalised security recommendations, action items, and advisory notes directly to your dashboard.</p>
            <ul className="lp__vciso-list">
              <li>Personalised security recommendations</li>
              <li>Action items with priority and deadlines</li>
              <li>NIS2 remediation checklists</li>
              <li>Monthly vCISO review summaries</li>
              <li>Direct line to Gue Cyber expertise</li>
            </ul>
            <div className="lp__hero-actions" style={{ marginTop: 28 }}>
              <Link to="/subscription" className="lp__btn lp__btn--primary">View Plans</Link>
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
              <div className="lp__vciso-note" style={{ opacity: 0.7 }}>
                <p className="lp__vciso-note-label">📋 Compliance Update</p>
                <p className="lp__vciso-note-title">NIS2 Article 21 — Monthly Check</p>
                <p className="lp__vciso-note-body">Your incident response plan needs one update — see Compliance tab for the specific gap I've flagged this month.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ APP TEASER (dark card) ══════════ */}
      <section className="lp__section" style={{ paddingBottom: 0 }}>
        <div className="lp__app-teaser">
          <div className="lp__app-teaser-left">
            <h2>Take your security with you.</h2>
            <p>Native GueInsight apps for mobile and desktop are coming soon. The same intelligence, with a home on every screen.</p>
            <div className="lp__app-platform-badges">
              <div className="lp__platform-badge">
                <span className="lp__platform-badge-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.39-1.32 2.76-2.54 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Mobile
                </span>
                <span className="lp__platform-badge-sub">iOS &amp; Android</span>
              </div>
              <div className="lp__platform-badge">
                <span className="lp__platform-badge-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm-2 15a1 1 0 0 1 1-1h18a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1zm5-4h10v1H7v-1z"/></svg>
                  Desktop
                </span>
                <span className="lp__platform-badge-sub">macOS, Windows &amp; Linux</span>
              </div>
            </div>
          </div>

          {/* Device mockup */}
          <div className="lp__app-teaser-right">
            <div className="lp__device-mockup">
              <div className="lp__device-mockup-bar">
                <span className="lp__device-mockup-bar-dot" style={{ background: '#FF5F57' }} />
                <span className="lp__device-mockup-bar-dot" style={{ background: '#FFBD2E' }} />
                <span className="lp__device-mockup-bar-dot" style={{ background: '#28CA41' }} />
              </div>
              {[
                { color: '#E8490A', line: 0.6, badge: '#FF5050' },
                { color: '#FFB432', line: 0.45, badge: '#FFB432' },
                { color: '#50DC82', line: 0.7, badge: '#50DC82' },
                { color: '#6B7AFF', line: 0.5, badge: '#6B7AFF' },
              ].map((row, i) => (
                <div className="lp__device-screen-row" key={i}>
                  <div className="lp__device-avatar-sm" style={{ background: row.color }}>{['A','B','C','D'][i]}</div>
                  <div className="lp__device-line" style={{ maxWidth: `${row.line * 100}%` }} />
                  <div className="lp__device-badge-sm" style={{ background: `${row.badge}22` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section className="lp__section" id="pricing">
        <div className="lp__section-head">
          <span className="lp__section-eyebrow">// Plans &amp; pricing</span>
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
                    {tier.badges.map(b => (
                      <span key={b} className={`lp__cbadge lp__cbadge--${b.toLowerCase().replace('-', '')}`}>{b}</span>
                    ))}
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
                className={`lp__btn lp__tier-cta ${tier.ghost ? 'lp__btn--ghost' : tier.elite ? 'lp__btn--dark' : 'lp__btn--primary'}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="lp__pricing-note">* Trials are 14 days. Payment method is required for paid-plan trials — not charged until the trial ends. Cancel anytime.</p>
      </section>

      {/* ══════════ COMPLIANCE TABLE ══════════ */}
      <div className="lp__section--alt">
        <section className="lp__section-inner">
          <div className="lp__section-head">
            <span className="lp__section-eyebrow">// Compliance coverage</span>
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
      </div>

      {/* ══════════ WHO IT'S FOR ══════════ */}
      <section className="lp__section" id="who">
        <div className="lp__section-head">
          <span className="lp__section-eyebrow">// Who should use GueInsight</span>
          <h2>Built for Teams Without a Full SOC</h2>
        </div>
        <div className="lp__who-grid">
          {[
            { icon: <IconBuilding size={24} color="#E8490A" />, title: 'SMEs & Mid-Market', desc: 'Professional-grade threat intelligence and NIS2 compliance without enterprise pricing or complexity.' },
            { icon: <IconShield size={24} color="#E8490A" />, title: 'IT & Security Teams', desc: 'Lightweight investigation layer to supplement SIEM/EDR — fast IoC extraction, enrichment and alerting.' },
            { icon: <IconClipboard size={24} color="#E8490A" />, title: 'Compliance Teams', desc: 'GDPR and NIS2-ready workflows, audit logging, evidence packs and incident reporting built in.' },
            { icon: <IconBank size={24} color="#E8490A" />, title: 'Public Sector & Finance', desc: 'EU-only residency, audit-first design and traceable evidence for regulators and auditors.' },
          ].map(w => (
            <article className="lp__who-card" key={w.title}>
              <span className="lp__who-icon">{w.icon}</span>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════════ BUILT BY ══════════ */}
      <div className="lp__built-by">
        <div className="lp__built-avatar">GA</div>
        <div className="lp__built-text">
          <p className="lp__section-eyebrow" style={{ textAlign: 'left', display: 'inline-block', marginBottom: 8 }}>// Built &amp; operated by</p>
          <h3>Gabriel Aloho · Founder, Gue Cyber</h3>
          <p>GueInsight isn't a white-labelled tool — it was designed and built from scratch by a cybersecurity professional with 15+ years of experience. MSc in Information Security &amp; Digital Forensics (University of East London). VDAB Cybersecurity certified. Registered enterprise in Belgium. When you subscribe to Enterprise Elite, you get Gabriel directly as your vCISO.</p>
        </div>
        <div className="lp__built-links">
          <a href="https://www.guecyber.com" target="_blank" rel="noreferrer" className="lp__btn lp__btn--ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconShieldCheck size={16} /> Visit Gue Cyber
          </a>
          <a href="https://www.gabrielaloho.com" target="_blank" rel="noreferrer" className="lp__btn lp__btn--ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconUser size={16} /> gabrielaloho.com
          </a>
        </div>
      </div>

      {/* ══════════ FAQ ══════════ */}
      <div className="lp__section--alt">
        <section className="lp__section-inner">
          <div className="lp__section-head">
            <span className="lp__section-eyebrow">// FAQ</span>
            <h2>Common Questions</h2>
          </div>
          <div className="lp__faq">
            {FAQS.map((faq, i) => (
              <div className={`lp__faq-item ${openFaq === i ? 'lp__faq-item--open' : ''}`} key={i}>
                <button className="lp__faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <span className="lp__faq-chevron">▼</span>
                </button>
                {openFaq === i && <p className="lp__faq-a">{faq.a}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ══════════ FINAL CTA ══════════ */}
      <div className="lp__final-cta">
        <div className="lp__final-cta-sparkle">
          <IconAsterisk size={42} color="#ffffff" className="lp__sparkle" />
        </div>
        <h2>Your people are out there.<br />Give them a place to land.</h2>
        <div className="lp__hero-actions">
          <Link to="/subscription" className="lp__btn lp__btn--primary">Make yourself at home →</Link>
          <Link to="/support" className="lp__btn lp__btn--ghost">Talk to Gue Cyber</Link>
        </div>
        <p className="lp__final-cta-note">Secure communications start with a hello.</p>
      </div>

      {showTrialModal && (
        <TrialModal
          onConfirm={() => { setShowTrialModal(false); window.location.href = '/subscription'; }}
          onCancel={() => setShowTrialModal(false)}
        />
      )}
    </div>
  );
}
