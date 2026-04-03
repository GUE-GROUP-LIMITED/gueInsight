import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { api } from '../services/api';
import './UserManagement.css';

const sidebarItems = [
  { label: 'Home', href: '/admin', icon: 'home' },
  { label: 'Users', href: '/admin/users', active: true, icon: 'users' },
  { label: 'Roles', href: '#roles', icon: 'roles' },
  { label: 'Tables', href: '#accounts', icon: 'table' },
  { label: 'Logs', href: '#logs', icon: 'logs' },
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

  if (type === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-9-1h8v-1a5 5 0 0 0-8 0v1Zm10 0h8v-1a5 5 0 0 0-8 0v1Z" />
      </svg>
    );
  }

  if (type === 'roles') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 3 7v6c0 5 3.8 8.8 9 9 5.2-.2 9-4 9-9V7l-9-5Zm0 3.2 5.8 3.2v4.6c0 3.6-2.5 6.5-5.8 7.1-3.3-.6-5.8-3.5-5.8-7.1V8.4L12 5.2Zm-1.1 9.9 5.2-5.2-1.4-1.4-3.8 3.8-1.9-1.9-1.4 1.4 3.3 3.3Z" />
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14a2 2 0 0 1 2 2v10.5A2.5 2.5 0 0 1 18.5 19H8l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4v2h10V8H7Zm0 4v2h7v-2H7Z" />
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

const formatDateTime = (isoDate) => {
  if (!isoDate) return 'N/A';
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return 'N/A';
  return parsedDate.toLocaleString();
};

const buildEditableProfile = (user) => ({
  first_name: user?.first_name || '',
  last_name: user?.last_name || '',
  phone_number: user?.phone_number || '',
  company: user?.company || '',
  job_title: user?.job_title || '',
  team_size: user?.team_size || '',
  primary_use_case: user?.primary_use_case || '',
  newsletter_opt_in: Boolean(user?.newsletter_opt_in),
});

const defaultSubscriptionSummary = {
  status: 'none',
  current_plan: 'Free',
  current_start_date: null,
  current_end_date: null,
  total_subscriptions: 0,
};

const listUserToDetailShape = (listUser) => {
  if (!listUser) return null;
  const nameParts = (listUser.name || '').trim().split(' ').filter(Boolean);
  const inferredFirstName = nameParts[0] || '';
  const inferredLastName = nameParts.slice(1).join(' ');
  return {
    id: listUser.id,
    email: listUser.email,
    first_name: inferredFirstName,
    last_name: inferredLastName,
    role: listUser.role,
    is_active: listUser.status === 'active',
    current_plan: listUser.plan || 'Free',
    phone_number: '',
    company: '',
    job_title: '',
    team_size: '',
    primary_use_case: '',
    newsletter_opt_in: false,
    created_at: null,
    subscription_summary: defaultSubscriptionSummary,
    subscription_history: [],
  };
};

