import PublicHeader from '../components/PublicHeader';
import './Status.css';

const services = [
  { name: 'Web app', status: 'Operational', detail: 'Public dashboard and landing pages' },
  { name: 'API', status: 'Operational', detail: 'Core platform endpoints and auth' },
  { name: 'Billing', status: 'Operational', detail: 'Subscription and invoice flows' },
  { name: 'Documentation', status: 'Operational', detail: 'Public help and onboarding guides' },
];

const updates = [
  { time: 'Current', title: 'No active incidents', body: 'Planned maintenance and incident updates will be posted here.' },
  { time: 'Monitoring', title: 'Health checks enabled', body: 'The status page is ready to be connected to your uptime monitor or incident workflow.' },
  { time: 'Support', title: 'Need help?', body: 'Open a support ticket for urgent issues while this page is connected to a live monitoring feed.' },
];

export default function Status() {
  return (
    <>
      <PublicHeader featureTo="/#features" howTo="/docs#getting-started" whoTo="/#who" pricingTo="/subscription" resourcesTo="/resources" statusTo="/status" trialTo="/signup" />
      <main className="status-page">
        <section className="status-page__hero">
          <p className="status-page__eyebrow">Public status</p>
          <h1>Service health and incident updates</h1>
          <p>
            This page exists for customers and prospects who want a single place to check service status,
            view maintenance notices, and find the latest operational update.
          </p>
        </section>

        <section className="status-page__grid">
          {services.map((service) => (
            <article key={service.name} className="status-page__card">
              <span className="status-page__pill">{service.status}</span>
              <h2>{service.name}</h2>
              <p>{service.detail}</p>
            </article>
          ))}
        </section>

        <section className="status-page__feed">
          {updates.map((update) => (
            <article key={update.title} className="status-page__feed-item">
              <span>{update.time}</span>
              <h3>{update.title}</h3>
              <p>{update.body}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}