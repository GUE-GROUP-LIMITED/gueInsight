import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import {
  IconShield,
  IconClipboard,
  IconSearch,
  IconDatabase,
  IconHeart,
  IconBank,
  IconGlobe,
  IconSettings,
  IconTrendingUp,
  IconCheckCircle,
  IconArrowRight,
  IconBook,
  IconBarChart,
} from '../components/Icons';
import './Resources.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const industryUseCases = [
  {
    icon: <IconHeart size={22} />,
    title: 'Healthcare',
    body: 'Track audit evidence, data-subject requests, and incident response steps for regulated patient data workflows.',
  },
  {
    icon: <IconBank size={22} />,
    title: 'Finance',
    body: 'Map access controls and tenant drift across Microsoft 365 and Google Workspace for audit-ready reporting.',
  },
  {
    icon: <IconGlobe size={22} />,
    title: 'Public Sector',
    body: 'Use EU residency, export/delete workflows, and incident summaries to support procurement and oversight requirements.',
  },
  {
    icon: <IconSettings size={22} />,
    title: 'Manufacturing',
    body: 'Combine threat intelligence and compliance workflows to protect distributed plants, vendors, and service accounts.',
  },
];

const comparisonRows = [
  ['Compliance automation', 'Yes', 'Yes', 'No'],
  ['Threat intelligence triage', 'Yes', 'Limited', 'Usually separate tool'],
  ['EU-only data residency', 'Elite tier', 'Depends on deployment', 'Depends on vendor'],
  ['vCISO guidance', 'Built in', 'No', 'No'],
  ['Public pricing', 'Yes', 'Yes', 'No'],
];

const thoughtLeadership = [
  {
    icon: <IconClipboard size={22} />,
    title: 'NIS2 readiness for Belgian SMEs',
    body: 'Short, practical guidance on incident reporting, evidence collection, and control ownership.',
  },
  {
    icon: <IconDatabase size={22} />,
    title: 'GDPR operations that scale',
    body: 'How to keep export, deletion, and audit workflows usable without a full security team.',
  },
  {
    icon: <IconShield size={22} />,
    title: 'Security operations without SIEM sprawl',
    body: 'Where GueInsight fits alongside existing EDR and cloud security tooling.',
  },
];

