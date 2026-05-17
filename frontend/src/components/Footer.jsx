import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/index';
import SITE_CONFIG from '../config';
import './Footer.css';

const Footer = () => {
  const { t } = useTranslation();
  const footerLinks = [
    { to: '/subscription', label: t('nav.pricing') || 'Pricing' },
    { to: '/docs', label: t('nav.docs') || 'Documentation' },
    { to: 'https://www.guecyber.com', label: t('nav.company') || SITE_CONFIG.companyLabel || 'Gue Cyber', external: true },
  ];
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
            {footerLinks.map((link) => (
              link.external ? (
                <a key={link.label}
                   href={link.to}
                   target="_blank"
                   rel="noopener noreferrer nofollow"
                   aria-label={`${link.label} (opens in new tab)`}
                >
                  {link.label}
                  <svg className="external-link-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path>
                    <path fill="currentColor" d="M5 5h5V3H3v7h2V5z"></path>
                  </svg>
                </a>
              ) : (
                <Link key={link.to} to={link.to}>{link.label}</Link>
              )
            ))}
          </nav>
          <div><strong>GueInsight</strong> — {t('footer.product_of')} <a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">Gue Cyber</a></div>
          <div>{t('footer.services_text')} <a href="https://www.guecyber.com" target="_blank" rel="noopener noreferrer">guecyber.com</a> {t('footer.or_contact')} <a href="mailto:info@guecyber.com">info@guecyber.com</a>.</div>
          <div className="app-footer__legal">{t('footer.enterprise_number')}: 1037.163.392 · Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
