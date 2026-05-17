import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './Navbar.css';
import SITE_CONFIG from '../config';
import { getNavLinks } from '../utils/navLinks';
import { useTranslation } from '../i18n/index';
import LanguageSelector from './LanguageSelector';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const controlsRef = useRef(null);
  const homePath = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/';

  const { t } = useTranslation();
  const navLinks = useMemo(() => getNavLinks(user, homePath, t), [user, homePath, t]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!controlsRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = Number(user?.unread_notifications || 0);

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const response = await api.get('/auth/notifications?limit=8');
      setNotifications(Array.isArray(response.data?.notifications) ? response.data.notifications : []);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    setAccountMenuOpen(false);
    if (next) {
      await loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    await api.post('/auth/notifications/read_all', {});
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const firstName = user?.first_name || user?.user_metadata?.first_name || '';
  const lastName = user?.last_name || user?.user_metadata?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const welcomeLabel = firstName ? `Welcome, ${firstName}` : '';
  const displayName = fullName || user?.email || '';

  return (
    <nav className="app-navbar" aria-label="Primary navigation">
      <div className="app-navbar__container">
        <div className="app-navbar__brand-group">
          <Link to={homePath} className="app-navbar__brand" onClick={closeMenu}>
            <img
              src="/img/logo.png"
              alt="Gue Cyber"
              className="app-navbar__logo"
              onError={(e) => { e.currentTarget.src = '/img/guecyber-logo.svg'; }}
            />
            <span className="app-navbar__brand-text">GueInsight</span>
          </Link>
          <span className="app-navbar__subtitle">{t('landing.utility')}</span>
        </div>

        <button
          type="button"
          className="app-navbar__toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-controls="app-navbar-menu"
          aria-label="Toggle navigation menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div id="app-navbar-menu" className={`app-navbar__menu ${menuOpen ? 'is-open' : ''}`}>
          <div className="app-navbar__meta">
            {welcomeLabel ? <span className="app-navbar__role-badge">{welcomeLabel}</span> : null}
          </div>

          <div className="app-navbar__links">
            {navLinks.map((link, index) => (
              <React.Fragment key={link.to}>
                {link.external ? (
                  <a
                    href={link.to}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={`app-navbar__link`}
                    onClick={closeMenu}
                    aria-label={`${link.label} (opens in new tab)`}
                  >
                    {link.label}
                    <svg className="external-link-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path>
                      <path fill="currentColor" d="M5 5h5V3H3v7h2V5z"></path>
                    </svg>
                  </a>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    className={({ isActive }) => `app-navbar__link ${isActive ? 'is-active' : ''}`}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </NavLink>
                )}
                {index < navLinks.length - 1 ? <span className="app-navbar__separator" aria-hidden="true"> </span> : null}
              </React.Fragment>
            ))}
          </div>

          <div className="app-navbar__actions" ref={controlsRef}>
            <LanguageSelector />
            {!user ? (
              <>
                <NavLink to="/login" className={({ isActive }) => `app-navbar__link app-navbar__link--ghost ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
                  {t('nav.login')}
                </NavLink>
                {SITE_CONFIG.showVisitorCTA ? (
                  <NavLink to="/signup" className={({ isActive }) => `app-navbar__link app-navbar__link--primary ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
                    {t('nav.signup')}
                  </NavLink>
                ) : null}
              </>
            ) : (
              <>
                <div className="app-navbar__group">
                  <button
                    type="button"
                    className="app-navbar__icon-button"
                    onClick={handleToggleNotifications}
                    aria-label={t('topbar.view_notifications')}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="menu"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5L3 18v1h18v-1l-2-2Z" />
                    </svg>
                    {unreadCount > 0 ? <span className="app-navbar__badge">{unreadCount}</span> : null}
                  </button>

                  {notificationsOpen ? (
                    <div className="app-navbar__dropdown" role="menu">
                      <div className="app-navbar__dropdown-head">
                        <strong>{t('topbar.notifications')}</strong>
                        <span>{unreadCount} {t('topbar.unread')}</span>
                      </div>
                      {loadingNotifications ? <p className="app-navbar__dropdown-empty">{t('topbar.loading')}</p> : null}
                      {!loadingNotifications && notifications.length === 0 ? <p className="app-navbar__dropdown-empty">{t('topbar.no_notifications')}</p> : null}
                      <div className="app-navbar__notification-list">
                        {notifications.map((notification) => (
                          <article key={notification.id} className="app-navbar__notification-item">
                            <strong>{notification.title}</strong>
                            <p>{notification.message}</p>
                          </article>
                        ))}
                      </div>
                      {notifications.length ? (
                        <button type="button" className="app-navbar__mark-read" onClick={handleMarkAllRead}>
                          {t('topbar.mark_all_read')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

              <div className="app-navbar__account">
                <button
                  type="button"
                  className="app-navbar__account-trigger"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  aria-label={displayName ? `${displayName} account menu` : t('nav.account')}
                >
                  {t('nav.account')}
                </button>
                {accountMenuOpen ? (
                  <div className="app-navbar__account-menu" role="menu">
                    <NavLink
                      to="/support"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      {t('topbar.open_support')}
                    </NavLink>
                    <NavLink
                      to="/subscription"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      {t('topbar.manage_plan')}
                    </NavLink>
                    <NavLink
                      to="/profile"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      {t('topbar.account_settings')}
                    </NavLink>
                    <button
                      type="button"
                      className="app-navbar__account-item app-navbar__account-item--danger"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      {t('topbar.logout')}
                    </button>
                  </div>
                ) : null}
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
