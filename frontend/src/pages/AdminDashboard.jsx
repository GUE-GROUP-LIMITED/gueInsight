import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import AdminTopbarControls from '../components/AdminTopbarControls';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';
import './AdminDashboard.css';

const sidebarItems = [
  { label: 'nav.home', href: '#dashboard', active: true, icon: 'home' },
  { label: 'admin_dashboard.compliance', href: '/admin/compliance', icon: 'shield' },
  { label: 'Access Control', href: '/admin/access', icon: 'shield' },
  { label: 'vCISO Publisher', href: '#vciso-publisher', icon: 'shield' },
  { label: 'admin_dashboard.widgets', href: '#widgets', icon: 'widgets' },
  { label: 'admin_dashboard.tables', href: '#tables', icon: 'table' },
  { label: 'admin_dashboard.charts', href: '#charts', icon: 'chart' },
  { label: 'nav.support', href: '/admin/support', icon: 'logs' },
  { label: 'nav.subscribers', href: '/admin/users', icon: 'users' },
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

const formatDateTime = (isoLike) => {
  if (!isoLike) return 'N/A';
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const normalizePlan = (planLike) => {
  const raw = String(planLike || 'free').trim().toLowerCase();
  const legacyMap = {
    premium_individual: 'compliance_pro',
    premium_small_business: 'enterprise_risk',
    premium_large_business: 'enterprise_elite',
    premium: 'compliance_pro',
    freemium: 'free',
  };
  return legacyMap[raw] || raw;
};

const isEnterprisePlan = (planLike) => {
  const normalized = normalizePlan(planLike);
  return ['enterprise_professional', 'enterprise_risk', 'enterprise_elite'].includes(normalized);
};

const VCISO_PAGE_SIZE = 8;

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({ users: [], file_uploads: [], critical_alert: false });
  const [vcisoForm, setVcisoForm] = useState({
    target_user_id: 'all',
    title: '',
    note: '',
    action_items: '',
    author_name: 'Gabriel Aloho',
  });
  const [vcisoSaving, setVcisoSaving] = useState(false);
  const [vcisoError, setVcisoError] = useState('');
  const [vcisoMessage, setVcisoMessage] = useState('');
  const [vcisoUpdates, setVcisoUpdates] = useState([]);
  const [vcisoLoading, setVcisoLoading] = useState(false);
  const [vcisoTotal, setVcisoTotal] = useState(0);
  const [vcisoPage, setVcisoPage] = useState(1);
  const [vcisoFilters, setVcisoFilters] = useState({
    status: 'all',
    scope: 'all',
  });
  const [vcisoSearch, setVcisoSearch] = useState('');
  const [vcisoSearchInput, setVcisoSearchInput] = useState('');
  const searchDebounceRef = useRef(null);
  const [editingUpdateId, setEditingUpdateId] = useState(null);
  const [vcisoEditForm, setVcisoEditForm] = useState({
    title: '',
    note: '',
    action_items: '',
    author_name: 'Gabriel Aloho',
  });

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
        setError(requestError?.response?.data?.error || t('admin_dashboard.load_failed'));
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
  }, [dashboardData.users, t]);

  const enterpriseUsers = useMemo(() => {
    return users.filter((user) => user.role === 'user' && isEnterprisePlan(user.plan));
  }, [users]);

  const vcisoTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(vcisoTotal / VCISO_PAGE_SIZE));
  }, [vcisoTotal]);

  const loadVcisoHistory = useCallback(async () => {
    try {
      setVcisoLoading(true);
      const params = new URLSearchParams({
        limit: String(VCISO_PAGE_SIZE),
        offset: String((vcisoPage - 1) * VCISO_PAGE_SIZE),
        status: vcisoFilters.status,
        scope: vcisoFilters.scope,
      });
      if (vcisoSearch.trim()) {
        params.set('q', vcisoSearch.trim());
      }
      const response = await api.get(`/api/admin/vciso?${params.toString()}`);
      const updates = Array.isArray(response?.data?.updates) ? response.data.updates : [];
      setVcisoUpdates(updates);
      setVcisoTotal(Number(response?.data?.total || 0));
    } catch {
      setVcisoUpdates([]);
      setVcisoTotal(0);
    } finally {
      setVcisoLoading(false);
    }
  }, [vcisoPage, vcisoFilters.status, vcisoFilters.scope, vcisoSearch]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === 'Active').length;
  const adminUsers = users.filter((user) => user.role === 'admin').length;
  const paidUsers = users.filter((user) => (user.plan || '').toLowerCase() !== 'free').length;
  const uploadsCount = dashboardData.file_uploads.length;

  const statCards = useMemo(() => {
    return [
      { label: t('admin_dashboard.registered_accounts'), value: totalUsers.toString(), detail: t('admin_dashboard.from_user_table'), tone: 'blue' },
      { label: t('admin_dashboard.active_users'), value: activeUsers.toString(), detail: t('admin_dashboard.can_access_platform'), tone: 'green' },
      {
        label: t('admin_dashboard.critical_alerts'),
        value: dashboardData.critical_alert ? '1' : '0',
        detail: dashboardData.critical_alert ? t('admin_dashboard.action_required') : t('admin_dashboard.no_critical_alert'),
        tone: 'orange',
      },
      { label: t('admin_dashboard.file_uploads'), value: uploadsCount.toString(), detail: t('admin_dashboard.analyzed_submissions'), tone: 'red' },
    ];
  }, [activeUsers, dashboardData.critical_alert, t, totalUsers, uploadsCount]);

  const activityItems = useMemo(() => {
    return [
      { title: t('admin_dashboard.active_accounts'), value: percent(activeUsers, totalUsers), color: 'blue' },
      { title: t('admin_dashboard.admin_coverage'), value: percent(adminUsers, totalUsers), color: 'green' },
      { title: t('admin_dashboard.paid_plans'), value: percent(paidUsers, totalUsers), color: 'orange' },
      { title: t('admin_dashboard.upload_density'), value: percent(uploadsCount, Math.max(totalUsers, 1)), color: 'red' },
    ];
  }, [activeUsers, adminUsers, paidUsers, t, totalUsers, uploadsCount]);

  const timelineItems = useMemo(() => {
    return [
      { title: t('admin_dashboard.users_loaded'), time: 'Now', detail: `${totalUsers} account${totalUsers === 1 ? '' : 's'} in directory` },
      { title: t('admin_dashboard.current_sign_ins'), time: 'Now', detail: `${activeUsers} active account${activeUsers === 1 ? '' : 's'}` },
      { title: t('admin_dashboard.staff_admins'), time: 'Now', detail: `${adminUsers} admin account${adminUsers === 1 ? '' : 's'} configured` },
      { title: t('admin_dashboard.file_ingestion'), time: 'Now', detail: `${uploadsCount} upload event${uploadsCount === 1 ? '' : 's'} recorded` },
    ];
  }, [activeUsers, adminUsers, t, totalUsers, uploadsCount]);

  const handleVcisoInput = (event) => {
    const { name, value } = event.target;
    setVcisoForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleVcisoSubmit = async (event) => {
    event.preventDefault();
    setVcisoError('');
    setVcisoMessage('');

    if (!vcisoForm.title.trim() || !vcisoForm.note.trim()) {
      setVcisoError('Title and recommendation note are required.');
      return;
    }

    const actionItems = vcisoForm.action_items
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      title: vcisoForm.title.trim(),
      note: vcisoForm.note.trim(),
      action_items: actionItems,
      author_name: vcisoForm.author_name.trim() || 'Gabriel Aloho',
    };

    if (vcisoForm.target_user_id === 'all') {
      payload.publish_to_all_enterprise = true;
    } else {
      payload.target_user_id = Number(vcisoForm.target_user_id);
    }

    try {
      setVcisoSaving(true);
      const response = await api.post('/api/admin/vciso', payload);
      const scope = response?.data?.scope || 'enterprise target';
      setVcisoMessage(`vCISO update published to ${scope}.`);
      setVcisoForm((current) => ({
        ...current,
        title: '',
        note: '',
        action_items: '',
      }));
      if (vcisoPage !== 1) {
        setVcisoPage(1);
      }
      await loadVcisoHistory();
    } catch (requestError) {
      setVcisoError(requestError?.response?.data?.error || 'Failed to publish vCISO update.');
    } finally {
      setVcisoSaving(false);
    }
  };

  const startEditingUpdate = (update) => {
    setEditingUpdateId(update.id);
    setVcisoEditForm({
      title: update.title || '',
      note: update.note || '',
      action_items: Array.isArray(update.action_items) ? update.action_items.join('\n') : '',
      author_name: update.author_name || 'Gabriel Aloho',
    });
    setVcisoError('');
    setVcisoMessage('');
  };

  const cancelEditingUpdate = () => {
    setEditingUpdateId(null);
    setVcisoEditForm({ title: '', note: '', action_items: '', author_name: 'Gabriel Aloho' });
  };

  const handleVcisoEditInput = (event) => {
    const { name, value } = event.target;
    setVcisoEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveUpdateChanges = async (updateId) => {
    setVcisoError('');
    setVcisoMessage('');

    const actionItems = vcisoEditForm.action_items
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setVcisoSaving(true);
      await api.patch(`/api/admin/vciso/${updateId}`, {
        title: vcisoEditForm.title.trim(),
        note: vcisoEditForm.note.trim(),
        action_items: actionItems,
        author_name: vcisoEditForm.author_name.trim() || 'Gabriel Aloho',
      });
      setVcisoMessage('vCISO update saved.');
      setEditingUpdateId(null);
      await loadVcisoHistory();
    } catch (requestError) {
      setVcisoError(requestError?.response?.data?.error || 'Failed to save vCISO update changes.');
    } finally {
      setVcisoSaving(false);
    }
  };

  const toggleUpdateActive = async (update) => {
    setVcisoError('');
    setVcisoMessage('');
    try {
      setVcisoSaving(true);
      await api.patch(`/api/admin/vciso/${update.id}`, {
        is_active: !update.is_active,
      });
      setVcisoMessage(update.is_active ? 'vCISO update deactivated.' : 'vCISO update reactivated.');
      await loadVcisoHistory();
    } catch (requestError) {
      setVcisoError(requestError?.response?.data?.error || 'Failed to change update status.');
    } finally {
      setVcisoSaving(false);
    }
  };

  const handleVcisoFilterChange = (name, value) => {
    setVcisoFilters((current) => ({
      ...current,
      [name]: value,
    }));
    setVcisoPage(1);
  };

  const handleVcisoSearchChange = (event) => {
    const value = event.target.value;
    setVcisoSearchInput(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setVcisoSearch(value);
      setVcisoPage(1);
    }, 380);
  };

  const clearVcisoSearch = () => {
    setVcisoSearchInput('');
    setVcisoSearch('');
    setVcisoPage(1);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
  };

  const handleVcisoPrevPage = () => {
    setVcisoPage((current) => Math.max(1, current - 1));
  };

  const handleVcisoNextPage = () => {
    setVcisoPage((current) => Math.min(vcisoTotalPages, current + 1));
  };

  useEffect(() => {
    loadVcisoHistory();
  }, [loadVcisoHistory]);

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
                <span className="admin-shell__nav-label">{t(item.label)}</span>
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`admin-shell__nav-link ${item.active ? 'is-active' : ''}`}
              >
                <span className="admin-shell__nav-icon" aria-hidden="true"><SidebarIcon type={item.icon} /></span>
                <span className="admin-shell__nav-label">{t(item.label)}</span>
              </a>
            )
          ))}
        </nav>

        <div className="admin-shell__sidebar-card">
          <p className="admin-shell__sidebar-label">{t('nav.support')}</p>
          <h3>{t('admin_dashboard.need_help')}</h3>
          <p>{t('admin_dashboard.sidebar_copy')}</p>
          <a href="#tables" className="admin-shell__sidebar-action">{t('admin_dashboard.open_tables')}</a>
        </div>
      </aside>

      <main className="admin-shell__content">
        <header className="admin-shell__topbar">
          <div>
            <p className="admin-shell__eyebrow">{t('nav.dashboard')}</p>
            <h1>{t('admin_dashboard.heading')}</h1>
          </div>

          <AdminTopbarControls
            searchPlaceholder={t('admin_dashboard.search')}
            searchAriaLabel={t('admin_dashboard.search_aria')}
            primaryActionHref="/admin/users"
            primaryActionLabel={t('admin_dashboard.manage_users')}
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
                <p className="admin-shell__section-label">{t('admin_dashboard.performance')}</p>
                <h2>{t('admin_dashboard.traffic_overview')}</h2>
              </div>
              <span className="admin-shell__chip">{t('admin_dashboard.live')}</span>
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
                <span><i className="is-blue" /> {t('admin_dashboard.total_visits')}</span>
                <span><i className="is-green" /> {t('admin_dashboard.signups')}</span>
                <span><i className="is-orange" /> {t('admin_dashboard.alerts')}</span>
              </div>
            </div>
          </article>

          <article className="admin-shell__panel admin-shell__panel--activity">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">{t('admin_dashboard.system_status')}</p>
                <h2>{t('admin_dashboard.activity_mix')}</h2>
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

        <section className="admin-shell__panel" id="vciso-publisher">
          <div className="admin-shell__panel-header">
            <div>
              <p className="admin-shell__section-label">vCISO Portal</p>
              <h2>Publish advisory update</h2>
            </div>
            <span className="admin-shell__chip">Enterprise only</span>
          </div>

          <form className="admin-shell__vciso-form" onSubmit={handleVcisoSubmit}>
            <label className="admin-shell__field">
              <span>Target audience</span>
              <select
                name="target_user_id"
                value={vcisoForm.target_user_id}
                onChange={handleVcisoInput}
                disabled={vcisoSaving}
              >
                <option value="all">All enterprise clients</option>
                {enterpriseUsers.map((enterpriseUser) => (
                  <option key={enterpriseUser.id} value={String(enterpriseUser.id)}>
                    {enterpriseUser.name} ({enterpriseUser.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-shell__field">
              <span>Title</span>
              <input
                name="title"
                value={vcisoForm.title}
                onChange={handleVcisoInput}
                placeholder="Priority recommendation: tighten identity controls"
                disabled={vcisoSaving}
              />
            </label>

            <label className="admin-shell__field">
              <span>Recommendation note</span>
              <textarea
                name="note"
                value={vcisoForm.note}
                onChange={handleVcisoInput}
                rows={4}
                placeholder="Describe the risk context, expected impact, and recommended direction."
                disabled={vcisoSaving}
              />
            </label>

            <label className="admin-shell__field">
              <span>Action items (one per line)</span>
              <textarea
                name="action_items"
                value={vcisoForm.action_items}
                onChange={handleVcisoInput}
                rows={4}
                placeholder={'Enable conditional access for privileged users\nAudit MFA coverage by business unit'}
                disabled={vcisoSaving}
              />
            </label>

            <label className="admin-shell__field">
              <span>Author</span>
              <input
                name="author_name"
                value={vcisoForm.author_name}
                onChange={handleVcisoInput}
                disabled={vcisoSaving}
              />
            </label>

            {vcisoError ? <p className="admin-shell__feedback admin-shell__feedback--error">{vcisoError}</p> : null}
            {vcisoMessage ? <p className="admin-shell__feedback admin-shell__feedback--success">{vcisoMessage}</p> : null}

            <div className="admin-shell__vciso-actions">
              <button type="submit" className="admin-shell__topbar-button" disabled={vcisoSaving}>
                {vcisoSaving ? 'Publishing...' : 'Publish to vCISO portal'}
              </button>
            </div>
          </form>

          <div className="admin-shell__vciso-history">
            <div className="admin-shell__panel-header">
              <div>
                <p className="admin-shell__section-label">vCISO history</p>
                <h2>Published updates</h2>
              </div>
            </div>

            <div className="admin-shell__vciso-toolbar">
              <div className="admin-shell__vciso-search">
                <input
                  type="search"
                  value={vcisoSearchInput}
                  onChange={handleVcisoSearchChange}
                  placeholder="Search by title, note, author, or client email…"
                  disabled={vcisoLoading || vcisoSaving}
                />
                {vcisoSearchInput ? (
                  <button
                    type="button"
                    className="admin-shell__chip admin-shell__chip--ghost"
                    onClick={clearVcisoSearch}
                    disabled={vcisoLoading || vcisoSaving}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="admin-shell__vciso-filter-group" role="group" aria-label="Filter updates by status">
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.status === 'all' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('status', 'all')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.status === 'active' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('status', 'active')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.status === 'inactive' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('status', 'inactive')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  Inactive
                </button>
              </div>

              <div className="admin-shell__vciso-filter-group" role="group" aria-label="Filter updates by scope">
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.scope === 'all' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('scope', 'all')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  Any scope
                </button>
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.scope === 'all_enterprise' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('scope', 'all_enterprise')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  All enterprise
                </button>
                <button
                  type="button"
                  className={`admin-shell__chip admin-shell__chip--ghost ${vcisoFilters.scope === 'single_client' ? 'is-selected' : ''}`}
                  onClick={() => handleVcisoFilterChange('scope', 'single_client')}
                  disabled={vcisoSaving || vcisoLoading}
                >
                  Single client
                </button>
              </div>
            </div>

            {vcisoLoading ? <p className="admin-shell__feedback">Loading vCISO updates...</p> : null}

            {!vcisoLoading && vcisoUpdates.length === 0 ? (
              <p className="admin-shell__feedback">No vCISO updates published yet.</p>
            ) : null}

            {!vcisoLoading && vcisoUpdates.length > 0 ? (
              <div className="admin-shell__vciso-list">
                {vcisoUpdates.map((update) => {
                  const isEditing = editingUpdateId === update.id;
                  return (
                    <article key={update.id} className={`admin-shell__vciso-item ${update.is_active ? '' : 'is-inactive'}`}>
                      {isEditing ? (
                        <div className="admin-shell__vciso-edit">
                          <input
                            name="title"
                            value={vcisoEditForm.title}
                            onChange={handleVcisoEditInput}
                            disabled={vcisoSaving}
                          />
                          <textarea
                            name="note"
                            value={vcisoEditForm.note}
                            onChange={handleVcisoEditInput}
                            rows={3}
                            disabled={vcisoSaving}
                          />
                          <textarea
                            name="action_items"
                            value={vcisoEditForm.action_items}
                            onChange={handleVcisoEditInput}
                            rows={3}
                            disabled={vcisoSaving}
                          />
                          <input
                            name="author_name"
                            value={vcisoEditForm.author_name}
                            onChange={handleVcisoEditInput}
                            disabled={vcisoSaving}
                          />
                          <div className="admin-shell__vciso-actions">
                            <button
                              type="button"
                              className="admin-shell__chip"
                              onClick={() => saveUpdateChanges(update.id)}
                              disabled={vcisoSaving}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="admin-shell__chip admin-shell__chip--ghost"
                              onClick={cancelEditingUpdate}
                              disabled={vcisoSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="admin-shell__vciso-item-head">
                            <div>
                              <h3>{update.title}</h3>
                              <p>
                                {update.scope === 'all_enterprise' ? 'All enterprise clients' : (update.target_user_email || 'Specific enterprise client')} • {formatDateTime(update.created_at)}
                              </p>
                            </div>
                            <span className={`admin-shell__status-pill admin-shell__status-pill--${update.is_active ? 'active' : 'inactive'}`}>
                              {update.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p>{update.note}</p>
                          {Array.isArray(update.action_items) && update.action_items.length > 0 ? (
                            <ul>
                              {update.action_items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                          <p className="admin-shell__vciso-meta">Author: {update.author_name || 'Gabriel Aloho'}</p>
                          <div className="admin-shell__vciso-actions">
                            <button
                              type="button"
                              className="admin-shell__chip admin-shell__chip--ghost"
                              onClick={() => startEditingUpdate(update)}
                              disabled={vcisoSaving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-shell__chip admin-shell__chip--ghost"
                              onClick={() => toggleUpdateActive(update)}
                              disabled={vcisoSaving}
                            >
                              {update.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {vcisoUpdates.length > 0 ? (
              <div className="admin-shell__vciso-pagination">
                <button
                  type="button"
                  className="admin-shell__chip admin-shell__chip--ghost"
                  onClick={handleVcisoPrevPage}
                  disabled={vcisoPage <= 1 || vcisoLoading || vcisoSaving}
                >
                  Previous
                </button>
                <p>
                  Page {vcisoPage} of {vcisoTotalPages} ({vcisoTotal} total)
                </p>
                <button
                  type="button"
                  className="admin-shell__chip admin-shell__chip--ghost"
                  onClick={handleVcisoNextPage}
                  disabled={vcisoPage >= vcisoTotalPages || vcisoLoading || vcisoSaving}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
