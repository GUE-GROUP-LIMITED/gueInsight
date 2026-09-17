import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="app-footer" role="contentinfo">
    <div className="app-footer__top">
      {/* Brand column */}
      <div className="app-footer__brand-col">
        <div className="app-footer__brand-row">
          {/* Real logo from public/img/logo.png */}
          <img
            src="/img/logo.png"
            alt="GueInsight logo"
            className="app-footer__logo"
            width="30"
            height="30"
          />
          <div className="app-footer__brand-name">Gue<span>Insight</span></div>
        </div>
        <div className="app-footer__brand-sub">Subscription-based threat intelligence platform · by Gue Cyber · Belgium</div>
        <div className="app-footer__legal">Enterprise no: 1037.163.392 · Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium</div>
      </div>

      {/* Product links */}
      <div className="app-footer__nav-group">
        <h4>Product</h4>
        <ul>
          <li><Link to="/#features">Features</Link></li>
          <li><Link to="/docs#getting-started">How It Works</Link></li>
          <li><Link to="/subscription">Pricing</Link></li>
          <li><Link to="/#who">Who It's For</Link></li>
          <li><Link to="/resources">Resources</Link></li>
          <li><Link to="/status">Status</Link></li>
        </ul>
      </div>

      {/* Gue Cyber links */}
      <div className="app-footer__nav-group">
        <h4>Gue Cyber</h4>
        <ul>
          <li><a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">guecyber.com</a></li>
          <li><a href="https://www.guecyber.com/#services" target="_blank" rel="noopener noreferrer">vCISO Services</a></li>
          <li><a href="https://www.guecyber.com/#nis2" target="_blank" rel="noopener noreferrer">NIS2 Compliance</a></li>
          <li><a href="https://www.gabrielaloho.com" target="_blank" rel="noopener noreferrer">gabrielaloho.com</a></li>
        </ul>
      </div>

      {/* Legal links */}
      <div className="app-footer__nav-group">
        <h4>Legal</h4>
        <ul>
          <li><Link to="/privacy">Privacy Policy</Link></li>
          <li><Link to="/terms">Terms of Service</Link></li>
          <li><Link to="/docs#compliance">GDPR</Link></li>
        </ul>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="app-footer__bottom">
      <span>© 2026 GueInsight · A Gue Cyber product · Avelgem, Belgium</span>
      <span className="app-footer__made">
        <a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">guecyber.com</a>
        {' · '}
        Made in Belgium
      </span>
    </div>
  </footer>
);

export default Footer;
