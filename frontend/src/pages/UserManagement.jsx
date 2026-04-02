import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import './UserManagement.css';

const demoUsers = [
  {
    id: 1,
    email: 'ops@acme-security.com',
    first_name: 'Acme',
    last_name: 'Operations',
    company: 'Acme Security',
    job_title: 'SOC Manager',
    team_size: '21-50',
    primary_use_case: 'Threat monitoring',
    newsletter_opt_in: true,
    current_plan: 'Free',
    role: 'admin',
    is_active: true,
  },
  {
    id: 2,
    email: 'billing@northwind.com',
    first_name: 'Northwind',
    last_name: 'Holdings',
    company: 'Northwind Holdings',
    job_title: 'Security Lead',
    team_size: '6-20',
    primary_use_case: 'Compliance reporting',
    newsletter_opt_in: false,
    current_plan: 'premium_small_business',
    role: 'user',
    is_active: true,
  },
  {
    id: 3,
    email: 'analyst@bluebay.com',
    first_name: 'BlueBay',
    last_name: 'Security',
    company: 'BlueBay Security',
    job_title: 'Analyst',
    team_size: '1-5',
    primary_use_case: 'Incident response',
    newsletter_opt_in: true,
    current_plan: 'premium_individual',
    role: 'user',
    is_active: false,
  },
  {
    id: 4,
    email: 'support@seacloud.com',
    first_name: 'SeaCloud',
    last_name: 'Ops',
    company: 'SeaCloud Ops',
    job_title: 'Security Engineer',
    team_size: '6-20',
    primary_use_case: 'Client security operations',
    newsletter_opt_in: true,
    current_plan: 'premium_large_business',
    role: 'user',
    is_active: true,
  },
];

