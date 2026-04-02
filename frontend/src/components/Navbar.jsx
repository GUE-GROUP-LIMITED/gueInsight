import React, { useContext, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
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
  };

  const closeMenu = () => setMenuOpen(false);

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
              <button type="button" className="app-navbar__logout" onClick={handleLogout}>
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
