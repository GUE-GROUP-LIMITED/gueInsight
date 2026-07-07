import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';
import './UserManagement.css';

const sidebarItems = [
  { label: 'nav.home', href: '/admin', icon: 'home' },
  { label: 'nav.subscribers', href: '/admin/users', active: true, icon: 'users' },
  { label: 'admin_users.roles', href: '/admin/access', icon: 'roles' },
  { label: 'admin_users.tables', href: '#accounts', icon: 'table' },
  { label: 'admin_users.logs', href: '#logs', icon: 'logs' },
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

const nameFromUser = (user, fallbackUnknown = 'Unknown user') => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.email) return user.email.split('@')[0];
  return fallbackUnknown;
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

const formatDateTime = (isoDate, unavailable = 'N/A') => {
  if (!isoDate) return unavailable;
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return unavailable;
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
  const { t } = useTranslation();
  const ui = {
    na: t('admin_users.na'),
    unknownUser: t('admin_users.unknown_user'),
    loadingUsers: t('admin_users.loading_users'),
    loadingUser: t('admin_users.loading_user'),
    loadingUserDetails: t('admin_users.loading_user_details'),
    noUsersMatch: t('admin_users.no_users_match'),
    userControls: t('admin_users.user_controls'),
    accountAdministration: t('admin_users.account_administration'),
    sidebarDescription: t('admin_users.sidebar_description'),
    backToDashboard: t('admin_users.back_to_dashboard'),
    dashboard: t('admin_users.dashboard'),
    userManagement: t('admin_users.user_management'),
    searchUsers: t('admin_users.search_users'),
    adminDashboard: t('admin_users.admin_dashboard'),
    totalUsers: t('admin_users.total_users'),
    allAccounts: t('admin_users.all_accounts'),
    activeAccounts: t('admin_users.active_accounts'),
    activeStanding: t('admin_users.active_standing'),
    inactiveAccounts: t('admin_users.inactive_accounts'),
    needFollowUp: t('admin_users.need_follow_up'),
    admins: t('admin_users.admins'),
    staffAccessOnly: t('admin_users.staff_access_only'),
    activeAccountsTitle: t('admin_users.active_accounts_title'),
    adminAccountsTitle: t('admin_users.admin_accounts_title'),
    paidPlansTitle: t('admin_users.paid_plans_title'),
    filteredViewTitle: t('admin_users.filtered_view_title'),
    directorySynced: t('admin_users.directory_synced'),
    now: t('admin_users.now'),
    totalAccountSuffix: t('admin_users.total_account_suffix'),
    activeAccountSuffix: t('admin_users.active_account_suffix'),
    inactiveAccountSuffix: t('admin_users.inactive_account_suffix'),
    matchFilters: t('admin_users.match_filters'),
    accounts: t('admin_users.accounts'),
    subscriberList: t('admin_users.subscriber_list'),
    preview: t('admin_users.preview'),
    user: t('admin_users.user'),
    email: t('admin_users.email'),
    plan: t('admin_users.plan'),
    role: t('admin_users.role'),
    status: t('admin_users.status'),
    actions: t('admin_users.actions'),
    open: t('admin_users.open'),
    loading: t('admin_users.loading'),
    activity: t('admin_users.activity'),
    accountTimeline: t('admin_users.account_timeline'),
    filters: t('admin_users.filters'),
    findAccount: t('admin_users.find_account'),
    search: t('admin_users.search'),
    searchByNameOrEmail: t('admin_users.search_by_name_or_email'),
    allRoles: t('admin_users.all_roles'),
    users: t('admin_users.users'),
    staffAdmins: t('admin_users.staff_admins'),
    anyStatus: t('admin_users.any_status'),
    active: t('admin_users.active'),
    inactive: t('admin_users.inactive'),
    distributionMix: t('admin_users.distribution_mix'),
    userProfile: t('admin_users.user_profile'),
    close: t('admin_users.close'),
    loadingUserDetailsText: t('admin_users.loading_user_details'),
    statusActive: t('admin_users.status_active'),
    statusInactive: t('admin_users.status_inactive'),
    firstName: t('admin_users.first_name'),
    lastName: t('admin_users.last_name'),
    phone: t('admin_users.phone'),
    company: t('admin_users.company'),
    jobTitle: t('admin_users.job_title'),
    teamSize: t('admin_users.team_size'),
    primaryUseCase: t('admin_users.primary_use_case'),
    newsletter: t('admin_users.newsletter'),
    optedIn: t('admin_users.opted_in'),
    notSubscribed: t('admin_users.not_subscribed'),
    created: t('admin_users.created'),
    fileUploads: t('admin_users.file_uploads'),
    editProfile: t('admin_users.edit_profile'),
    saveProfile: t('admin_users.save_profile'),
    cancelEdit: t('admin_users.cancel_edit'),
    deactivateAccount: t('admin_users.deactivate_account'),
    activateAccount: t('admin_users.activate_account'),
    setStandardUser: t('admin_users.set_standard_user'),
    promoteToAdmin: t('admin_users.promote_to_admin'),
    deleteAccount: t('admin_users.delete_account'),
    confirmDelete: t('admin_users.confirm_delete'),
    profileUpdated: t('admin_users.profile_updated'),
    userDeleted: t('admin_users.user_deleted'),
    userActivated: t('admin_users.user_activated'),
    userDeactivated: t('admin_users.user_deactivated'),
    userPromoted: t('admin_users.user_promoted'),
    userStandard: t('admin_users.user_standard'),
    actionFailed: t('admin_users.action_failed'),
    subscription: t('admin_users.subscription'),
    subscriptionDetails: t('admin_users.subscription_details'),
    started: t('admin_users.started'),
    expires: t('admin_users.expires'),
    totalPlans: t('admin_users.total_plans'),
    freePlan: t('admin_users.free_plan'),
    noSubscriptionHistory: t('admin_users.no_subscription_history'),
    recentActivity: t('admin_users.recent_activity'),
    latestAdminActions: t('admin_users.latest_admin_actions'),
    noActivityLogs: t('admin_users.no_activity_logs'),
  };
  const displayPlan = (plan) => (!plan || plan === 'Free' ? ui.freePlan : plan);
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
        const name = nameFromUser(user, ui.unknownUser);
        return {
          id: user.id,
          name,
          email: user.email || ui.na,
          plan: displayPlan(user.current_plan),
          role,
          roleLabel: role === 'admin' ? t('admin_users.role_admin') : t('admin_users.role_user'),
          status,
          statusLabel: status === 'active' ? ui.active : ui.inactive,
          badge: initialsFromName(name),
        };
      });
      setUsers(normalizedUsers);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('admin_users.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t, ui]);

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
        setDetailError(requestError?.response?.data?.error || t('admin_users.forbidden'));
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
        setDetailError(t('admin_users.detail_unavailable'));
      } else {
        setDetailError(requestError?.response?.data?.error || t('admin_users.detail_failed'));
      }
    } finally {
      setDetailLoading(false);
    }
  }, [t, ui, users]);

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
        setActionMessage(selectedUser.is_active ? ui.userDeactivated : ui.userActivated);
      }

      if (actionType === 'toggle_role') {
        const nextRole = selectedUser.role === 'admin' ? 'user' : 'admin';
        const response = await api.patch(`/admin_users/${selectedUser.id}`, { role: nextRole });
        setSelectedUser(response.data?.user || selectedUser);
        setActionMessage(nextRole === 'admin' ? ui.userPromoted : ui.userStandard);
      }

      if (actionType === 'save_profile') {
        const response = await api.patch(`/admin_users/${selectedUser.id}`, profileDraft);
        const updatedUser = response.data?.user || selectedUser;
        setSelectedUser(updatedUser);
        setProfileDraft(buildEditableProfile(updatedUser));
        setEditMode(false);
        setActionMessage(ui.profileUpdated);
      }

      if (actionType === 'delete') {
        const confirmed = window.confirm(ui.confirmDelete);
        if (!confirmed) {
          setActionLoading(false);
          return;
        }
        await api.delete(`/admin_users/${selectedUser.id}`);
        setActionMessage(ui.userDeleted);
        await loadUsers();
        closeUserDetail();
        return;
      }

      await loadUsers();
      await loadUserDetail(selectedUser.id);
    } catch (requestError) {
      setDetailError(requestError?.response?.data?.error || ui.actionFailed);
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
      { label: ui.totalUsers, value: totalUsers.toString(), detail: ui.allAccounts, tone: 'blue' },
      { label: ui.activeAccounts, value: activeUsers.toString(), detail: ui.activeStanding, tone: 'green' },
      { label: ui.inactiveAccounts, value: inactiveUsers.toString(), detail: ui.needFollowUp, tone: 'orange' },
      { label: ui.admins, value: adminUsers.toString(), detail: ui.staffAccessOnly, tone: 'red' },
    ];
  }, [activeUsers, adminUsers, inactiveUsers, totalUsers, ui]);

  const activityItems = useMemo(() => {
    return [
      { title: ui.activeAccountsTitle, value: percent(activeUsers, totalUsers), color: 'blue' },
      { title: ui.adminAccountsTitle, value: percent(adminUsers, totalUsers), color: 'green' },
      { title: ui.paidPlansTitle, value: percent(paidUsers, totalUsers), color: 'orange' },
      { title: ui.filteredViewTitle, value: percent(filteredUsers.length, Math.max(totalUsers, 1)), color: 'red' },
    ];
  }, [activeUsers, adminUsers, filteredUsers.length, paidUsers, totalUsers, ui]);

  const timelineItems = useMemo(() => {
    return [
      { title: ui.directorySynced, time: ui.now, detail: t('admin_users.total_accounts_loaded', { count: totalUsers }) },
      { title: ui.activeAccountsTitle, time: ui.now, detail: t('admin_users.active_accounts_loaded', { count: activeUsers }) },
      { title: ui.inactiveAccounts, time: ui.now, detail: t('admin_users.inactive_accounts_loaded', { count: inactiveUsers }) },
      { title: ui.filteredViewTitle, time: ui.now, detail: t('admin_users.filtered_accounts', { count: filteredUsers.length }) },
    ];
  }, [activeUsers, filteredUsers.length, inactiveUsers, totalUsers, t, ui]);

  return (
    <div className={`user-shell ${sidebarCollapsed ? 'user-shell--collapsed' : ''}`} id="roles">
      <aside className="user-shell__sidebar">
        <div className="user-shell__brand">
          <div className="user-shell__brand-mark">GI</div>
          <div className="user-shell__brand-copy">
            <strong>GueInsight</strong>
            <span>{ui.adminDashboard}</span>
          </div>
        </div>

        <nav className="user-shell__nav" aria-label={ui.userManagement}>
          {sidebarItems.map((item) => (
            item.href.startsWith('/') ? (
              <Link
                key={item.label}
                to={item.href}
                aria-label={t(item.label)}
                className={`user-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="user-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="user-shell__nav-label">{t(item.label)}</span>
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                aria-label={t(item.label)}
                className={`user-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="user-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="user-shell__nav-label">{t(item.label)}</span>
              </a>
            )
          ))}
        </nav>

        <div className="user-shell__sidebar-card">
          <p className="user-shell__sidebar-label">{ui.userControls}</p>
          <h3>{ui.accountAdministration}</h3>
          <p>{ui.sidebarDescription}</p>
          <Link to="/admin" className="user-shell__sidebar-action">{ui.backToDashboard}</Link>
        </div>
      </aside>

      <main className="user-shell__content">
        <header className="user-shell__topbar">
          <div>
            <p className="user-shell__eyebrow">{ui.dashboard}</p>
            <h1>{ui.userManagement}</h1>
          </div>

          <AdminTopbarControls
            searchPlaceholder={ui.searchUsers}
            searchAriaLabel={ui.searchUsers}
            primaryActionHref="/admin"
            primaryActionLabel={ui.adminDashboard}
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
                <p className="user-shell__section-label">{ui.accounts}</p>
                <h2>{ui.subscriberList}</h2>
              </div>
              <span className="user-shell__chip">{ui.preview}</span>
            </div>

            <div className="user-shell__table-wrap">
              <table className="user-shell__table">
                <thead>
                  <tr>
                    <th>{ui.user}</th>
                    <th>{ui.email}</th>
                    <th>{ui.plan}</th>
                    <th>{ui.role}</th>
                    <th>{ui.status}</th>
                    <th>{ui.actions}</th>
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
                          {ui.open}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && !error && filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6}>{ui.noUsersMatch}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {loading ? <p className="user-shell__feedback">{ui.loadingUsers}</p> : null}
              {error ? <p className="user-shell__feedback user-shell__feedback--error">{error}</p> : null}
            </div>
          </article>

          <article className="user-shell__panel user-shell__panel--activity" id="logs">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">{ui.activity}</p>
                <h2>{ui.accountTimeline}</h2>
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
                <p className="user-shell__section-label">{ui.filters}</p>
                <h2>{ui.findAccount}</h2>
              </div>
            </div>

            <div className="user-shell__filters">
              <label className="user-shell__field">
                <span>{ui.search}</span>
                <input
                  type="text"
                  placeholder={ui.searchByNameOrEmail}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>

              <label className="user-shell__field">
                <span>{ui.role}</span>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">{ui.allRoles}</option>
                  <option value="user">{ui.users}</option>
                  <option value="admin">{ui.staffAdmins}</option>
                </select>
              </label>

              <label className="user-shell__field">
                <span>{ui.status}</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">{ui.anyStatus}</option>
                  <option value="active">{ui.active}</option>
                  <option value="inactive">{ui.inactive}</option>
                </select>
              </label>
            </div>
          </article>

          <article className="user-shell__panel user-shell__panel--activity">
            <div className="user-shell__panel-header">
              <div>
                <p className="user-shell__section-label">{ui.status}</p>
                <h2>{ui.distributionMix}</h2>
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
        <section className="user-shell__detail-overlay" role="dialog" aria-modal="true" aria-label={ui.userProfile}>
          <article className="user-shell__detail-card">
            <header className="user-shell__detail-header">
              <div>
                <p className="user-shell__section-label">{ui.userProfile}</p>
                <h2>{selectedUser ? nameFromUser(selectedUser, ui.unknownUser) : ui.loadingUser}</h2>
              </div>
              <button type="button" className="user-shell__detail-close" onClick={closeUserDetail} aria-label={ui.close}>
                {ui.close}
              </button>
            </header>

            {detailLoading ? <p className="user-shell__feedback">{ui.loadingUserDetailsText}</p> : null}
            {detailError ? <p className="user-shell__feedback user-shell__feedback--error">{detailError}</p> : null}

            {selectedUser && !detailLoading ? (
              <>
                <dl className="user-shell__detail-grid">
                  <div>
                    <dt>{ui.email}</dt>
                    <dd>{selectedUser.email || ui.na}</dd>
                  </div>
                  <div>
                    <dt>{ui.status}</dt>
                    <dd>{selectedUser.is_active ? ui.active : ui.inactive}</dd>
                  </div>
                  <div>
                    <dt>{ui.role}</dt>
                    <dd>{normalizeRole(selectedUser.role) === 'admin' ? t('admin_users.role_admin') : t('admin_users.role_user')}</dd>
                  </div>
                  <div>
                    <dt>{ui.plan}</dt>
                    <dd>{displayPlan(selectedUser.current_plan)}</dd>
                  </div>
                  <div>
                    <dt>{ui.firstName}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.first_name}
                          onChange={(event) => handleDraftChange('first_name', event.target.value)}
                        />
                      ) : (
                        selectedUser.first_name || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.lastName}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.last_name}
                          onChange={(event) => handleDraftChange('last_name', event.target.value)}
                        />
                      ) : (
                        selectedUser.last_name || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.phone}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.phone_number}
                          onChange={(event) => handleDraftChange('phone_number', event.target.value)}
                        />
                      ) : (
                        selectedUser.phone_number || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.company}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.company}
                          onChange={(event) => handleDraftChange('company', event.target.value)}
                        />
                      ) : (
                        selectedUser.company || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.jobTitle}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.job_title}
                          onChange={(event) => handleDraftChange('job_title', event.target.value)}
                        />
                      ) : (
                        selectedUser.job_title || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.teamSize}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.team_size}
                          onChange={(event) => handleDraftChange('team_size', event.target.value)}
                        />
                      ) : (
                        selectedUser.team_size || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.primaryUseCase}</dt>
                    <dd>
                      {editMode ? (
                        <input
                          className="user-shell__detail-input"
                          type="text"
                          value={profileDraft.primary_use_case}
                          onChange={(event) => handleDraftChange('primary_use_case', event.target.value)}
                        />
                      ) : (
                        selectedUser.primary_use_case || ui.na
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.newsletter}</dt>
                    <dd>
                      {editMode ? (
                        <label className="user-shell__detail-checkbox">
                          <input
                            type="checkbox"
                            checked={profileDraft.newsletter_opt_in}
                            onChange={(event) => handleDraftChange('newsletter_opt_in', event.target.checked)}
                          />
                          <span>{ui.optedIn}</span>
                        </label>
                      ) : (
                        selectedUser.newsletter_opt_in ? ui.optedIn : ui.notSubscribed
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{ui.created}</dt>
                    <dd>{formatDateTime(selectedUser.created_at, ui.na)}</dd>
                  </div>
                  <div>
                    <dt>{ui.fileUploads}</dt>
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
                      {ui.editProfile}
                    </button>
                  ) : null}

                  {editMode ? (
                    <button
                      type="button"
                      className="user-shell__detail-action"
                      disabled={actionLoading}
                      onClick={() => runUserAction('save_profile')}
                    >
                      {ui.saveProfile}
                    </button>
                  ) : null}

                  {editMode ? (
                    <button
                      type="button"
                      className="user-shell__detail-action"
                      disabled={actionLoading}
                      onClick={cancelEditProfile}
                    >
                      {ui.cancelEdit}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="user-shell__detail-action"
                    disabled={!availableActions.can_toggle_active || actionLoading || editMode}
                    onClick={() => runUserAction('toggle_active')}
                  >
                    {selectedUser.is_active ? ui.deactivateAccount : ui.activateAccount}
                  </button>
                  <button
                    type="button"
                    className="user-shell__detail-action"
                    disabled={!availableActions.can_change_role || actionLoading || editMode}
                    onClick={() => runUserAction('toggle_role')}
                  >
                    {normalizeRole(selectedUser.role) === 'admin' ? ui.setStandardUser : ui.promoteToAdmin}
                  </button>
                  <button
                    type="button"
                    className="user-shell__detail-action user-shell__detail-action--danger"
                    disabled={!availableActions.can_delete || actionLoading || editMode}
                    onClick={() => runUserAction('delete')}
                  >
                    {ui.deleteAccount}
                  </button>
                </div>

                {actionMessage ? <p className="user-shell__feedback">{actionMessage}</p> : null}

                <section className="user-shell__detail-logs">
                  <div className="user-shell__panel-header">
                    <div>
                      <p className="user-shell__section-label">{ui.subscription}</p>
                      <h3>{ui.subscriptionDetails}</h3>
                    </div>
                  </div>

                  <dl className="user-shell__subscription-grid">
                    <div>
                      <dt>{ui.status}</dt>
                      <dd>{toTitle(subscriptionSummary.status || 'none')}</dd>
                    </div>
                    <div>
                      <dt>{ui.plan}</dt>
                      <dd>{displayPlan(subscriptionSummary.current_plan)}</dd>
                    </div>
                    <div>
                      <dt>{ui.started}</dt>
                      <dd>{formatDateTime(subscriptionSummary.current_start_date, ui.na)}</dd>
                    </div>
                    <div>
                      <dt>{ui.expires}</dt>
                      <dd>{formatDateTime(subscriptionSummary.current_end_date, ui.na)}</dd>
                    </div>
                    <div>
                      <dt>{ui.totalPlans}</dt>
                      <dd>{subscriptionSummary.total_subscriptions || 0}</dd>
                    </div>
                  </dl>

                  {subscriptionHistory.length ? (
                    <ul className="user-shell__detail-log-list">
                      {subscriptionHistory.map((subscription) => (
                        <li key={subscription.id}>
                          <strong>{displayPlan(subscription.plan)}</strong>
                          <span>
                            {displayPlan(subscription.plan)}
                            {' '}
                            {formatDateTime(subscription.start_date, ui.na)} - {formatDateTime(subscription.end_date, ui.na)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="user-shell__feedback">{ui.noSubscriptionHistory}</p>
                  )}
                </section>

                <section className="user-shell__detail-logs">
                  <div className="user-shell__panel-header">
                    <div>
                      <p className="user-shell__section-label">{ui.recentActivity}</p>
                      <h3>{ui.latestAdminActions}</h3>
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
                    <p className="user-shell__feedback">{ui.noActivityLogs}</p>
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
