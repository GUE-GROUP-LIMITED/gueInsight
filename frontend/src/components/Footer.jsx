import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="app-footer" role="contentinfo">
    <div className="app-footer__top">
      {/* Brand column */}
      <div className="app-footer__brand-col">
        <div className="app-footer__brand-row">
          {/* SVG shield icon — same as nav */}
          <svg width="30" height="30" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#1A1A1A"/>
            <path d="M14 5L6 8.5V14C6 18.1 9.4 21.7 14 23C18.6 21.7 22 18.1 22 14V8.5L14 5Z" fill="#E8490A"/>
            <path d="M11 14L13 16L17 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
        <a href="https://www.gabrielaloho.com" target="_blank" rel="noopener noreferrer">gabrielaloho.com</a>
        {' · '}
        Made in <span>☀️</span> Belgium
      </span>
    </div>
  </footer>
);

export default Footer;
