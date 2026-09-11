import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}
import {
  IconActivity,
  IconServer,
  IconCreditCard,
  IconBook,
  IconShieldCheck,
  IconCheckCircle,
  IconInfo,
  IconMail,
  IconCalendar,
} from '../components/Icons';
import './Status.css';

const now = new Date();
const formatTime = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
const formatDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Brussels' });

const services = [
  {
    icon: <IconActivity size={22} />,
    name: 'Web App',
    status: 'Operational',
    statusType: 'ok',
    detail: 'Public dashboard and landing pages',
    uptime: 99.98,
  },
  {
    icon: <IconServer size={22} />,
    name: 'API',
    status: 'Operational',
    statusType: 'ok',
    detail: 'Core platform endpoints and auth',
    uptime: 99.95,
  },
  {
    icon: <IconCreditCard size={22} />,
    name: 'Billing',
    status: 'Operational',
    statusType: 'ok',
    detail: 'Subscription and invoice flows',
    uptime: 99.99,
  },
  {
    icon: <IconBook size={22} />,
    name: 'Documentation',
    status: 'Operational',
    statusType: 'ok',
    detail: 'Public help and onboarding guides',
    uptime: 100,
  },
];

const updates = [
  {
    time: formatDate(now),
    timeType: 'ok',
    timeLabel: 'No incidents',
    icon: <IconCheckCircle size={16} />,
    title: 'All systems operational',
    body: 'No active incidents. Planned maintenance and incident updates will appear here as they occur.',
  },
  {
    time: 'Monitoring',
    timeType: 'info',
    timeLabel: 'Health checks',
    icon: <IconActivity size={16} />,
    title: 'Health checks enabled',
    body: 'The status page is ready to be connected to your uptime monitor or incident workflow. Automated alerts are configured for API and billing endpoints.',
  },
  {
    time: 'Support',
    timeType: 'support',
    timeLabel: 'Help',
    icon: <IconInfo size={16} />,
    title: 'Need help with an urgent issue?',
    body: 'Open a support ticket for urgent issues while this page is connected to a live monitoring feed. Response time is typically within 2 business hours.',
  },
];

const pillClass = {
  ok: 'status-page__pill status-page__pill--ok',
  degraded: 'status-page__pill status-page__pill--degraded',
  incident: 'status-page__pill status-page__pill--incident',
};

const feedTimeClass = {
  ok: 'status-page__feed-time-type status-page__feed-time-type--ok',
  info: 'status-page__feed-time-type status-page__feed-time-type--info',
  support: 'status-page__feed-time-type status-page__feed-time-type--support',
};

