import React, { useState } from 'react';
import './PlanSelector.css';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';

const PLANS = [
  { key: 'compliance_pro', name: 'Compliance Pro', price_cents: 2990, desc: 'GDPR-focused threat detection with audit trails' },
  { key: 'enterprise_risk', name: 'Enterprise Risk', price_cents: 49900, desc: 'NIS2 + ISO27001 risk management' },
  { key: 'enterprise_elite', name: 'Enterprise Elite', price_cents: 99900, desc: 'EU residency, SOC2 readiness, dedicated support' },
];

const PlanSelector = ({ onClose }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(PLANS[0].key);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = async (trialDays = 14) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.post('/checkout/create-session', { tier_id: selected, trial_days: trialDays });
      if (resp.data && resp.data.checkout_url) {
        window.location.href = resp.data.checkout_url;
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
          <button className="plan-selector__confirm" onClick={() => startCheckout(14)} disabled={loading}>{loading ? t('plan_selector.redirecting') : t('plan_selector.start_trial')}</button>
          <button className="plan-selector__confirm plan-selector__buy-now" onClick={() => startCheckout(0)} disabled={loading}>{loading ? t('plan_selector.redirecting') : t('plan_selector.subscribe_now')}</button>
          <button className="plan-selector__cancel" onClick={onClose}>{t('plan_selector.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelector;
