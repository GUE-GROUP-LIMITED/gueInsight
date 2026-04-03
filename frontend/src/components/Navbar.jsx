import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const homePath = user?.role === 'admin' ? '/admin' : user ? '/dashboard' : '/';

  const navLinks = useMemo(() => {
    if (user) {
      if (user.role === 'admin') {
        return [
          { to: '/admin', label: 'Admin Dashboard' },
          { to: '/admin/users', label: 'Subscribers' },
          { to: '/profile', label: 'Profile' },
        ];
      }

      return [
        { to: homePath, label: 'Home' },
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/support', label: 'Support' },
        { to: '/profile', label: 'Profile' },
        { to: '/subscription', label: 'Plans' },
      ];
    }

    return [
      { to: '/', label: 'Home' },
      { to: '/subscription', label: 'Plans' },
    ];
  }, [homePath, user]);

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

  const roleLabel = user?.role === 'admin' ? 'Staff' : user ? 'Subscriber' : 'Guest';
  const firstName = user?.first_name || user?.user_metadata?.first_name || '';
  const lastName = user?.last_name || user?.user_metadata?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = firstName || fullName || user?.email || '';

  return (
    <nav className="app-navbar" aria-label="Primary navigation">
      <div className="app-navbar__container">
        <div className="app-navbar__brand-group">
          <Link to={homePath} className="app-navbar__brand" onClick={closeMenu}>
            GueInsight
          </Link>
          <span className="app-navbar__subtitle">Cyber threat intelligence</span>
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
            <span className="app-navbar__role-badge">{roleLabel}</span>
            {displayName ? <span className="app-navbar__email">Welcome, {displayName}</span> : null}
          </div>

          <div className="app-navbar__links">
            {navLinks.map((link, index) => (
              <React.Fragment key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => `app-navbar__link ${isActive ? 'is-active' : ''}`}
                  onClick={closeMenu}
                >
                  {link.label}
                </NavLink>
                {index < navLinks.length - 1 ? <span className="app-navbar__separator" aria-hidden="true"> </span> : null}
              </React.Fragment>
            ))}
          </div>

          <div className="app-navbar__actions">
            {!user ? (
              <>
                <NavLink to="/login" className={({ isActive }) => `app-navbar__link app-navbar__link--ghost ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
                  Login
                </NavLink>
                <NavLink to="/signup" className={({ isActive }) => `app-navbar__link app-navbar__link--primary ${isActive ? 'is-active' : ''}`} onClick={closeMenu}>
                  Sign Up
                </NavLink>
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
                  {displayName || 'Account'}
                </button>
                {accountMenuOpen ? (
                  <div className="app-navbar__account-menu" role="menu">
                    <NavLink
                      to="/support"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      Open support
                    </NavLink>
                    <NavLink
                      to="/subscription"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      Manage plan
                    </NavLink>
                    <NavLink
                      to="/profile"
                      className="app-navbar__account-item"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      Account settings
                    </NavLink>
                    <button
                      type="button"
                      className="app-navbar__account-item app-navbar__account-item--danger"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      Logout
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