export default function Status() {
  const statusRef = useRef(null);
  const allOk = services.every((s) => s.statusType === 'ok');

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Hero live status badge bounce
      gsap.from('.status-page__hero-badge', {
        scale: 0.65,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(2.5)',
        delay: 0.1,
      });

      // Overall status card reveal
      gsap.fromTo(
        '.status-page__overall',
        { y: 30, opacity: 0.5, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.85,
          ease: 'power2.out',
        }
      );

      // 2. Scrubbed service cards reveal with staggered wave
      const serviceCards = gsap.utils.toArray('.status-page__card');
      serviceCards.forEach((card, idx) => {
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
              end: 'top 55%',
              scrub: 1.25,
            },
          }
        );

        // Uptime bar fill scrubbed expansion
        const uptimeFill = card.querySelector('.status-page__uptime-fill');
        if (uptimeFill) {
          gsap.fromTo(
            uptimeFill,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                end: 'top 52%',
                scrub: 1.25,
              },
            }
          );
        }
      });

      // 3. Scrubbed Incident & maintenance feed
      gsap.fromTo(
        '.status-page__feed-head',
        { y: 28, opacity: 0.35 },
        {
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.status-page__feed-section',
            start: 'top 88%',
            end: 'top 58%',
            scrub: 1.1,
          },
        }
      );

      const feedItems = gsap.utils.toArray('.status-page__feed-item');
      feedItems.forEach((item) => {
        gsap.fromTo(
          item,
          { y: 32, opacity: 0.35 },
          {
            y: 0,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 92%',
              end: 'top 60%',
              scrub: 1.2,
            },
          }
        );
      });

      // 4. Support CTA card scrub
      gsap.fromTo(
        '.status-page__subscribe',
        { scale: 0.93, y: 32, opacity: 0.6 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.status-page__subscribe',
            start: 'top 92%',
            end: 'center 60%',
            scrub: 1.2,
          },
        }
      );

      // Hover feedback on service cards
      serviceCards.forEach((card) => {
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
    }, statusRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={statusRef}>
      <PublicHeader
        featureTo="/#features"
        howTo="/docs#getting-started"
        whoTo="/#who"
        pricingTo="/subscription"
        resourcesTo="/resources"
        statusTo="/status"
        trialTo="/subscription"
      />

      <main className="status-page">
        {/* ══ HERO ══ */}
        <div className="status-page__inner">
          <section className="status-page__hero">
            {/* Live status badge */}
            <div className={`status-page__hero-badge ${allOk ? 'status-page__hero-badge--all-ok' : 'status-page__hero-badge--incident'}`}>
              <span className="status-page__hero-badge-dot" />
              {allOk ? 'All systems operational' : 'Active incident'}
            </div>

            <h1>Service health and<br />incident updates</h1>
            <p className="status-page__hero-lead">
              This page gives customers and prospects a single place to check service status,
              view maintenance notices, and find the latest operational update.
            </p>

            {/* Overall status panel */}
            <div className="status-page__overall">
              <span className="status-page__overall-label">Current platform status</span>
              <span className="status-page__overall-status">
                <IconCheckCircle size={28} color="#16a34a" strokeWidth={2.5} />
                All Systems Operational
              </span>
              <span className="status-page__overall-updated">
                Last checked: {formatTime(now)} CET · {formatDate(now)}
              </span>
            </div>
          </section>

          {/* ══ SERVICE GRID ══ */}
          <div className="status-page__grid">
            {services.map((service) => (
              <article key={service.name} className="status-page__card">
                <div className="status-page__card-top">
                  <div className="status-page__card-icon">{service.icon}</div>
                  <span className={pillClass[service.statusType] || pillClass.ok}>
                    <span className="status-page__pill-dot" />
                    {service.status}
                  </span>
                </div>
                <h2>{service.name}</h2>
                <p>{service.detail}</p>

                {/* Uptime bar */}
                <div className="status-page__uptime-bar">
                  <div className="status-page__uptime-label">
                    <span>30-day uptime</span>
                    <span>{service.uptime}%</span>
                  </div>
                  <div className="status-page__uptime-track">
                    <div
                      className="status-page__uptime-fill"
                      style={{ width: `${service.uptime}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ══ INCIDENT FEED ══ */}
        <div className="status-page__feed-section">
          <div className="status-page__inner">
            <div className="status-page__feed-head">
              <span className="status-page__eyebrow">
                <IconCalendar size={13} />
                Incident &amp; maintenance log
              </span>
              <h2>Latest platform updates</h2>
            </div>

            <div className="status-page__feed">
              {updates.map((update) => (
                <article key={update.title} className="status-page__feed-item">
                  <div className="status-page__feed-time">
                    <span className={feedTimeClass[update.timeType]}>
                      {update.icon}
                      {update.timeLabel}
                    </span>
                    <span>{update.time}</span>
                  </div>
                  <div className="status-page__feed-content">
                    <h3>{update.title}</h3>
                    <p>{update.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* ══ SUBSCRIBE / SUPPORT CTA ══ */}
        <div className="status-page__inner">
          <section className="status-page__subscribe">
            <span className="status-page__eyebrow">
              <IconMail size={13} />
              Stay informed
            </span>
            <h2>Need to report an incident?</h2>
            <p>Open a support ticket and the Gue Cyber team will respond promptly.</p>
            <Link to="/support" className="resources-page__btn resources-page__btn--primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: '100px', background: '#E8490A', color: '#fff', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
              <IconShieldCheck size={16} />
              Open a support ticket
            </Link>
          </section>
        </div>

      </main>
      <Footer />
    </div>
  );
}