const UserManagement = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [subscriptionSummary, setSubscriptionSummary] = useState(defaultSubscriptionSummary);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [uploadsCount, setUploadsCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [profileDraft, setProfileDraft] = useState(buildEditableProfile(null));
  const [availableActions, setAvailableActions] = useState({
    can_delete: true,
    can_toggle_active: true,
    can_change_role: true,
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin_subscribers');
      const rawUsers = Array.isArray(response.data?.users) ? response.data.users : [];
      const normalizedUsers = rawUsers.map((user) => {
        const role = normalizeRole(user.role);
        const status = user.is_active ? 'active' : 'inactive';
        const name = nameFromUser(user);
        return {
          id: user.id,
          name,
          email: user.email || 'N/A',
          plan: user.current_plan || 'Free',
          role,
          roleLabel: toTitle(role),
          status,
          statusLabel: toTitle(status),
          badge: initialsFromName(name),
        };
      });
      setUsers(normalizedUsers);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to load users right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (active) {
      loadUsers();
    }

    return () => {
      active = false;
    };
  }, [loadUsers]);

  const loadUserDetail = useCallback(async (userId) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setDetailError('');

    try {
      const response = await api.get(`/admin_users/${userId}`);
      const userPayload = response.data?.user || null;
      setSelectedUser(userPayload);
      setProfileDraft(buildEditableProfile(userPayload));
      setRecentLogs(Array.isArray(response.data?.recent_logs) ? response.data.recent_logs : []);
      setSubscriptionSummary(response.data?.subscription_summary || defaultSubscriptionSummary);
      setSubscriptionHistory(Array.isArray(response.data?.subscription_history) ? response.data.subscription_history : []);
      setUploadsCount(Number(response.data?.uploads_count || 0));
      setAvailableActions({
        can_delete: Boolean(response.data?.actions?.can_delete),
        can_toggle_active: Boolean(response.data?.actions?.can_toggle_active),
        can_change_role: Boolean(response.data?.actions?.can_change_role),
      });
    } catch (requestError) {
      const status = requestError?.response?.status;
      if (status === 403) {
        setDetailError(requestError?.response?.data?.error || 'You do not have permission to view this account.');
        return;
      }
      const fallbackUser = listUserToDetailShape(users.find((user) => user.id === userId));
      if (status === 404 && fallbackUser) {
        setSelectedUser(fallbackUser);
        setProfileDraft(buildEditableProfile(fallbackUser));
        setRecentLogs([]);
        setSubscriptionSummary(defaultSubscriptionSummary);
        setSubscriptionHistory([]);
        setUploadsCount(0);
        setAvailableActions({
          can_delete: false,
          can_toggle_active: false,
          can_change_role: false,
        });
        setDetailError('Detailed endpoint is unavailable on the active backend process. Restart Flask to enable full user actions.');
      } else {
        setDetailError(requestError?.response?.data?.error || 'Unable to open this user profile.');
      }
    } finally {
      setDetailLoading(false);
    }
  }, [users]);

  const closeUserDetail = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
    setRecentLogs([]);
    setSubscriptionSummary(defaultSubscriptionSummary);
    setSubscriptionHistory([]);
    setUploadsCount(0);
    setDetailError('');
    setActionLoading(false);
    setActionMessage('');
    setEditMode(false);
    setProfileDraft(buildEditableProfile(null));
  };

  const runUserAction = async (actionType) => {
    if (!selectedUser || actionLoading) return;

    setActionLoading(true);
    setActionMessage('');
    setDetailError('');

    try {
      if (actionType === 'toggle_active') {
        const response = await api.patch(`/admin_users/${selectedUser.id}`, {
          is_active: !selectedUser.is_active,
        });
        setSelectedUser(response.data?.user || selectedUser);
        setActionMessage(selectedUser.is_active ? 'User deactivated.' : 'User activated.');
      }

      if (actionType === 'toggle_role') {
        const nextRole = selectedUser.role === 'admin' ? 'user' : 'admin';
        const response = await api.patch(`/admin_users/${selectedUser.id}`, { role: nextRole });
        setSelectedUser(response.data?.user || selectedUser);
        setActionMessage(nextRole === 'admin' ? 'User promoted to admin.' : 'User set to standard user.');
      }

      if (actionType === 'save_profile') {
        const response = await api.patch(`/admin_users/${selectedUser.id}`, profileDraft);
        const updatedUser = response.data?.user || selectedUser;
        setSelectedUser(updatedUser);
        setProfileDraft(buildEditableProfile(updatedUser));
        setEditMode(false);
        setActionMessage('Profile details updated.');
      }

      if (actionType === 'delete') {
        const confirmed = window.confirm('Delete this user account? This cannot be undone.');
        if (!confirmed) {
          setActionLoading(false);
          return;
        }
        await api.delete(`/admin_users/${selectedUser.id}`);
        setActionMessage('User deleted.');
        await loadUsers();
        closeUserDetail();
        return;
      }

      await loadUsers();
      await loadUserDetail(selectedUser.id);
    } catch (requestError) {
      setDetailError(requestError?.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDraftChange = (field, value) => {
    setProfileDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const startEditProfile = () => {
    if (!selectedUser) return;
    setProfileDraft(buildEditableProfile(selectedUser));
    setEditMode(true);
    setActionMessage('');
    setDetailError('');
  };

  const cancelEditProfile = () => {
    if (!selectedUser) return;
    setProfileDraft(buildEditableProfile(selectedUser));
    setEditMode(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchTarget = `${user.name} ${user.email}`.toLowerCase();
      const matchesSearch = !searchTerm || searchTarget.includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const inactiveUsers = users.filter((user) => user.status === 'inactive').length;
  const adminUsers = users.filter((user) => user.role === 'admin').length;
  const paidUsers = users.filter((user) => user.plan.toLowerCase() !== 'free').length;

  const statCards = useMemo(() => {
    return [
      { label: 'Total users', value: totalUsers.toString(), detail: 'All accounts in system', tone: 'blue' },
      { label: 'Active accounts', value: activeUsers.toString(), detail: 'Currently in good standing', tone: 'green' },
      { label: 'Inactive accounts', value: inactiveUsers.toString(), detail: 'Need follow-up', tone: 'orange' },
      { label: 'Admins', value: adminUsers.toString(), detail: 'Staff access only', tone: 'red' },
    ];
  }, [activeUsers, adminUsers, inactiveUsers, totalUsers]);

  const activityItems = useMemo(() => {
    return [
      { title: 'Active accounts', value: percent(activeUsers, totalUsers), color: 'blue' },
      { title: 'Admin accounts', value: percent(adminUsers, totalUsers), color: 'green' },
      { title: 'Paid plans', value: percent(paidUsers, totalUsers), color: 'orange' },
      { title: 'Filtered view', value: percent(filteredUsers.length, Math.max(totalUsers, 1)), color: 'red' },
    ];
  }, [activeUsers, adminUsers, filteredUsers.length, paidUsers, totalUsers]);

  const timelineItems = useMemo(() => {
    return [
      { title: 'Directory synced', time: 'Now', detail: `${totalUsers} total account${totalUsers === 1 ? '' : 's'} loaded` },
      { title: 'Active users', time: 'Now', detail: `${activeUsers} active account${activeUsers === 1 ? '' : 's'}` },
      { title: 'Inactive users', time: 'Now', detail: `${inactiveUsers} inactive account${inactiveUsers === 1 ? '' : 's'}` },
      { title: 'Current view', time: 'Now', detail: `${filteredUsers.length} account${filteredUsers.length === 1 ? '' : 's'} match filters` },
    ];
  }, [activeUsers, filteredUsers.length, inactiveUsers, totalUsers]);

  return (
    <div className={`user-shell ${sidebarCollapsed ? 'user-shell--collapsed' : ''}`} id="roles">
      <aside className="user-shell__sidebar">
        <div className="user-shell__brand">
          <div className="user-shell__brand-mark">GI</div>
          <div className="user-shell__brand-copy">
            <strong>GueInsight</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="user-shell__nav" aria-label="User management sidebar">
          {sidebarItems.map((item) => (
            item.href.startsWith('/') ? (
              <Link
                key={item.label}
                to={item.href}
                aria-label={item.label}
                className={`user-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="user-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="user-shell__nav-label">{item.label}</span>
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`user-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="user-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="user-shell__nav-label">{item.label}</span>
              </a>
            )
          ))}
        </nav>

        <div className="user-shell__sidebar-card">
          <p className="user-shell__sidebar-label">User Controls</p>
          <h3>Account administration</h3>
          <p>Review plan status, role assignment, and user lifecycle events from the table below.</p>
          <Link to="/admin" className="user-shell__sidebar-action">Back to dashboard</Link>
        </div>
      </aside>

      <main className="user-shell__content">
        <header className="user-shell__topbar">
          <div>
            <p className="user-shell__eyebrow">Dashboard</p>
            <h1>User management</h1>
          </div>

          <AdminTopbarControls
            searchPlaceholder="Search users"
            searchAriaLabel="Search users"
            primaryActionHref="/admin"
            primaryActionLabel="Admin dashboard"
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
        </header>

        <section className="user-shell__stats">
          {statCards.map((card) => (
            <article key={card.label} className={`user-shell__stat-card user-shell__stat-card--${card.tone}`}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span>{card.detail}</span>
            </article>
          ))}
        </section>

        <section className="user-shell__grid">
          <article className="user-shell__panel user-shell__panel--chart" id="accounts">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">Accounts</p>
                <h2>Subscriber list</h2>
              </div>
              <span className="user-shell__chip">Preview</span>
            </div>

            <div className="user-shell__table-wrap">
              <table className="user-shell__table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-shell__user-cell">
                          <button
                            type="button"
                            className="user-shell__open-user"
                            onClick={() => {
                              setActionMessage('');
                              loadUserDetail(user.id);
                            }}
                          >
                            {user.name}
                          </button>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.plan}</td>
                      <td>{user.roleLabel}</td>
                      <td>
                        <span className={`user-shell__status-pill user-shell__status-pill--${user.status}`}>
                          {user.statusLabel}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="user-shell__table-action"
                          onClick={() => {
                            setActionMessage('');
                            loadUserDetail(user.id);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && !error && filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No users match the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {loading ? <p className="user-shell__feedback">Loading users...</p> : null}
              {error ? <p className="user-shell__feedback user-shell__feedback--error">{error}</p> : null}
            </div>
          </article>

          <article className="user-shell__panel user-shell__panel--activity" id="logs">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">Activity</p>
                <h2>Account timeline</h2>
              </div>
            </div>

            <div className="user-shell__timeline">
              {timelineItems.map((item) => (
                <div key={item.title} className="user-shell__timeline-item">
                  <span className="user-shell__timeline-dot" />
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

        <section className="user-shell__grid user-shell__grid--bottom">
          <article className="user-shell__panel">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">Filters</p>
                <h2>Find an account</h2>
              </div>
            </div>

            <div className="user-shell__filters">
              <label className="user-shell__field">
                <span>Search</span>
                <input
                  type="text"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>

              <label className="user-shell__field">
                <span>Role</span>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  <option value="user">Users</option>
                  <option value="admin">Staff admins</option>
                </select>
              </label>

              <label className="user-shell__field">
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Any status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </article>

          <article className="user-shell__panel user-shell__panel--activity">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">Status</p>
                <h2>Distribution mix</h2>
              </div>
            </div>

            <div className="user-shell__activity-list">
              {activityItems.map((item) => (
                <div key={item.title} className="user-shell__activity-row">
                  <div className="user-shell__activity-copy">
                    <span>{item.title}</span>
                    <strong>{item.value}%</strong>
                  </div>
                  <div className="user-shell__activity-track">
                    <span className={`user-shell__activity-fill is-${item.color}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>

      {selectedUserId ? (
        <section className="user-shell__detail-overlay" role="dialog" aria-modal="true" aria-label="User detail">
          <article className="user-shell__detail-card">
            <header className="user-shell__detail-header">
              <div>
                <p className="user-shell__section-label">User Profile</p>
                <h2>{selectedUser ? nameFromUser(selectedUser) : 'Loading user'}</h2>
              </div>
              <button type="button" className="user-shell__detail-close" onClick={closeUserDetail} aria-label="Close">
                Close
              </button>
            </header>

            {detailLoading ? <p className="user-shell__feedback">Loading user details...</p> : null}
            {detailError ? <p className="user-shell__feedback user-shell__feedback--error">{detailError}</p> : null}

            {selectedUser && !detailLoading ? (
              <>
                <dl className="user-shell__detail-grid">
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedUser.email || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedUser.is_active ? 'Active' : 'Inactive'}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{toTitle(normalizeRole(selectedUser.role))}</dd>
                  </div>
                  <div>
                    <dt>Plan</dt>
                    <dd>{selectedUser.current_plan || 'Free'}</dd>
                  </div>
                  <div>
                    <dt>First name</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.first_name}
                          onChange={(event) => handleDraftChange('first_name', event.target.value)}
                        />
                      ) : (
                        selectedUser.first_name || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Last name</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.last_name}
                          onChange={(event) => handleDraftChange('last_name', event.target.value)}
                        />
                      ) : (
                        selectedUser.last_name || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.phone_number}
                          onChange={(event) => handleDraftChange('phone_number', event.target.value)}
                        />
                      ) : (
                        selectedUser.phone_number || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Company</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.company}
                          onChange={(event) => handleDraftChange('company', event.target.value)}
                        />
                      ) : (
                        selectedUser.company || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Job title</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.job_title}
                          onChange={(event) => handleDraftChange('job_title', event.target.value)}
                        />
                      ) : (
                        selectedUser.job_title || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Team size</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.team_size}
                          onChange={(event) => handleDraftChange('team_size', event.target.value)}
                        />
                      ) : (
                        selectedUser.team_size || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Primary use case</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.primary_use_case}
                          onChange={(event) => handleDraftChange('primary_use_case', event.target.value)}
                        />
                      ) : (
                        selectedUser.primary_use_case || 'N/A'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Newsletter</dt>
                    <dd>
                      {editMode ? (
                        <label className="user-shell__detail-checkbox">
                          <input
                            type="checkbox"
                            checked={profileDraft.newsletter_opt_in}
                            onChange={(event) => handleDraftChange('newsletter_opt_in', event.target.checked)}
                          />
                          <span>Opted in</span>
                        </label>
                      ) : (
                        selectedUser.newsletter_opt_in ? 'Opted in' : 'Not subscribed'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(selectedUser.created_at)}</dd>
                  </div>
                  <div>
                    <dt>File uploads</dt>
                    <dd>{uploadsCount}</dd>
                  </div>
                </dl>

                <div className="user-shell__detail-actions">
                  {!editMode ? (
                    <button
                      type="button"
                      className="user-shell__detail-action"
                      disabled={actionLoading}
                      onClick={startEditProfile}
                    >
                      Edit profile
                    </button>
                  ) : null}

                  {editMode ? (
                    <button
                      type="button"
                      className="user-shell__detail-action"
                      disabled={actionLoading}
                      onClick={() => runUserAction('save_profile')}
                    >
                      Save profile
                    </button>
                  ) : null}

                  {editMode ? (
                    <button
                      type="button"
                      className="user-shell__detail-action"
                      disabled={actionLoading}
                      onClick={cancelEditProfile}
                    >
                      Cancel edit
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="user-shell__detail-action"
                    disabled={!availableActions.can_toggle_active || actionLoading || editMode}
                    onClick={() => runUserAction('toggle_active')}
                  >
                    {selectedUser.is_active ? 'Deactivate account' : 'Activate account'}
                  </button>
                  <button
                    type="button"
                    className="user-shell__detail-action"
                    disabled={!availableActions.can_change_role || actionLoading || editMode}
                    onClick={() => runUserAction('toggle_role')}
                  >
                    {normalizeRole(selectedUser.role) === 'admin' ? 'Set as standard user' : 'Promote to admin'}
                  </button>
                  <button
                    type="button"
                    className="user-shell__detail-action user-shell__detail-action--danger"
                    disabled={!availableActions.can_delete || actionLoading || editMode}
                    onClick={() => runUserAction('delete')}
                  >
                    Delete account
                  </button>
                </div>

                {actionMessage ? <p className="user-shell__feedback">{actionMessage}</p> : null}

                <section className="user-shell__detail-logs">
                  <div className="user-shell__panel-header">
                    <div>
                      <p className="user-shell__section-label">Subscription</p>
                      <h3>Subscription details</h3>
                    </div>
                  </div>

                  <dl className="user-shell__subscription-grid">
                    <div>
                      <dt>Status</dt>
                      <dd>{toTitle(subscriptionSummary.status || 'none')}</dd>
                    </div>
                    <div>
                      <dt>Current plan</dt>
                      <dd>{subscriptionSummary.current_plan || 'Free'}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>{formatDateTime(subscriptionSummary.current_start_date)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{formatDateTime(subscriptionSummary.current_end_date)}</dd>
                    </div>
                    <div>
                      <dt>Total plans</dt>
                      <dd>{subscriptionSummary.total_subscriptions || 0}</dd>
                    </div>
                  </dl>

                  {subscriptionHistory.length ? (
                    <ul className="user-shell__detail-log-list">
                      {subscriptionHistory.map((subscription) => (
                        <li key={subscription.id}>
                          <strong>{subscription.plan || 'Free'}</strong>
                          <span>
                            {formatDateTime(subscription.start_date)} - {formatDateTime(subscription.end_date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="user-shell__feedback">No subscription history recorded for this user yet.</p>
                  )}
                </section>

                <section className="user-shell__detail-logs">
                  <div className="user-shell__panel-header">
                    <div>
                      <p className="user-shell__section-label">Recent activity</p>
                      <h3>Latest admin-visible actions</h3>
                    </div>
                  </div>
                  {recentLogs.length ? (
                    <ul className="user-shell__detail-log-list">
                      {recentLogs.map((log) => (
                        <li key={log.id}>
                          <strong>{log.action}</strong>
                          <span>{formatDateTime(log.timestamp)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="user-shell__feedback">No activity logs recorded for this user yet.</p>
                  )}
                </section>
              </>
            ) : null}
          </article>
        </section>
      ) : null}
    </div>
  );
};

export default UserManagement;
