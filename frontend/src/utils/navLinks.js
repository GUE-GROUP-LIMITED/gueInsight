import SITE_CONFIG from '../config';
import { useTranslation } from '../i18n/index';

// Returns the navigation links used in the header and footer
export function getNavLinks(user, homePath = '/', t) {
  if (user) {
    if (user.role === 'admin') {
      return [
        { to: '/admin', label: t ? t('nav.admin_dashboard') : 'Admin Dashboard' },
        { to: '/admin/users', label: t ? t('nav.subscribers') : 'Subscribers' },
        { to: '/profile', label: t ? t('nav.profile') : 'Profile' },
      ];
    }

    return [
      { to: homePath, label: t ? t('nav.home') : 'Home' },
      { to: '/dashboard', label: t ? t('nav.dashboard') : 'Dashboard' },
      { to: '/support', label: t ? t('nav.support') : 'Support' },
      { to: '/profile', label: t ? t('nav.profile') : 'Profile' },
      { to: '/subscription', label: t ? t('nav.plans') : 'Plans' },
    ];
  }

  const companyLabel = t ? t('nav.company') : (SITE_CONFIG.companyLabel || 'Gue Cyber');
  const pricing = t ? t('nav.pricing') : 'Pricing';
  const docs = t ? t('nav.docs') : 'Documentation';
  return [
    { to: '/subscription', label: pricing },
    { to: '/docs', label: docs },
    { to: 'https://www.guecyber.com', label: companyLabel, external: true },
  ];
}