const formatPlanLabel = (plan) => {
  const value = String(plan || 'Free').replaceAll('_', ' ').trim();
  if (!value) return 'Free';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const resolveRole = (user) => {
  const rawRole = user?.role;
  const resolvedRole = typeof rawRole === 'object' && rawRole !== null ? rawRole.value : rawRole;
  return String(resolvedRole || user?.app_metadata?.role || user?.user_metadata?.role || 'user').toLowerCase();
};

const resolveName = (user) => {
  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  return fullName || user?.email || 'Unnamed account';
};

const UserManagement = () => {
  const [users, setUsers] = useState(demoUsers);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const response = await api.get('/admin_dashboard', { validateStatus: () => true });
        if (!isMounted) return;

        if (response.status >= 200 && response.status < 300 && Array.isArray(response.data?.users)) {
          setUsers(response.data.users.length > 0 ? response.data.users : demoUsers);
          setMessage('');
        } else {
          setUsers(demoUsers);
          setMessage('Live user data is unavailable right now. Showing a management preview.');
        }
      } catch (error) {
        if (!isMounted) return;
        setUsers(demoUsers);
        setMessage('Live user data is unavailable right now. Showing a management preview.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const role = resolveRole(user);
      const name = resolveName(user).toLowerCase();
      const email = String(user?.email || '').toLowerCase();
      const company = String(user?.company || '').toLowerCase();
      const useCase = String(user?.primary_use_case || '').toLowerCase();
      const matchesSearch = !query || name.includes(query) || email.includes(query) || company.includes(query) || useCase.includes(query);
      const matchesRole = roleFilter === 'all' || role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user?.is_active !== false) ||
        (statusFilter === 'inactive' && user?.is_active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const subscriberUsers = users.filter((user) => resolveRole(user) !== 'admin');
  const staffUsers = users.filter((user) => resolveRole(user) === 'admin');
  const activeSubscribers = subscriberUsers.filter((user) => user?.is_active !== false).length;
  const inactiveSubscribers = subscriberUsers.filter((user) => user?.is_active === false).length;

  const handleDelete = async (userId) => {
    const confirmed = window.confirm('Delete this account? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await api.post(`/delete_user/${userId}`);
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
      setMessage('Account deleted successfully.');
    } catch (error) {
      setMessage('Could not delete that account right now.');
    }
  };

  return (
    <div className="user-management">
      <section className="user-management__hero">
        <div>
          <p className="user-management__eyebrow">Staff console</p>
          <h1>Subscriber management</h1>
          <p className="user-management__lead">
            Use this page to manage subscriber accounts. Every customer is still a user in the system, and any
            sub-users stay attached to the subscriber who owns the subscription.
          </p>
        </div>

        <div className="user-management__hero-card">
          <span className="user-management__hero-card-label">Account model</span>
          <strong>Subscriber-first</strong>
          <p>
            Staff users are operational admins. Subscribers own billing and access, while their sub-users remain
            part of the same account tree.
          </p>
        </div>
      </section>

      {message ? <div className="user-management__banner">{message}</div> : null}

      <section className="user-management__stats">
        <article className="user-management__stat-card">
          <span>Subscribers</span>
          <strong>{subscriberUsers.length}</strong>
          <p>Customer accounts on active plans or in setup.</p>
        </article>
        <article className="user-management__stat-card">
          <span>Active subscribers</span>
          <strong>{activeSubscribers}</strong>
          <p>Subscribers currently marked active in the system.</p>
        </article>
        <article className="user-management__stat-card">
          <span>Inactive subscribers</span>
          <strong>{inactiveSubscribers}</strong>
          <p>Subscriber accounts that need follow-up or renewal.</p>
        </article>
        <article className="user-management__stat-card">
          <span>Staff admins</span>
          <strong>{staffUsers.length}</strong>
          <p>Company staff with admin privileges.</p>
        </article>
      </section>

      <section className="user-management__panel">
        <div className="user-management__panel-header">
          <div>
            <p className="user-management__panel-kicker">Filters</p>
            <h2>Find an account</h2>
          </div>
          <Link to="/admin" className="user-management__back-link">
            Back to dashboard
          </Link>
        </div>

        <div className="user-management__filters">
          <label className="user-management__field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
            />
          </label>

          <label className="user-management__field">
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              <option value="user">Subscribers</option>
              <option value="admin">Staff admins</option>
            </select>
          </label>

          <label className="user-management__field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        {loading ? <div className="user-management__loading">Loading accounts...</div> : null}

        <div className="user-management__table-wrap">
          <table className="user-management__table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Email</th>
                <th>Current plan</th>
                <th>Customer profile</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const role = resolveRole(user);
                const isSubscriber = role !== 'admin';

                return (
                  <tr key={user.id || user.email}>
                    <td>
                      <strong>{resolveName(user)}</strong>
                    </td>
                    <td>{user.email || 'N/A'}</td>
                    <td>{formatPlanLabel(user.current_plan)}</td>
                    <td>
                      <div className="user-management__profile">
                        <p><strong>Company:</strong> {user.company || 'N/A'}</p>
                        <p><strong>Role:</strong> {user.job_title || 'N/A'}</p>
                        <p><strong>Team size:</strong> {user.team_size || 'N/A'}</p>
                        <p><strong>Use case:</strong> {user.primary_use_case || 'N/A'}</p>
                        <span className={`user-management__pill user-management__pill--${user.newsletter_opt_in ? 'active' : 'inactive'}`}>
                          {user.newsletter_opt_in ? 'Newsletter opt-in' : 'No newsletter'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`user-management__pill user-management__pill--${isSubscriber ? 'subscriber' : 'admin'}`}>
                        {isSubscriber ? 'Subscriber' : 'Staff'}
                      </span>
                    </td>
                    <td>
                      <span className={`user-management__pill user-management__pill--${user?.is_active === false ? 'inactive' : 'active'}`}>
                        {user?.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="user-management__actions">
                        <a className="user-management__action-link" href={`/edit_user/${user.id}`}>
                          Edit
                        </a>
                        <a className="user-management__action-link" href={`/view_user_activity/${user.id}`}>
                          Activity
                        </a>
                        {isSubscriber ? (
                          <button type="button" className="user-management__action-button" onClick={() => handleDelete(user.id)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default UserManagement;
