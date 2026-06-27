import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="app-footer" role="contentinfo">
    <div className="app-footer__top">
      <div className="app-footer__brand-col">
        <div className="app-footer__brand-row">
          <img src="/img/logo.png" alt="GueInsight" className="app-footer__logo" onError={(e) => { e.currentTarget.src = '/img/guecyber-logo.svg'; }} />
          <div className="app-footer__brand-name">Gue<span>Insight</span></div>
        </div>
        <div className="app-footer__brand-sub">SUBSCRIPTION-BASED THREAT INTELLIGENCE PLATFORM · BY GUE CYBER · BELGIUM</div>
        <div className="app-footer__legal">Enterprise no: 1037.163.392 · Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium</div>
      </div>

      <div className="app-footer__nav-group">
        <h4>PRODUCT</h4>
        <ul>
          <li><Link to="/#features">Features</Link></li>
          <li><Link to="/docs#getting-started">How It Works</Link></li>
          <li><Link to="/subscription">Pricing</Link></li>
          <li><Link to="/#who">Who It's For</Link></li>
        </ul>
      </div>

      <div className="app-footer__nav-group">
        <h4>GUE CYBER</h4>
        <ul>
          <li><a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">guecyber.com</a></li>
          <li><a href="https://www.guecyber.com/#services" target="_blank" rel="noopener noreferrer">vCISO Services</a></li>
          <li><a href="https://www.guecyber.com/#nis2" target="_blank" rel="noopener noreferrer">NIS2 Compliance</a></li>
          <li><a href="https://www.gabrielaloho.com" target="_blank" rel="noopener noreferrer">gabrielaloho.com</a></li>
        </ul>
      </div>

      <div className="app-footer__nav-group">
        <h4>LEGAL</h4>
        <ul>
          <li><Link to="/privacy">Privacy Policy</Link></li>
          <li><Link to="/terms">Terms of Service</Link></li>
          <li><Link to="/docs#compliance">GDPR</Link></li>
        </ul>
      </div>
    </div>

    <div className="app-footer__bottom">
      <span>© 2026 GueInsight · A Gue Cyber product · Avelgem, Belgium</span>
      <span>
        <a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">guecyber.com</a>
        {' · '}
        <a href="https://www.gabrielaloho.com" target="_blank" rel="noopener noreferrer">gabrielaloho.com</a>
      </span>
    </div>
  </footer>
);

export default Footer;
