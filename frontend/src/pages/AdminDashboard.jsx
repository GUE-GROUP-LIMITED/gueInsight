import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './AdminDashboard.css';

const demoSnapshot = {
  users: [
    {
      id: 1,
      email: 'ops@acme-security.com',
      first_name: 'Acme',
      last_name: 'Operations',
      role: 'admin',
    },
    {
      id: 2,
      email: 'northwind@client.com',
      first_name: 'Northwind',
      last_name: 'Holdings',
      role: 'user',
    },
    {
      id: 3,
      email: 'support@bluebay.com',
      first_name: 'BlueBay',
      last_name: 'Security',
      role: 'user',
    },
  ],
  file_uploads: [
    {
      id: 1,
      file_path: 'threat-intel-january.csv',
      upload_date: '2026-04-01T09:30:00Z',
      user: { first_name: 'Northwind', last_name: 'Holdings' },
    },
    {
      id: 2,
      file_path: 'investigation-notes.pdf',
      upload_date: '2026-04-01T11:15:00Z',
      user: { first_name: 'BlueBay', last_name: 'Security' },
    },
    {
      id: 3,
      file_path: 'system-alert-export.json',
      upload_date: '2026-04-01T13:05:00Z',
      user: { first_name: 'Acme', last_name: 'Operations' },
    },
  ],
  critical_alert: true,
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const resolveRole = (user) => {
  const rawRole = user?.role;
  const resolvedRole = typeof rawRole === 'object' && rawRole !== null ? rawRole.value : rawRole;
  return String(resolvedRole || user?.app_metadata?.role || user?.user_metadata?.role || 'user').toLowerCase();
};

const resolveAccountName = (user) => {
  const firstName = user?.first_name || user?.user_metadata?.first_name || '';
  const lastName = user?.last_name || user?.user_metadata?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user?.email || 'Unnamed account';
};

const resolveUploadName = (upload) => {
  const filePath = upload?.file_path || upload?.filename || upload?.name || 'uploaded-file';
  return String(filePath).split(/[\\/]/).pop();
};

const AdminDashboard = () => {
  const [snapshot, setSnapshot] = useState(demoSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const response = await api.get('/admin_dashboard', { validateStatus: () => true });
        const responseData = response.data;

        if (response.status >= 200 && response.status < 300 && responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
          if (!isMounted) return;
          setSnapshot({
            users: Array.isArray(responseData.users) && responseData.users.length > 0 ? responseData.users : demoSnapshot.users,
            file_uploads:
              Array.isArray(responseData.file_uploads) && responseData.file_uploads.length > 0
                ? responseData.file_uploads
                : demoSnapshot.file_uploads,
            critical_alert: Boolean(responseData.critical_alert),
          });
          setError('');
          return;
        }

        throw new Error('Dashboard data is not available yet.');
      } catch (dashboardError) {
        if (!isMounted) return;
        setSnapshot(demoSnapshot);
        setError('Live admin data is not available right now. Showing a dashboard preview.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const users = snapshot.users;
  const fileUploads = snapshot.file_uploads;
  const subscriberAccounts = users.filter((user) => resolveRole(user) !== 'admin');
  const staffAccounts = users.filter((user) => resolveRole(user) === 'admin');
  const alertCount = snapshot.critical_alert ? 1 : 0;

  const dashboardStats = [
    {
      label: 'Subscriber accounts',
      value: subscriberAccounts.length,
      detail: 'Primary account owners on the subscription plan',
    },
    {
      label: 'Staff admins',
      value: staffAccounts.length,
      detail: 'Company staff with operational access',
    },
    {
      label: 'Files uploaded',
      value: fileUploads.length,
      detail: 'Recent evidence, exports, and reports',
    },
    {
      label: 'Critical alerts',
      value: alertCount,
      detail: snapshot.critical_alert ? 'Attention needed now' : 'No active escalations',
    },
  ];

  const activityBars = [
    {
      label: 'Subscribers',
      value: Math.max(subscriberAccounts.length, 1),
      accent: 'var(--admin-accent)',
    },
    {
      label: 'Uploads',
      value: Math.max(fileUploads.length, 1),
      accent: 'var(--admin-accent-2)',
    },
    {
      label: 'Alerts',
      value: Math.max(alertCount, 1),
      accent: 'var(--admin-accent-3)',
    },
  ];

  const maxActivity = Math.max(...activityBars.map((item) => item.value), 1);

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard__hero">
        <div className="admin-dashboard__hero-copy">
          <p className="admin-dashboard__eyebrow">Staff console</p>
          <h1>Admin dashboard</h1>
          <p className="admin-dashboard__lead">
            This area is for company staff only. Every paying customer is treated as a subscriber account,
            and any sub-users belong under that subscriber rather than becoming separate customer types.
          </p>
          <div className="admin-dashboard__hero-actions">
            <Link to="/admin/users" className="admin-dashboard__primary-action">
              Manage subscriber accounts
            </Link>
            <a href="#overview" className="admin-dashboard__secondary-action">
              Review overview
            </a>
          </div>
        </div>

        <div className="admin-dashboard__model-card">
          <p className="admin-dashboard__model-card-title">Account model</p>
          <ul>
            <li>Subscriber owns the plan and billing relationship.</li>
            <li>Sub-users inherit access under the subscriber account.</li>
            <li>Admin access is reserved for company staff.</li>
          </ul>
        </div>
      </section>

      {loading ? <div className="admin-dashboard__status">Loading dashboard data...</div> : null}
      {error ? <div className="admin-dashboard__banner">{error}</div> : null}
      {snapshot.critical_alert ? (
        <div className="admin-dashboard__banner admin-dashboard__banner--critical" id="alerts">
          <strong>Critical alert:</strong> a high-priority issue needs staff attention.
        </div>
      ) : null}

      <section className="admin-dashboard__stats" id="overview">
        {dashboardStats.map((stat) => (
          <article className="admin-dashboard__stat-card" key={stat.label}>
            <p className="admin-dashboard__stat-label">{stat.label}</p>
            <p className="admin-dashboard__stat-value">{stat.value}</p>
            <p className="admin-dashboard__stat-detail">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="admin-dashboard__grid">
        <article className="admin-dashboard__panel">
          <div className="admin-dashboard__panel-header">
            <div>
              <p className="admin-dashboard__panel-kicker">Operations</p>
              <h2>Subscriber accounts</h2>
            </div>
            <span className="admin-dashboard__panel-chip">{subscriberAccounts.length} active</span>
          </div>

          <div className="admin-dashboard__table-wrap">
            <table className="admin-dashboard__table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const role = resolveRole(user);
                  return (
                    <tr key={user.id || user.email}>
                      <td>{resolveAccountName(user)}</td>
                      <td>{user.email || 'N/A'}</td>
                      <td>{role === 'admin' ? 'Staff' : 'Subscriber'}</td>
                      <td>
                        <span className={`admin-dashboard__role-pill admin-dashboard__role-pill--${role === 'admin' ? 'admin' : 'subscriber'}`}>
                          {role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-dashboard__panel admin-dashboard__panel--compact">
          <div className="admin-dashboard__panel-header">
            <div>
              <p className="admin-dashboard__panel-kicker">Activity</p>
              <h2>System mix</h2>
            </div>
          </div>

          <div className="admin-dashboard__activity-list">
            {activityBars.map((item) => {
              const width = `${(item.value / maxActivity) * 100}%`;

              return (
                <div className="admin-dashboard__activity-item" key={item.label}>
                  <div className="admin-dashboard__activity-meta">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <div className="admin-dashboard__activity-track">
                    <span className="admin-dashboard__activity-fill" style={{ width, background: item.accent }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-dashboard__action-stack">
            <Link to="/admin/users" className="admin-dashboard__inline-action">
              Open user management
            </Link>
            <a href="#uploads" className="admin-dashboard__inline-action admin-dashboard__inline-action--ghost">
              Inspect uploads
            </a>
          </div>
        </article>
      </section>

      <section className="admin-dashboard__panel" id="uploads">
        <div className="admin-dashboard__panel-header">
          <div>
            <p className="admin-dashboard__panel-kicker">Files</p>
            <h2>Recent uploads</h2>
          </div>
          <span className="admin-dashboard__panel-chip">{fileUploads.length} items</span>
        </div>

        <div className="admin-dashboard__table-wrap">
          <table className="admin-dashboard__table">
            <thead>
              <tr>
                <th>File</th>
                <th>Uploaded by</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {fileUploads.map((upload) => (
                <tr key={upload.id || `${upload.file_path}-${upload.upload_date}`}>
                  <td>{resolveUploadName(upload)}</td>
                  <td>{resolveAccountName(upload.user)}</td>
                  <td>{formatDate(upload.upload_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
