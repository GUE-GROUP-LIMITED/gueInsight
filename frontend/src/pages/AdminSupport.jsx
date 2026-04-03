import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './AdminSupport.css';

const statusOptions = [
  { value: 'all', label: 'All tickets' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_on_user', label: 'Waiting on user' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_user: 'Waiting on user',
  resolved: 'Resolved',
  closed: 'Closed',
};

const formatDateTime = (isoDate) => {
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const AdminSupport = () => {
  const { user } = useContext(AuthContext);
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    status: 'open',
    resolution_summary: '',
    assigned_admin_id: '',
  });

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/support_tickets');
      const loadedTickets = Array.isArray(response.data?.tickets) ? response.data.tickets : [];
      setTickets(loadedTickets);
      setSelectedTicketId((current) => current || loadedTickets[0]?.id || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTicketDetail = useCallback(async (ticketId) => {
    if (!ticketId) return;
    try {
      setDetailLoading(true);
      const response = await api.get(`/admin/support_tickets/${ticketId}`);
      const ticket = response.data?.ticket || null;
      setSelectedTicket(ticket);
      setTicketForm({
        status: ticket?.status || 'open',
        resolution_summary: ticket?.resolution_summary || '',
        assigned_admin_id: ticket?.assigned_admin_id ? String(ticket.assigned_admin_id) : '',
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load the selected ticket.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    }
  }, [loadTicketDetail, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => statusFilter === 'all' || ticket.status === statusFilter);
  }, [statusFilter, tickets]);

  const selectedTicketSummary = useMemo(() => {
    if (!selectedTicket) return null;
    return [
      { label: 'Requester', value: selectedTicket.user_name || selectedTicket.user_email || 'Unknown user' },
      { label: 'Assigned staff', value: selectedTicket.assigned_admin_email || 'Unassigned' },
      { label: 'Attended by', value: selectedTicket.attended_by_email || 'Not attended yet' },
      { label: 'Created', value: formatDateTime(selectedTicket.created_at) },
    ];
  }, [selectedTicket]);

  const ticketStats = useMemo(() => {
    const openCount = tickets.filter((ticket) => ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status)).length;
    const resolvedCount = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length;
    return [
      { label: 'Open queue', value: String(openCount), detail: 'Tickets needing attention' },
      { label: 'Completed', value: String(resolvedCount), detail: 'Resolved or closed cases' },
      { label: 'Total tickets', value: String(tickets.length), detail: 'Subscriber support requests' },
    ];
  }, [tickets]);

  const handleSelectTicket = (ticketId) => {
    setSelectedTicketId(ticketId);
    setMessage('');
    setError('');
  };

  const handleTakeTicket = async () => {
    if (!selectedTicket || !user?.id) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await api.patch(`/admin/support_tickets/${selectedTicket.id}`, {
        assigned_admin_id: user.id,
        status: 'in_progress',
      });
      setSelectedTicket(response.data?.ticket || selectedTicket);
      setTicketForm({
        status: response.data?.ticket?.status || 'in_progress',
        resolution_summary: response.data?.ticket?.resolution_summary || '',
        assigned_admin_id: response.data?.ticket?.assigned_admin_id ? String(response.data.ticket.assigned_admin_id) : String(user.id),
      });
      setMessage('Ticket assigned to you and marked in progress.');
      await loadTickets();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to take ownership of the ticket.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTicket = async (event) => {
    event.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await api.patch(`/admin/support_tickets/${selectedTicket.id}`, {
        status: ticketForm.status,
        resolution_summary: ticketForm.resolution_summary,
        assigned_admin_id: ticketForm.assigned_admin_id ? Number(ticketForm.assigned_admin_id) : null,
      });
      setSelectedTicket(response.data?.ticket || selectedTicket);
      setMessage('Ticket updated successfully.');
      await loadTickets();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to update the ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-support-shell">
      <aside className="admin-support-shell__sidebar">
        <div className="admin-support-shell__brand">
          <div className="admin-support-shell__brand-mark">GI</div>
          <div className="admin-support-shell__brand-copy">
            <strong>GueInsight</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-support-shell__nav" aria-label="Admin support navigation">
          <Link to="/admin" className="admin-support-shell__nav-link">Dashboard</Link>
          <Link to="/admin/support" className="admin-support-shell__nav-link is-active">Support queue</Link>
          <Link to="/admin/users" className="admin-support-shell__nav-link">Subscribers</Link>
          <Link to="/admin/profile" className="admin-support-shell__nav-link">Profile</Link>
        </nav>

        <div className="admin-support-shell__sidebar-card">
          <p className="admin-support-shell__sidebar-label">Support policy</p>
          <h3>Track every handoff</h3>
          <p>Assigned staff, first attendance, and resolution timestamps are recorded on each ticket.</p>
          <Link to="/admin" className="admin-support-shell__sidebar-action">Back to dashboard</Link>
        </div>
      </aside>

      <main className="admin-support-shell__content">
        <header className="admin-support-shell__topbar">
          <div>
            <p className="admin-support-shell__eyebrow">Service Desk</p>
            <h1>Support queue</h1>
          </div>

          <AdminTopbarControls
            searchPlaceholder="Search support"
            searchAriaLabel="Search support tickets"
            primaryActionHref="/admin/users"
            primaryActionLabel="Manage users"
            onToggleSidebar={undefined}
          />
        </header>

        <section className="admin-support-shell__stats">
          {ticketStats.map((stat) => (
            <article key={stat.label} className="admin-support-shell__stat-card">
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span>{stat.detail}</span>
            </article>
          ))}
        </section>

        <section className="admin-support-shell__layout">
          <article className="admin-support-shell__card admin-support-shell__queue-card">
            <div className="admin-support-shell__card-head">
              <div>
                <p className="admin-support-shell__section-label">Tickets</p>
                <h2>Queue list</h2>
              </div>

              <label className="admin-support-shell__filter">
                <span className="sr-only">Filter tickets</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? <p className="admin-support-shell__hint">Loading tickets...</p> : null}
            {error ? <p className="admin-support-shell__hint admin-support-shell__hint--error">{error}</p> : null}

            <div className="admin-support-shell__queue-list">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`admin-support-shell__queue-item ${selectedTicketId === ticket.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectTicket(ticket.id)}
                >
                  <div>
                    <strong>{ticket.subject}</strong>
                    <p>{ticket.user_name || ticket.user_email}</p>
                  </div>
                  <span className={`admin-support-shell__status admin-support-shell__status--${ticket.status}`}>
                    {statusLabels[ticket.status] || ticket.status}
                  </span>
                </button>
              ))}

              {!loading && filteredTickets.length === 0 ? (
                <p className="admin-support-shell__hint">No tickets match the current filter.</p>
              ) : null}
            </div>
          </article>

          <article className="admin-support-shell__card admin-support-shell__detail-card">
            <div className="admin-support-shell__card-head">
              <div>
                <p className="admin-support-shell__section-label">Ticket detail</p>
                <h2>{selectedTicket ? selectedTicket.subject : 'Select a ticket'}</h2>
              </div>
            </div>

            {detailLoading ? <p className="admin-support-shell__hint">Loading ticket...</p> : null}

            {selectedTicket ? (
              <>
                <dl className="admin-support-shell__detail-grid">
                  {selectedTicketSummary?.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Priority</dt>
                    <dd>{priorityLabels[selectedTicket.priority] || selectedTicket.priority}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{statusLabels[selectedTicket.status] || selectedTicket.status}</dd>
                  </div>
                </dl>

                <section className="admin-support-shell__detail-body">
                  <h3>Description</h3>
                  <p>{selectedTicket.description}</p>
                </section>

                <form className="admin-support-shell__form" onSubmit={handleSaveTicket}>
                  <div className="admin-support-shell__grid">
                    <label>
                      <span>Status</span>
                      <select value={ticketForm.status} onChange={(event) => setTicketForm((current) => ({ ...current, status: event.target.value }))}>
                        {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Assigned admin id</span>
                      <input
                        type="number"
                        value={ticketForm.assigned_admin_id}
                        onChange={(event) => setTicketForm((current) => ({ ...current, assigned_admin_id: event.target.value }))}
                        placeholder="Leave blank to unassign"
                      />
                    </label>
                  </div>

                  <label>
                    <span>Resolution summary</span>
                    <textarea
                      rows="5"
                      value={ticketForm.resolution_summary}
                      onChange={(event) => setTicketForm((current) => ({ ...current, resolution_summary: event.target.value }))}
                      placeholder="Describe what was done and who attended the ticket."
                    />
                  </label>

                  {message ? <p className="admin-support-shell__hint admin-support-shell__hint--success">{message}</p> : null}
                  {error ? <p className="admin-support-shell__hint admin-support-shell__hint--error">{error}</p> : null}

                  <div className="admin-support-shell__actions">
                    <button type="button" className="admin-support-shell__button admin-support-shell__button--ghost" onClick={handleTakeTicket} disabled={saving}>
                      Take ticket
                    </button>
                    <button type="submit" className="admin-support-shell__button admin-support-shell__button--primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="admin-support-shell__hint">Pick a ticket from the queue to inspect user details and update its status.</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
};

export default AdminSupport;
