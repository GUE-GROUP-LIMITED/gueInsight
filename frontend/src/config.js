// Frontend feature flags and small site config
const SITE_CONFIG = {
  // When true, show a subtle "Sign up" CTA in the header for anonymous visitors
  showVisitorCTA: true,
  // When true, show role badges for signed-in users (Subscriber / Staff)
  showRoleBadges: true,
  // Label used for the external company link (can be set at build-time via Vite env)
  companyLabel: import.meta.env.VITE_COMPANY_LABEL || 'Gue Cyber',
};

export default SITE_CONFIG;
