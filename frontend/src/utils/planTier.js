export const normalizePlan = (planLike) => {
  const raw = String(planLike || 'free').toLowerCase();
  if (raw.includes('enterprise_professional')) return 'enterprise_professional';
  if (raw.includes('enterprise_risk') || raw.includes('risk')) return 'enterprise_risk';
  if (raw.includes('enterprise_elite') || raw.includes('elite')) return 'enterprise_elite';
  if (raw.includes('compliance')) return 'compliance_pro';
  if (raw.includes('starter')) return 'starter';
  if (raw.includes('free')) return 'free';
  if (raw.includes('enterprise')) return 'enterprise_professional';
  return 'free';
};

export const getPlanTier = (planLike) => {
  const normalized = normalizePlan(planLike);
  if (normalized.startsWith('enterprise_')) return 'enterprise';
  if (normalized === 'compliance_pro') return 'compliance';
  return 'free';
};

export const hasComplianceBasics = (planLike) => {
  const tier = getPlanTier(planLike);
  return tier === 'compliance' || tier === 'enterprise';
};

export const hasVcisoPortalAccess = (planLike) => getPlanTier(planLike) === 'enterprise';
