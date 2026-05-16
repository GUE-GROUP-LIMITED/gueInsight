import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const logoSrc = '/img/guecyber-logo.png';
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="app-footer__inner">
        <div className="app-footer__brand-group">
          <img
            src="/img/logo.png"
            alt="Gue Cyber"
            className="app-footer__logo"
            onError={(e) => { e.currentTarget.src = '/img/guecyber-logo.svg'; }}
          />
          <div className="app-footer__brand">GueInsight</div>
        </div>

        <div className="app-footer__meta">
          <nav className="app-footer__nav" aria-label="Footer navigation">
            <Link to="/">Platform</Link>
            <Link to="/login">Login</Link>
            <Link to="/subscription">Solutions</Link>
            <Link to="/support">Resources</Link>
          </nav>
          <div><strong>GueInsight</strong> — a product of <a href="https://www.guecyber.com" target="_blank" rel="noreferrer">Gue Cyber</a></div>
          <div>For services, assessments, or consultancy, visit <a href="https://www.guecyber.com" target="_blank" rel="noreferrer">guecyber.com</a> or contact <a href="mailto:info@guecyber.com">info@guecyber.com</a>.</div>
          <div className="app-footer__legal">Enterprise number: 1037.163.392 · Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
