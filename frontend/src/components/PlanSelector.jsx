import React, { useMemo, useState } from 'react';
import './PlanSelector.css';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';

const PLANS = [
  { key: 'starter', name: 'Starter', price_cents: 4990, desc: 'For small teams and individual professionals' },
  { key: 'compliance_pro', name: 'Compliance Pro', price_cents: 9990, desc: 'GDPR-focused threat detection with audit trails' },
  { key: 'enterprise_professional', name: 'Enterprise Professional', price_cents: 29990, desc: 'GDPR + NIS2 compliance for growing enterprises' },
  { key: 'enterprise_risk', name: 'Enterprise Risk', price_cents: 49900, desc: 'NIS2 + ISO27001 risk management' },
  { key: 'enterprise_elite', name: 'Enterprise Elite', price_cents: 99900, desc: 'EU residency, SOC2 readiness, dedicated support' },
];

const PLAN_RANK = {
  free: 0,
  starter: 1,
  compliance_pro: 2,
  enterprise_professional: 3,
  enterprise_risk: 4,
  enterprise_elite: 5,
};

const PlanSelector = ({ onClose, initialSelected, currentPlan = 'free', isPaidSubscriber = false, trialMode = false }) => {
  const { t } = useTranslation();
  const initial = PLANS.some((p) => p.key === initialSelected) ? initialSelected : PLANS[0].key;
  const [selected, setSelected] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const actionLabel = useMemo(() => {
    if (trialMode) return 'Start 14-day free trial';
    const targetRank = PLAN_RANK[selected] ?? 0;
    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    if (targetRank > currentRank) return 'Upgrade plan';
    if (targetRank < currentRank) return 'Downgrade plan';
    return 'Switch plan';
  }, [currentPlan, isPaidSubscriber, selected, t]);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const planToUse = initialSelected && PLANS.some((p) => p.key === initialSelected) ? initialSelected : selected;
      const resp = trialMode
        ? await api.post('/checkout/create-session', { tier_id: planToUse, trial_days: 14 })
        : await api.post('/auth/subscription/upgrade', { plan: planToUse });
      if (resp.status === 200) {
        // Check if Stripe checkout URL is provided (for paid plans)
        if (resp.data?.checkout_url) {
          // Redirect to Stripe Checkout
          window.location.href = resp.data.checkout_url;
          return;
        }
        // Free plan - redirect to subscription success
        if (resp.data?.receipt_url) {
          window.location.href = '/subscription?upgrade=success';
          return;
        }
        // Fallback
        window.location.href = '/subscription?upgrade=success';
        return;
      }
      setError(t('plan_selector.failed_session'));
    } catch (e) {
      setError(e.response?.data?.error || e.message || t('plan_selector.checkout_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plan-selector__backdrop">
      <div className="plan-selector">
        {initialSelected && PLANS.some((p) => p.key === initialSelected) ? (
          // Single plan confirmation view
          (() => {
            const selectedPlanObj = PLANS.find((p) => p.key === initialSelected);
            return (
              <>
                <h3>{trialMode ? 'Confirm your free trial' : 'Confirm your plan change'}</h3>
                <div className="plan-selector__single">
                  <div className="plan-card__name" style={{fontSize: '1.3rem', marginBottom: '12px'}}>{selectedPlanObj.name}</div>
                  <div className="plan-card__price" style={{fontSize: '1.2rem', marginBottom: '8px'}}>€{(selectedPlanObj.price_cents/100).toFixed(2)}/month</div>
                  <div className="plan-card__desc" style={{marginBottom: '16px'}}>{selectedPlanObj.desc}</div>
                  {trialMode ? (
                    <p style={{margin: 0, color: '#39556e'}}>Your payment method will be validated and saved now. You will be charged automatically when the 14-day trial ends, or immediately if you switch to another paid plan during the trial.</p>
                  ) : null}
                </div>
                {error ? <div className="plan-selector__error">{error}</div> : null}
                <div className="plan-selector__actions">
                  <button className="plan-selector__confirm plan-selector__buy-now" onClick={startCheckout} disabled={loading}>{loading ? t('plan_selector.redirecting') : actionLabel}</button>
                  <button className="plan-selector__cancel" onClick={onClose}>{t('plan_selector.cancel')}</button>
                </div>
              </>
            );
          })()
        ) : (
          // Plan browsing view (for future use)
          <>
            <h3>{t('plan_selector.title')}</h3>
            <div className="plan-selector__grid">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  className={`plan-card ${selected === p.key ? 'is-selected' : ''}`}
                  onClick={() => setSelected(p.key)}
                >
                  <div className="plan-card__name">{p.name}</div>
                  <div className="plan-card__price">€{(p.price_cents/100).toFixed(2)}/mo</div>
                  <div className="plan-card__desc">{p.desc}</div>
                </button>
              ))}
            </div>
            {error ? <div className="plan-selector__error">{error}</div> : null}
            <div className="plan-selector__actions">
              {!isPaidSubscriber && (
                <button className="plan-selector__confirm" onClick={startCheckout} disabled={loading}>{loading ? t('plan_selector.redirecting') : t('plan_selector.start_trial')}</button>
              )}
              <button className="plan-selector__confirm plan-selector__buy-now" onClick={startCheckout} disabled={loading}>{loading ? t('plan_selector.redirecting') : actionLabel}</button>
              <button className="plan-selector__cancel" onClick={onClose}>{t('plan_selector.cancel')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlanSelector;
