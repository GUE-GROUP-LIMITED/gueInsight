import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Dashboard from './Dashboard';
import ComplianceDashboard from './ComplianceDashboard';
import VCISOPortal from './VCISOPortal';
import './DashboardShell.css';

const TABS = [
  { id: 'threat',     label: '⚡ Threat Intel',  desc: 'Analysis & threat queue' },
  { id: 'compliance', label: '📋 Compliance',     desc: 'NIS2 & GDPR posture' },
  { id: 'vciso',      label: '🛡️ vCISO Portal',  desc: 'Expert guidance' },
];

const PLAN_ORDER = ['starter', 'compliance_pro', 'enterprise_risk', 'enterprise_elite'];
const PLAN_LABELS = {
  starter: 'Starter',
  compliance_pro: 'Compliance Pro',
  enterprise_risk: 'Enterprise Risk',
  enterprise_elite: 'Enterprise Elite',
};

export default function DashboardShell({ defaultTab = 'threat' }) {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const userPlan = user?.plan || user?.subscription?.plan || 'starter';
  const planIdx  = PLAN_ORDER.indexOf(userPlan);
  const canCompliance = planIdx >= PLAN_ORDER.indexOf('compliance_pro');
  const canVCISO      = planIdx >= PLAN_ORDER.indexOf('enterprise_elite');

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
                className={`ds__tab ${activeTab === tab.id ? 'ds__tab--active' : ''} ${locked ? 'ds__tab--locked' : ''}`}
                onClick={() => setActiveTab(tab.id)}
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
