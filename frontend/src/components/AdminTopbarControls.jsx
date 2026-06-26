import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './AdminTopbarControls.css';

const notifications = [
  {
    title: '3 security alerts need review',
    detail: 'Threat queue updated 5 minutes ago',
    tone: 'alert',
  },
  {
    title: '2 user requests pending approval',
    detail: 'Subscriber actions await staff sign-off',
    tone: 'neutral',
  },
  {
    title: 'Backup finished successfully',
    detail: 'System snapshot completed just now',
    tone: 'success',
  },
];

const AdminTopbarControls = ({
  searchPlaceholder = 'Search',
  searchAriaLabel = 'Search admin content',
  primaryActionHref,
  primaryActionLabel,
  sidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const { user, logout } = useContext(AuthContext);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [openSupportCount, setOpenSupportCount] = useState(0);
  const controlsRef = useRef(null);

  const displayName = useMemo(() => {
    const firstName = user?.first_name || user?.user_metadata?.first_name || '';
    const lastName = user?.last_name || user?.user_metadata?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return firstName || fullName || user?.email || 'Admin';
  }, [user]);

  const initials = useMemo(() => {
    const firstName = user?.first_name || user?.user_metadata?.first_name || '';
    const lastName = user?.last_name || user?.user_metadata?.last_name || '';
    const source = `${firstName}${lastName}`.trim() || displayName;
    const letters = source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('');

    return (letters || 'GI').toUpperCase();
  }, [displayName, user]);

  const roleLabel = useMemo(() => {
    if (!user) return null;
    if (user?.role === 'admin') return 'Staff admin';
    return 'Signed in';
  }, [user]);

  const closeMenus = () => {
    setNotificationsOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!controlsRef.current?.contains(event.target)) {
        closeMenus();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSupportCount = async () => {
      try {
        const response = await api.get('/support_tickets');
        if (!active) return;
        const tickets = Array.isArray(response.data?.tickets) ? response.data.tickets : [];
        const openCount = tickets.filter((ticket) => ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status)).length;
        setOpenSupportCount(openCount);
      } catch {
        if (active) {
          setOpenSupportCount(0);
        }
      }
    };

    loadSupportCount();
    const intervalId = window.setInterval(loadSupportCount, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = 'Review this GueInsight admin view';

    try {
      if (navigator.share) {
        await navigator.share({ title: 'GueInsight Admin', text: shareText, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Admin link copied.');
        window.setTimeout(() => setShareMessage(''), 1800);
      } else {
        window.prompt('Copy this admin link', shareUrl);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setShareMessage('Unable to share right now.');
        window.setTimeout(() => setShareMessage(''), 1800);
      }
    }

    setMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    setNotificationsOpen(false);
  };

  return (
    <div className="admin-topbar-controls" ref={controlsRef}>
      {onToggleSidebar ? (
        <button
          type="button"
          className="admin-topbar-controls__sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand navigation pane' : 'Collapse navigation pane'}
          aria-pressed={sidebarCollapsed}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h10v2H4v-2Z" />
          </svg>
        </button>
      ) : null}

      <label className="admin-topbar-controls__search">
        <span className="sr-only">{searchAriaLabel}</span>
        <input type="search" placeholder={searchPlaceholder} aria-label={searchAriaLabel} />
      </label>

      {primaryActionHref ? (
        <Link to={primaryActionHref} className="admin-topbar-controls__primary-action">
          {primaryActionLabel}
        </Link>
      ) : null}

      <Link to="/admin/support" className="admin-topbar-controls__support-link" aria-label="Open support queue">
        Support queue
        <span className="admin-topbar-controls__support-count">{openSupportCount}</span>
      </Link>

      <div className="admin-topbar-controls__group">
        <button
          type="button"
          className="admin-topbar-controls__icon-button"
          onClick={() => {
            setNotificationsOpen((current) => !current);
            setMenuOpen(false);
          }}
          aria-label="View notifications"
          aria-expanded={notificationsOpen}
          aria-haspopup="menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5L3 18v1h18v-1l-2-2Z" />
          </svg>
          <span className="admin-topbar-controls__badge">3</span>
        </button>

        {notificationsOpen ? (
          <div className="admin-topbar-controls__dropdown admin-topbar-controls__dropdown--notifications" role="menu">
            <div className="admin-topbar-controls__dropdown-head">
              <strong>Notifications</strong>
              <span>Latest activity</span>
            </div>
            <div className="admin-topbar-controls__notification-list">
              {notifications.map((notification) => (
                <div key={notification.title} className={`admin-topbar-controls__notification-item is-${notification.tone}`}>
                  <span className="admin-topbar-controls__notification-dot" />
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="admin-topbar-controls__group">
        <button
          type="button"
          className="admin-topbar-controls__avatar-button"
          onClick={() => {
            setMenuOpen((current) => !current);
            setNotificationsOpen(false);
          }}
          aria-label="Open admin user menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="admin-topbar-controls__avatar">{initials}</span>
          <span className="admin-topbar-controls__avatar-copy">
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </span>
        </button>

        {menuOpen ? (
          <div className="admin-topbar-controls__dropdown admin-topbar-controls__dropdown--menu" role="menu">
            <div className="admin-topbar-controls__dropdown-head">
              <strong>{displayName}</strong>
              <span>{roleLabel}</span>
            </div>
            <Link to="/admin/profile" className="admin-topbar-controls__menu-item" role="menuitem" onClick={closeMenus}>
              Settings
            </Link>
            <button type="button" className="admin-topbar-controls__menu-item" onClick={handleShare} role="menuitem">
              Share
            </button>
            <Link to="/admin/change-password" className="admin-topbar-controls__menu-item" role="menuitem" onClick={closeMenus}>
              Change password
            </Link>
            <button type="button" className="admin-topbar-controls__menu-item admin-topbar-controls__menu-item--danger" onClick={handleLogout} role="menuitem">
              Logout
            </button>
          </div>
        ) : null}
      </div>

      {shareMessage ? <p className="admin-topbar-controls__toast">{shareMessage}</p> : null}
    </div>
  );
};

export default AdminTopbarControls;