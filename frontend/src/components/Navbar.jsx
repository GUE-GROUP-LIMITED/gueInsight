import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';
import SITE_CONFIG from '../config';
import { getNavLinks } from '../utils/navLinks';
import { useTranslation } from '../i18n/index';
import LanguageSelector from './LanguageSelector';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const homePath = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/';

  const { t } = useTranslation();
  const navLinks = useMemo(() => getNavLinks(user, homePath, t), [user, homePath, t]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    setAccountMenuOpen(false);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only show a role label when a user is signed in and the flag is enabled
  const roleLabel = (SITE_CONFIG.showRoleBadges && user) ? (user.role === 'admin' ? t('role.staff') : t('role.subscriber')) : null;
  const firstName = user?.first_name || user?.user_metadata?.first_name || '';
  const lastName = user?.last_name || user?.user_metadata?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = firstName || fullName || user?.email || '';

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
            {roleLabel ? <span className="app-navbar__role-badge">{roleLabel}</span> : null}
            {displayName ? <span className="app-navbar__email">{displayName}</span> : null}
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

          <div className="app-navbar__actions">
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
              <div className="app-navbar__account" ref={accountMenuRef}>
                <button
                  type="button"
                  className="app-navbar__account-trigger"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                >
                  {displayName || t('nav.account')}
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
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