export default function Resources() {
  const pageRef = useRef(null);
  const [hoursSaved, setHoursSaved] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(85);
  const [auditReduction, setAuditReduction] = useState(35);

  const roi = useMemo(() => {
    const savedPerMonth = Math.max(0, Number(hoursSaved) * Number(hourlyRate));
    const annualValue = savedPerMonth * 12;
    const adjusted = annualValue * (Math.max(0, Math.min(100, Number(auditReduction))) / 100);
    return Math.round(adjusted);
  }, [auditReduction, hoursSaved, hourlyRate]);

  // Bounce ROI value whenever calculation changes
  useEffect(() => {
    gsap.fromTo(
      '.resources-page__roi-result-value',
      { scale: 0.82, opacity: 0.7 },
      { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.5)' }
    );
  }, [roi]);

  // Scrubbed Scroll Animations across every section
  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Hero stats scrubbed stagger
      const statCards = gsap.utils.toArray('.resources-page__stat-card');
      statCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { y: 35 + idx * 12, opacity: 0.4, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              end: 'top 55%',
              scrub: 1.25,
            },
          }
        );
      });

      // 2. Industry Use Cases section
      gsap.fromTo(
        '.resources-page__section--white:first-of-type .resources-page__section-head',
        { y: 28, opacity: 0.35 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.resources-page__section--white:first-of-type',
            start: 'top 88%',
            end: 'top 58%',
            scrub: 1.1,
          },
        }
      );

      const industryCards = gsap.utils.toArray('.resources-page__grid:not(.resources-page__grid--narrow) .resources-page__card');
      industryCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { y: 38 + (idx % 2) * 16, opacity: 0.35, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 93%',
              end: 'top 52%',
              scrub: 1.25,
            },
          }
        );
      });

      // 3. Comparison Table reveal
      gsap.fromTo(
        '.resources-page__table-wrap',
        { y: 38, opacity: 0.35, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.resources-page__table-wrap',
            start: 'top 90%',
            end: 'top 52%',
            scrub: 1.25,
          },
        }
      );

      // 4. ROI Calculator section
      gsap.fromTo(
        '.resources-page__roi-wrap',
        { y: 40, opacity: 0.4, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.resources-page__roi-wrap',
            start: 'top 90%',
            end: 'top 55%',
            scrub: 1.25,
          },
        }
      );

      // 5. Thought Leadership section
      const thoughtCards = gsap.utils.toArray('.resources-page__grid--narrow .resources-page__card');
      thoughtCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { y: 36 + (idx % 3) * 14, opacity: 0.35, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              end: 'top 55%',
              scrub: 1.25,
            },
          }
        );
      });

      // Hover feedback on cards (scale & elevation without vertical jump)
      const allCards = gsap.utils.toArray('.resources-page__card');
      allCards.forEach((card) => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            scale: 1.02,
            duration: 0.3,
            ease: 'back.out(2)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08)',
            borderColor: '#E8490A',
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            scale: 1,
            duration: 0.25,
            ease: 'power2.out',
            boxShadow: 'none',
            borderColor: '#E8E4DF',
          });
        });
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef}>
      <PublicHeader
        featureTo="/#features"
        howTo="/docs#getting-started"
        whoTo="/#who"
        pricingTo="/subscription"
        resourcesTo="/resources"
        statusTo="/status"
        trialTo="/subscription"
      />

      <main className="resources-page">

        {/* ══ HERO ══ */}
        <div className="resources-page__inner">
          <section className="resources-page__hero">
            <div className="resources-page__hero-left">
              <span className="resources-page__hero-badge">
                <IconBook size={14} />
                Growth &amp; distribution
              </span>
              <h1>Resources that help you <em>understand</em> the product fast</h1>
              <p className="resources-page__hero-lead">
                This page is intentionally practical: use cases, a competitor snapshot, an ROI calculator,
                and editorial topics you can turn into a blog or newsletter cadence.
              </p>
              <div className="resources-page__hero-actions">
                <Link to="/subscription" className="resources-page__btn resources-page__btn--primary">
                  See pricing
                  <IconArrowRight size={16} />
                </Link>
                <Link to="/support" className="resources-page__btn resources-page__btn--ghost">
                  Talk to sales
                </Link>
              </div>
            </div>

            {/* Hero stats */}
            <div className="resources-page__hero-stats">
              <div className="resources-page__stat-card">
                <div className="resources-page__stat-icon">
                  <IconShield size={22} />
                </div>
                <div className="resources-page__stat-num">€10M</div>
                <div className="resources-page__stat-label">Max NIS2 fine for Belgian critical sector non-compliance</div>
              </div>
              <div className="resources-page__stat-card">
                <div className="resources-page__stat-icon">
                  <IconBarChart size={22} />
                </div>
                <div className="resources-page__stat-num">72h</div>
                <div className="resources-page__stat-label">NIS2 incident reporting window</div>
              </div>
              <div className="resources-page__stat-card">
                <div className="resources-page__stat-icon">
                  <IconDatabase size={22} />
                </div>
                <div className="resources-page__stat-num">100%</div>
                <div className="resources-page__stat-label">EU data residency on Elite tier</div>
              </div>
            </div>
          </section>
        </div>

        {/* ══ INDUSTRY USE CASES ══ */}
        <div className="resources-page__section--white">
          <section className="resources-page__inner resources-page__section">
            <div className="resources-page__section-head">
              <span className="resources-page__eyebrow">
                <IconGlobe size={13} />
                Industry use cases
              </span>
              <h2>Landing pages you can tailor by vertical</h2>
            </div>
            <div className="resources-page__grid">
              {industryUseCases.map((item) => (
                <article key={item.title} className="resources-page__card">
                  <div className="resources-page__card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* ══ COMPARISON TABLE ══ */}
        <div className="resources-page__inner">
          <section className="resources-page__section">
            <div className="resources-page__section-head">
              <span className="resources-page__eyebrow">
                <IconSearch size={13} />
                Comparison snapshot
              </span>
              <h2>Positioning against the tools buyers already know</h2>
            </div>
            <div className="resources-page__table-wrap">
              <table className="resources-page__table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>GueInsight</th>
                    <th>Compliance-only platform</th>
                    <th>Generic MSSP stack</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>
                        <span className="resources-page__table-yes">
                          <IconCheckCircle size={14} color="#16a34a" />
                          {row[1]}
                        </span>
                      </td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ══ ROI CALCULATOR ══ */}
        <div className="resources-page__section--white">
          <section className="resources-page__inner resources-page__section">
            <div className="resources-page__section-head resources-page__section-head--center">
              <span className="resources-page__eyebrow">
                <IconTrendingUp size={13} />
                ROI calculator
              </span>
              <h2>Show the value in minutes, not just features</h2>
              <p>Adjust the inputs below to estimate the annual value GueInsight could deliver for your team.</p>
            </div>

            <div className="resources-page__roi-wrap">
              {/* Left — inputs */}
              <div className="resources-page__roi-left">
                <h3>Calculate your savings</h3>
                <p>Use this as a starting point for sales conversations with security buyers.</p>

                <div className="resources-page__roi-fields">
                  <div className="resources-page__roi-field">
                    <label htmlFor="roi-hours">Hours saved per month on security triage</label>
                    <div className="resources-page__roi-field-row">
                      <input
                        id="roi-hours"
                        type="range"
                        min="0"
                        max="40"
                        value={hoursSaved}
                        onChange={(e) => setHoursSaved(e.target.value)}
                      />
                      <span className="resources-page__roi-field-value">{hoursSaved}h</span>
                    </div>
                  </div>

                  <div className="resources-page__roi-field">
                    <label htmlFor="roi-rate">Average analyst hourly cost (€)</label>
                    <input
                      id="roi-rate"
                      type="number"
                      min="0"
                      step="5"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                  </div>

                  <div className="resources-page__roi-field">
                    <label htmlFor="roi-audit">Audit prep time reduction (%)</label>
                    <input
                      id="roi-audit"
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={auditReduction}
                      onChange={(e) => setAuditReduction(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Right — result */}
              <div className="resources-page__roi-result">
                <span className="resources-page__roi-result-label">Estimated annual value</span>
                <div className="resources-page__roi-result-value">
                  €{roi.toLocaleString()}
                </div>
                <span className="resources-page__roi-result-note">
                  Use this as a rough sales conversation starter — not a guaranteed figure.
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ══ THOUGHT LEADERSHIP ══ */}
        <div className="resources-page__inner">
          <section className="resources-page__section">
            <div className="resources-page__section-head">
              <span className="resources-page__eyebrow">
                <IconBook size={13} />
                Thought leadership
              </span>
              <h2>Topics to publish regularly</h2>
            </div>
            <div className="resources-page__grid resources-page__grid--narrow">
              {thoughtLeadership.map((item) => (
                <article key={item.title} className="resources-page__card">
                  <div className="resources-page__card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

      </main>
      {/* <Footer /> */}
    </div>
  );
}