import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './Support.css';
import { useTranslation } from '../i18n/index';

const categories = [
  { value: 'Account access', key: 'account_access' },
  { value: 'Billing', key: 'billing' },
  { value: 'Subscription', key: 'subscription' },
  { value: 'Analysis issue', key: 'analysis_issue' },
  { value: 'Security incident', key: 'security_incident' },
  { value: 'General question', key: 'general_question' },
];

const priorities = [
  { value: 'low', key: 'low' },
  { value: 'medium', key: 'medium' },
  { value: 'high', key: 'high' },
  { value: 'urgent', key: 'urgent' },
];

const statusKeys = {
  open: 'open',
  in_progress: 'in_progress',
  waiting_on_user: 'waiting_on_user',
  resolved: 'resolved',
  closed: 'closed',
};

const formatDateTime = (isoDate) => {
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const Support = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0].value);
  const [priority, setPriority] = useState('medium');

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/support_tickets');
      setTickets(Array.isArray(response.data?.tickets) ? response.data.tickets : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('support.load_failed'));
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
      { label: t('support.open_tickets'), value: String(openCount), detail: t('support.open_tickets_detail') },
      { label: t('support.resolved_tickets'), value: String(resolvedCount), detail: t('support.resolved_tickets_detail') },
      { label: t('support.my_queue'), value: String(tickets.length), detail: t('support.my_queue_detail') },
    ];
  }, [tickets, t]);

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
      setCategory(categories[0].value);
      setPriority('medium');
      setMessage(t('support.ticket_created'));
      await loadTickets();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('support.create_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="support-page">
      <section className="support-page__hero">
        <div>
          <p className="support-page__eyebrow">{t('support.eyebrow')}</p>
          <h1>{t('support.title')}</h1>
          <p>{t('support.lead')}</p>
        </div>
        <div className="support-page__hero-actions">
          <Link to="/dashboard" className="support-page__button support-page__button--ghost">
            {t('support.back_to_dashboard')}
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
              <p className="support-page__section-label">{t('support.new_request')}</p>
              <h2>{t('support.create_ticket')}</h2>
            </div>
          </div>

          <form className="support-page__form" onSubmit={handleSubmit}>
            <label>
              <span>{t('support.subject')}</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={t('support.subject_placeholder')}
                required
              />
            </label>

            <label>
              <span>{t('support.description')}</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('support.description_placeholder')}
                rows="6"
                required
              />
            </label>

            <div className="support-page__grid">
              <label>
                <span>{t('support.category')}</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(`support.${item.key}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t('support.priority')}</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  {priorities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(`support.${item.key}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="support-page__message support-page__message--error">{error}</p> : null}
            {message ? <p className="support-page__message support-page__message--success">{message}</p> : null}

            <button type="submit" className="support-page__button support-page__button--primary" disabled={submitting}>
              {submitting ? t('support.submitting') : t('support.submit_ticket')}
            </button>
          </form>
        </article>

        <article className="support-page__card support-page__card--tickets">
          <div className="support-page__card-head">
            <div>
              <p className="support-page__section-label">{t('support.your_queue')}</p>
              <h2>{t('support.ticket_history')}</h2>
            </div>
          </div>

          {loading ? <p className="support-page__hint">{t('support.loading_tickets')}</p> : null}

          <div className="support-page__ticket-list">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="support-page__ticket-card">
                <div className="support-page__ticket-top">
                  <div>
                    <strong>{ticket.subject}</strong>
                    <p>{ticket.category || 'General'}</p>
                  </div>
                  <span className={`support-page__status support-page__status--${ticket.status}`}>
                    {t(`support.${statusKeys[ticket.status] || ticket.status}`)}
                  </span>
                </div>

                <p className="support-page__ticket-description">{ticket.description}</p>

                <dl className="support-page__ticket-meta">
                  <div>
                    <dt>{t('support.priority_label')}</dt>
                    <dd>{ticket.priority}</dd>
                  </div>
                  <div>
                    <dt>{t('support.assigned_staff')}</dt>
                    <dd>{ticket.assigned_admin_email || 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt>{t('support.attended_by')}</dt>
                    <dd>{ticket.attended_by_email || 'Not attended yet'}</dd>
                  </div>
                  <div>
                    <dt>{t('support.created')}</dt>
                    <dd>{formatDateTime(ticket.created_at)}</dd>
                  </div>
                </dl>

                {ticket.resolution_summary ? (
                  <div className="support-page__resolution">
                    <span>{t('support.resolution')}</span>
                    <p>{ticket.resolution_summary}</p>
                  </div>
                ) : null}
              </article>
            ))}

            {!loading && tickets.length === 0 ? (
              <p className="support-page__hint">{t('support.no_tickets')}</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="support-page__footer-note">
          <p>{t('support.footer_note')}</p>
      </section>
    </main>
  );
};

export default Support;
