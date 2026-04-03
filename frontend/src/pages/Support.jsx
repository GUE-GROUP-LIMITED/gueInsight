import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './Support.css';

const categories = [
  'Account access',
  'Billing',
  'Subscription',
  'Analysis issue',
  'Security incident',
  'General question',
];

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_user: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

const formatDateTime = (isoDate) => {
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [priority, setPriority] = useState('medium');

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/support_tickets');
      setTickets(Array.isArray(response.data?.tickets) ? response.data.tickets : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load your tickets right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const ticketStats = useMemo(() => {
    const openCount = tickets.filter((ticket) => ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status)).length;
    const resolvedCount = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length;
    return [
      { label: 'Open tickets', value: String(openCount), detail: 'Requests awaiting staff attention' },
      { label: 'Resolved tickets', value: String(resolvedCount), detail: 'Completed support cases' },
      { label: 'My queue', value: String(tickets.length), detail: 'All support requests you opened' },
    ];
  }, [tickets]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await api.post('/support_tickets', {
        subject,
        description,
        category,
        priority,
      });
      setSubject('');
      setDescription('');
      setCategory(categories[0]);
      setPriority('medium');
      setMessage('Support ticket created.');
      await loadTickets();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to create a support ticket right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="support-page">
      <section className="support-page__hero">
        <div>
          <p className="support-page__eyebrow">Support Desk</p>
          <h1>Open a support ticket</h1>
          <p>
            Use this desk to request help, track the staff member assigned to your ticket, and follow resolution status.
          </p>
        </div>
        <div className="support-page__hero-actions">
          <Link to="/dashboard" className="support-page__button support-page__button--ghost">
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="support-page__stats">
        {ticketStats.map((stat) => (
          <article key={stat.label} className="support-page__stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span>{stat.detail}</span>
          </article>
        ))}
      </section>

      <section className="support-page__layout">
        <article className="support-page__card">
          <div className="support-page__card-head">
            <div>
              <p className="support-page__section-label">New request</p>
              <h2>Create a ticket</h2>
            </div>
          </div>

          <form className="support-page__form" onSubmit={handleSubmit}>
            <label>
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What do you need help with?"
                required
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the issue, what you expected, and what happened instead."
                rows="6"
                required
              />
            </label>

            <div className="support-page__grid">
              <label>
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  {priorities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="support-page__message support-page__message--error">{error}</p> : null}
            {message ? <p className="support-page__message support-page__message--success">{message}</p> : null}

            <button type="submit" className="support-page__button support-page__button--primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit ticket'}
            </button>
          </form>
        </article>

        <article className="support-page__card support-page__card--tickets">
          <div className="support-page__card-head">
            <div>
              <p className="support-page__section-label">Your queue</p>
              <h2>Ticket history</h2>
            </div>
          </div>

          {loading ? <p className="support-page__hint">Loading tickets...</p> : null}

          <div className="support-page__ticket-list">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="support-page__ticket-card">
                <div className="support-page__ticket-top">
                  <div>
                    <strong>{ticket.subject}</strong>
                    <p>{ticket.category || 'General'}</p>
                  </div>
                  <span className={`support-page__status support-page__status--${ticket.status}`}>
                    {statusLabels[ticket.status] || ticket.status}
                  </span>
                </div>

                <p className="support-page__ticket-description">{ticket.description}</p>

                <dl className="support-page__ticket-meta">
                  <div>
                    <dt>Priority</dt>
                    <dd>{ticket.priority}</dd>
                  </div>
                  <div>
                    <dt>Assigned staff</dt>
                    <dd>{ticket.assigned_admin_email || 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt>Attended by</dt>
                    <dd>{ticket.attended_by_email || 'Not attended yet'}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(ticket.created_at)}</dd>
                  </div>
                </dl>

                {ticket.resolution_summary ? (
                  <div className="support-page__resolution">
                    <span>Resolution</span>
                    <p>{ticket.resolution_summary}</p>
                  </div>
                ) : null}
              </article>
            ))}

            {!loading && tickets.length === 0 ? (
              <p className="support-page__hint">You have no support tickets yet.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="support-page__footer-note">
        <p>
          Support staff can mark who attended your ticket, when it was resolved, and what action was taken.
        </p>
      </section>
    </main>
  );
};

export default Support;
