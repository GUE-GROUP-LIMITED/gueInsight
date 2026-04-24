import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { api } from '../services/api';
import './AdminDashboard.css';

const sidebarItems = [
  { label: 'Home', href: '#dashboard', active: true, icon: 'home' },
  { label: 'Compliance', href: '/admin/compliance', icon: 'shield' },
  { label: 'Widgets', href: '#widgets', icon: 'widgets' },
  { label: 'Tables', href: '#tables', icon: 'table' },
  { label: 'Charts', href: '#charts', icon: 'chart' },
  { label: 'Support', href: '/admin/support', icon: 'logs' },
  { label: 'Users', href: '/admin/users', icon: 'users' },
];

const SidebarIcon = ({ type }) => {
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    );
  }

  if (type === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h5v8H3v-8Zm7 3h11v5H10v-5Z" />
      </svg>
    );
  }

  if (type === 'widgets') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm11 0h2v2h3v2h-3v3h-2v-3h-3v-2h3v-2Z" />
      </svg>
    );
  }

  if (type === 'table') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18v14H3V5Zm2 2v2h14V7H5Zm0 4v2h5v-2H5Zm7 0v2h7v-2h-7Zm-7 4v2h5v-2H5Zm7 0v2h7v-2h-7Z" />
      </svg>
    );
  }

  if (type === 'chart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V4h2v14h14v2H4Zm4-3V9h2v8H8Zm4 0V6h2v11h-2Zm4 0v-5h2v5h-2Z" />
      </svg>
    );
  }

  if (type === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13c-1.92-.72-3.77-2.5-4.83-4.66A6.88 6.88 0 0 1 12 13c1.83 0 3.53.72 4.83 2.34C15.77 17.5 13.92 19.28 12 20Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-9-1h8v-1a5 5 0 0 0-8 0v1Zm10 0h8v-1a5 5 0 0 0-8 0v1Z" />
    </svg>
  );
};

SidebarIcon.propTypes = {
  type: PropTypes.string.isRequired,
};

const normalizeRole = (roleLike) => {
  const raw = typeof roleLike === 'string' ? roleLike : roleLike?.value || roleLike || '';
  if (typeof raw !== 'string') return 'user';
  const normalized = raw.includes('.') ? raw.split('.').pop() : raw;
  return normalized.toLowerCase();
};

const toTitle = (value) => {
  if (!value) return 'User';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const nameFromUser = (user) => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.email) return user.email.split('@')[0];
  return 'Unknown user';
};

const initialsFromName = (name) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || 'GI';
};

const percent = (count, total) => {
  if (!total) return 0;
  return Math.round((count / total) * 100);
};

const AdminDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({ users: [], file_uploads: [], critical_alert: false });

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const subscribersResponse = await api.get('/admin_subscribers');
        if (!active) return;

        let fileUploads = [];
        let criticalAlert = false;

        try {
          const dashboardResponse = await api.get('/admin_dashboard');
          fileUploads = Array.isArray(dashboardResponse.data?.file_uploads) ? dashboardResponse.data.file_uploads : [];
          criticalAlert = Boolean(dashboardResponse.data?.critical_alert);
        } catch {
          fileUploads = [];
          criticalAlert = false;
        }

        setDashboardData({
          users: Array.isArray(subscribersResponse.data?.users) ? subscribersResponse.data.users : [],
          file_uploads: fileUploads,
          critical_alert: criticalAlert,
        });
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.error || 'Unable to load admin data right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const users = useMemo(() => {
    return dashboardData.users.map((user) => {
      const role = normalizeRole(user.role);
      const status = user.is_active ? 'Active' : 'Inactive';
      const name = nameFromUser(user);
      return {
        id: user.id,
        name,
        email: user.email || 'N/A',
        role,
        roleLabel: toTitle(role),
        status,
        badge: initialsFromName(name),
        plan: user.current_plan || 'Free',
      };
    });
  }, [dashboardData.users]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === 'Active').length;
  const adminUsers = users.filter((user) => user.role === 'admin').length;
  const paidUsers = users.filter((user) => (user.plan || '').toLowerCase() !== 'free').length;
  const uploadsCount = dashboardData.file_uploads.length;

  const statCards = useMemo(() => {
    return [
      { label: 'Registered accounts', value: totalUsers.toString(), detail: 'From the user table', tone: 'blue' },
      { label: 'Active users', value: activeUsers.toString(), detail: 'Can access platform', tone: 'green' },
      {
        label: 'Critical alerts',
        value: dashboardData.critical_alert ? '1' : '0',
        detail: dashboardData.critical_alert ? 'Action required' : 'No critical alert',
        tone: 'orange',
      },
      { label: 'File uploads', value: uploadsCount.toString(), detail: 'Analyzed submissions', tone: 'red' },
    ];
  }, [activeUsers, dashboardData.critical_alert, totalUsers, uploadsCount]);

  const activityItems = useMemo(() => {
    return [
      { title: 'Active accounts', value: percent(activeUsers, totalUsers), color: 'blue' },
      { title: 'Admin coverage', value: percent(adminUsers, totalUsers), color: 'green' },
      { title: 'Paid plans', value: percent(paidUsers, totalUsers), color: 'orange' },
      { title: 'Upload density', value: percent(uploadsCount, Math.max(totalUsers, 1)), color: 'red' },
    ];
  }, [activeUsers, adminUsers, paidUsers, totalUsers, uploadsCount]);

  const timelineItems = useMemo(() => {
    return [
      { title: 'Users loaded', time: 'Now', detail: `${totalUsers} account${totalUsers === 1 ? '' : 's'} in directory` },
      { title: 'Current sign-ins', time: 'Now', detail: `${activeUsers} active account${activeUsers === 1 ? '' : 's'}` },
      { title: 'Staff admins', time: 'Now', detail: `${adminUsers} admin account${adminUsers === 1 ? '' : 's'} configured` },
      { title: 'File ingestion', time: 'Now', detail: `${uploadsCount} upload event${uploadsCount === 1 ? '' : 's'} recorded` },
    ];
  }, [activeUsers, adminUsers, totalUsers, uploadsCount]);

  return (
    <div className={`admin-shell ${sidebarCollapsed ? 'admin-shell--collapsed' : ''}`} id="dashboard">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__brand">
          <div className="admin-shell__brand-mark">GI</div>
          <div className="admin-shell__brand-copy">
            <strong>GueInsight</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-shell__nav" aria-label="Admin sidebar">
          {sidebarItems.map((item) => (
            item.href.startsWith('/') ? (
              <Link
                key={item.label}
                to={item.href}
                aria-label={item.label}
                className={`admin-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="admin-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="admin-shell__nav-label">{item.label}</span>
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`admin-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="admin-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="admin-shell__nav-label">{item.label}</span>
              </a>
            )
          ))}
        </nav>

        <div className="admin-shell__sidebar-card">
          <p className="admin-shell__sidebar-label">Support</p>
          <h3>Need help?</h3>
          <p>Review dashboard logs, user sessions, and system activity from the admin console.</p>
          <a href="#tables" className="admin-shell__sidebar-action">Open tables</a>
        </div>
      </aside>

      <main className="admin-shell__content">
        <header className="admin-shell__topbar">
          <div>
            <p className="admin-shell__eyebrow">Dashboard</p>
            <h1>Admin dashboard</h1>
          </div>

          <AdminTopbarControls
            searchPlaceholder="Search"
            searchAriaLabel="Search admin dashboard"
            primaryActionHref="/admin/users"
            primaryActionLabel="Manage users"
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
        </header>

        <section className="admin-shell__stats" id="widgets">
          {statCards.map((card) => (
            <article key={card.label} className={`admin-shell__stat-card admin-shell__stat-card--${card.tone}`}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span>{card.detail}</span>
            </article>
          ))}
        </section>

        <section className="admin-shell__grid" id="charts">
          <article className="admin-shell__panel admin-shell__panel--chart">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">Performance</p>
                <h2>Traffic overview</h2>
              </div>
              <span className="admin-shell__chip">Live</span>
            </div>

            <div className="admin-shell__chart">
              <div className="admin-shell__chart-bars" aria-hidden="true">
                <span style={{ height: '42%' }} />
                <span style={{ height: '68%' }} />
                <span style={{ height: '54%' }} />
                <span style={{ height: '78%' }} />
                <span style={{ height: '61%' }} />
                <span style={{ height: '84%' }} />
                <span style={{ height: '47%' }} />
                <span style={{ height: '73%' }} />
              </div>
              <div className="admin-shell__chart-legend">
                <span><i className="is-blue" /> Total visits</span>
                <span><i className="is-green" /> Signups</span>
                <span><i className="is-orange" /> Alerts</span>
              </div>
            </div>
          </article>

          <article className="admin-shell__panel admin-shell__panel--activity">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">System status</p>
                <h2>Activity mix</h2>
              </div>
            </div>

            <div className="admin-shell__activity-list">
              {activityItems.map((item) => (
                <div key={item.title} className="admin-shell__activity-row">
                  <div className="admin-shell__activity-copy">
                    <span>{item.title}</span>
                    <strong>{item.value}%</strong>
                  </div>
                  <div className="admin-shell__activity-track">
                    <span className={`admin-shell__activity-fill is-${item.color}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="admin-shell__grid admin-shell__grid--bottom" id="tables">
          <article className="admin-shell__panel">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">Recent users</p>
                <h2>Subscriber list</h2>
              </div>
              <Link to="/admin/users" className="admin-shell__chip">View all</Link>
            </div>

            <div className="admin-shell__table-wrap">
              {loading ? <p className="admin-shell__feedback">Loading users...</p> : null}
              {error ? <p className="admin-shell__feedback admin-shell__feedback--error">{error}</p> : null}
              <table className="admin-shell__table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.email}>
                      <td>
                        <div className="admin-shell__user-cell">
                          <strong>{user.name}</strong>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.roleLabel}</td>
                      <td>
                        <span className={`admin-shell__status-pill admin-shell__status-pill--${user.status.toLowerCase()}`}>
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && !error && users.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No users found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="admin-shell__panel admin-shell__panel--timeline">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">Timeline</p>
                <h2>Recent activity</h2>
              </div>
            </div>

            <div className="admin-shell__timeline">
              {timelineItems.map((item) => (
                <div key={item.title} className="admin-shell__timeline-item">
                  <span className="admin-shell__timeline-dot" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <time>{item.time}</time>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
