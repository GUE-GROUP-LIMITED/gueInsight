import { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Dashboard from './Dashboard';
import ComplianceDashboard from './ComplianceDashboard';
import VCISOPortal from './VCISOPortal';
import { normalizePlan } from '../utils/planTier';
import './DashboardShell.css';

const TABS = [
  { id: 'threat',    label: '⚡ Threat Intel', desc: 'Analysis workspace' },
  { id: 'compliance', label: '📋 Compliance',     desc: 'NIS2 & GDPR posture' },
  { id: 'vciso',      label: '🛡️ vCISO Portal',  desc: 'Expert guidance' },
];

const TAB_ROUTES = {
  threat: '/threatintel',
  compliance: '/dashboard/compliance',
  vciso: '/dashboard/vciso',
};

const PLAN_ORDER = ['free', 'starter', 'compliance_pro', 'enterprise_professional', 'enterprise_risk', 'enterprise_elite'];
const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  compliance_pro: 'Compliance Pro',
  enterprise_professional: 'Enterprise Professional',
  enterprise_risk: 'Enterprise Risk',
  enterprise_elite: 'Enterprise Elite',
};

export default function DashboardShell({ defaultTab = 'threat' }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const userPlan = normalizePlan(user?.current_plan || user?.plan || user?.subscription?.plan || 'free');
  const planIdx  = PLAN_ORDER.indexOf(userPlan);
  const canCompliance = planIdx >= PLAN_ORDER.indexOf('compliance_pro');
  const canVCISO      = planIdx >= PLAN_ORDER.indexOf('enterprise_elite');

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const activeTopTab = (() => {
    const path = location.pathname;
    if (path.startsWith('/dashboard/compliance')) return 'compliance';
    if (path.startsWith('/dashboard/vciso')) return 'vciso';
    return 'threat';
  })();

  return (
    <div className="ds">
      {/* Dashboard tab nav */}
      <div className="ds__tabs">
        <div className="ds__tabs-left">
          {TABS.map(tab => {
            const locked = (tab.id === 'compliance' && !canCompliance) || (tab.id === 'vciso' && !canVCISO);
            return (
              <button
                key={tab.id}
                type="button"
                className={`ds__tab ${activeTopTab === tab.id ? 'ds__tab--active' : ''} ${locked ? 'ds__tab--locked' : ''}`}
                disabled={locked}
                onClick={() => {
                  const route = TAB_ROUTES[tab.id];
                  setActiveTab(tab.id);
                  if (route) navigate(route);
                }}
              >
                {tab.label}
                {locked && <span className="ds__tab-lock">🔒</span>}
              </button>
            );
          })}
        </div>
        <div className="ds__plan-badge">
          <span className={`ds__plan ds__plan--${userPlan}`}>{PLAN_LABELS[userPlan] || userPlan}</span>
        </div>
      </div>

      {/* Tab content */}
      <div className="ds__content">
        {activeTab === 'threat'     && <Dashboard />}
        {activeTab === 'compliance' && <ComplianceDashboard />}
        {activeTab === 'vciso'      && <VCISOPortal />}
      </div>
    </div>
  );
}
