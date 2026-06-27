import SITE_CONFIG from '../config';

export function getNavLinks(user, homePath = '/', t) {
  if (user) {
    if (user.role === 'admin') {
      return [
        { to: '/admin',            label: t ? t('nav.admin_dashboard') : 'Admin Dashboard' },
        { to: '/admin/users',      label: t ? t('nav.subscribers')     : 'Subscribers' },
        { to: '/admin/compliance', label: 'Compliance' },
      ];
    }

    return [
      { to: '/dashboard',             label: t ? t('nav.home')   : 'Dashboard' },
      { to: '/dashboard/compliance',  label: '📋 Compliance' },
      { to: '/dashboard/vciso',       label: '🛡️ vCISO' },
      { to: '/support',               label: t ? t('nav.support') : 'Support' },
      { to: '/subscription',          label: t ? t('nav.plans')   : 'Plans' },
    ];
  }

  const companyLabel = t ? t('nav.company') : (SITE_CONFIG.companyLabel || 'Gue Cyber');
  return [
    { to: '/subscription',          label: t ? t('nav.pricing') : 'Pricing' },
    { to: '/docs',                  label: t ? t('nav.docs')    : 'Documentation' },
    { to: 'https://www.guecyber.com', label: companyLabel, external: true },
  ];
}
