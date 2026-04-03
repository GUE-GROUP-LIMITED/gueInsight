import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './UserTopbarControls.css';

const UserTopbarControls = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const controlsRef = useRef(null);

  const displayName = useMemo(() => {
    const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    return fullName || user?.email || 'User';
  }, [user]);

  const initials = useMemo(() => {
    const source = displayName;
    const letters = source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('');
    return (letters || 'GI').toUpperCase();
  }, [displayName]);

  const unreadCount = Number(user?.unread_notifications || 0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!controlsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const response = await api.get('/auth/notifications?limit=8');
      setNotifications(Array.isArray(response.data?.notifications) ? response.data.notifications : []);
      const unread = Number(response.data?.unread_count || 0);
      setUser((current) => ({ ...current, unread_notifications: unread }));
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    setMenuOpen(false);
    if (next) {
      await loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    await api.post('/auth/notifications/read_all', {});
    setUser((current) => ({ ...current, unread_notifications: 0 }));
    await loadNotifications();
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    setNotificationsOpen(false);
  };

  return (
    <div className="user-topbar-controls" ref={controlsRef}>
      <div className="user-topbar-controls__left">
        <Link to="/support" className="user-topbar-controls__pill">Open support</Link>
      </div>

      <div className="user-topbar-controls__right">
        <div className="user-topbar-controls__group">
          <button
            type="button"
            className="user-topbar-controls__icon-button"
            onClick={handleToggleNotifications}
            aria-label="View notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5L3 18v1h18v-1l-2-2Z" />
            </svg>
            {unreadCount > 0 ? <span className="user-topbar-controls__badge">{unreadCount}</span> : null}
          </button>

          {notificationsOpen ? (
            <div className="user-topbar-controls__dropdown" role="menu">
              <div className="user-topbar-controls__dropdown-head">
                <strong>Notifications</strong>
                <span>{unreadCount} unread</span>
              </div>
              {loadingNotifications ? <p className="user-topbar-controls__empty">Loading...</p> : null}
              {!loadingNotifications && notifications.length === 0 ? <p className="user-topbar-controls__empty">No notifications.</p> : null}
              <div className="user-topbar-controls__notification-list">
                {notifications.map((notification) => (
                  <article key={notification.id} className="user-topbar-controls__notification-item">
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                  </article>
                ))}
              </div>
              {notifications.length ? (
                <button type="button" className="user-topbar-controls__mark-read" onClick={handleMarkAllRead}>
                  Mark all as read
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="user-topbar-controls__group">
          <button
            type="button"
            className="user-topbar-controls__avatar-button"
            onClick={() => {
              setMenuOpen((current) => !current);
              setNotificationsOpen(false);
            }}
            aria-label="Open profile menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="user-topbar-controls__avatar">
              {user?.avatar_url ? <img src={user.avatar_url} alt="Profile avatar" /> : initials}
            </span>
            <span className="user-topbar-controls__avatar-copy">
              <strong>{displayName}</strong>
              <span>{String(user?.current_plan || 'free').replaceAll('_', ' ')}</span>
            </span>
          </button>

          {menuOpen ? (
            <div className="user-topbar-controls__dropdown user-topbar-controls__dropdown--menu" role="menu">
              <div className="user-topbar-controls__dropdown-head">
                <strong>{displayName}</strong>
                <span>Profile menu</span>
              </div>
              <Link to="/profile" className="user-topbar-controls__menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Account settings
              </Link>
              <Link to="/subscription" className="user-topbar-controls__menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Manage plan
              </Link>
              <Link to="/support" className="user-topbar-controls__menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                Open support
              </Link>
              <button type="button" className="user-topbar-controls__menu-item user-topbar-controls__menu-item--danger" onClick={handleLogout} role="menuitem">
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UserTopbarControls;
