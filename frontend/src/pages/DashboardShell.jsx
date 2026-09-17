import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Dashboard from './Dashboard';
import ComplianceDashboard from './ComplianceDashboard';
import VCISOPortal from './VCISOPortal';
import { normalizePlan } from '../utils/planTier';
import {
  IconEye,
  IconLayers,
  IconGrid,
  IconPlus,
  IconShield,
  IconLock,
  IconBell,
  IconUser,
  IconSettings,
  IconBook,
  IconCreditCard,
  IconExternalLink,
  LogoGueInsight
} from '../components/Icons';
import './DashboardShell.css';

const TABS = [
  { id: 'threat', label: 'Data overview', route: '/threatintel' },
  { id: 'alerts', label: 'Key Alerts', route: '/threatintel?view=alerts' },
  { id: 'compliance', label: 'Compliance', route: '/dashboard/compliance' },
  { id: 'vciso', label: 'vCISO Portal', route: '/dashboard/vciso' },
  { id: 'executions', label: 'Executions', route: '/threatintel?view=executions' },
];

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
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState('cockpit'); // 'cockpit' | 'workspace'
  const [intakeDrawerOpen, setIntakeDrawerOpen] = useState(false);
  const [alertsTableActive, setAlertsTableActive] = useState(false);
  const userMenuRef = useRef(null);

  const userPlan = normalizePlan(user?.current_plan || user?.plan || user?.subscription?.plan || 'free');
  const planIdx = PLAN_ORDER.indexOf(userPlan);
  const canCompliance = planIdx >= PLAN_ORDER.indexOf('compliance_pro');
  const canVCISO = planIdx >= PLAN_ORDER.indexOf('enterprise_elite');

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTopTab = (() => {
    const path = location.pathname;
    const search = location.search;
    if (path.startsWith('/dashboard/compliance')) return 'compliance';
    if (path.startsWith('/dashboard/vciso')) return 'vciso';
    if (search.includes('view=alerts')) return 'alerts';
    if (search.includes('view=executions')) return 'executions';
    return 'threat';
  })();

  const handleTabClick = (tab) => {
    setActiveTab(tab.id === 'alerts' || tab.id === 'executions' ? 'threat' : tab.id);
    navigate(tab.route);
  };

  const handleToggleIntake = () => {
    setIntakeDrawerOpen((prev) => !prev);
  };

  const handleToggleAlertsTable = () => {
    setAlertsTableActive((prev) => !prev);
  };

  const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Gabriel Aloho';
  const userInitials = user?.first_name ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}` : 'GA';

  return (
    <div className="cg-cockpit-shell">
      {/* Top Cockpit Navigation Bar */}
      <header className="cg-header">
        <div className="cg-header__left">
          <Link to="/" className="cg-brand" aria-label="GueInsight Home">
            <span className="cg-brand__icon-wrap">
              <LogoGueInsight size={28} />
            </span>
            <span className="cg-brand__name">GueInsight<span className="cg-brand__dot">.</span></span>
          </Link>
        </div>

        {/* Center Pill Segmented Tabs */}
        <nav className="cg-nav-pills" aria-label="Cockpit navigation">
          {TABS.map((tab) => {
            const locked = (tab.id === 'compliance' && !canCompliance) || (tab.id === 'vciso' && !canVCISO);
            const isActive = activeTopTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`cg-nav-pill ${isActive ? 'cg-nav-pill--active' : ''} ${locked ? 'cg-nav-pill--locked' : ''}`}
                onClick={() => !locked && handleTabClick(tab)}
                disabled={locked}
              >
                {tab.label}
                {locked && <IconLock size={12} className="cg-nav-pill__lock" />}
              </button>
            );
          })}
          <button
            type="button"
            className={`cg-nav-pill cg-nav-pill--plus ${intakeDrawerOpen ? 'cg-nav-pill--plus-active' : ''}`}
            onClick={handleToggleIntake}
            title="Open Threat Intake & File Scanner"
            aria-label="New Analysis"
          >
            <IconPlus size={16} />
          </button>
        </nav>

        {/* Right Utility Controls */}
        <div className="cg-header__right">
          <button
            type="button"
            className={`cg-btn-alerts-table ${alertsTableActive ? 'cg-btn-alerts-table--active' : ''}`}
            onClick={handleToggleAlertsTable}
          >
            Alerts Table
          </button>

          <button
            type="button"
            className={`cg-icon-btn ${activeViewMode === 'workspace' ? 'cg-icon-btn--active' : ''}`}
            onClick={() => setActiveViewMode(activeViewMode === 'cockpit' ? 'workspace' : 'cockpit')}
            title="Toggle Cockpit / Workspace View"
            aria-label="Toggle Cockpit or Workspace"
          >
            <IconEye size={17} />
          </button>

          <button
            type="button"
            className={`cg-icon-btn ${intakeDrawerOpen ? 'cg-icon-btn--active' : ''}`}
            onClick={handleToggleIntake}
            title="Rapid Threat Analysis Drawer"
            aria-label="Rapid Threat Analysis Drawer"
          >
            <IconLayers size={17} />
          </button>

          <button
            type="button"
            className="cg-icon-btn"
            onClick={() => navigate('/threatintel')}
            title="Grid Overview"
            aria-label="Grid Overview"
          >
            <IconGrid size={17} />
          </button>

          {/* User Avatar with Dropdown */}
          <div className="cg-user-menu-wrap" ref={userMenuRef}>
            <button
              type="button"
              className="cg-avatar-btn"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="User profile menu"
            >
              <div className="cg-avatar-img">
                {userInitials}
              </div>
              <span className="cg-avatar-status" />
            </button>

            {userMenuOpen && (
              <div className="cg-dropdown">
                <div className="cg-dropdown__header">
                  <strong>{userName}</strong>
                  <span className="cg-dropdown__plan">{PLAN_LABELS[userPlan] || userPlan}</span>
                </div>
                <div className="cg-dropdown__body">
                  <Link to="/profile" className="cg-dropdown__item" onClick={() => setUserMenuOpen(false)}>
                    <IconUser size={15} /> Profile & Settings
                  </Link>
                  <Link to="/billing" className="cg-dropdown__item" onClick={() => setUserMenuOpen(false)}>
                    <IconCreditCard size={15} /> Subscription & Billing
                  </Link>
                  <Link to="/docs" className="cg-dropdown__item" onClick={() => setUserMenuOpen(false)}>
                    <IconBook size={15} /> Documentation
                  </Link>
                </div>
                <div className="cg-dropdown__footer">
                  <button
                    type="button"
                    className="cg-dropdown__logout"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Cockpit Content Area */}
      <main className="cg-main-body">
        {activeTab === 'threat' && (
          <Dashboard
            viewMode={activeViewMode}
            setViewMode={setActiveViewMode}
            intakeDrawerOpen={intakeDrawerOpen}
            setIntakeDrawerOpen={setIntakeDrawerOpen}
            alertsTableActive={alertsTableActive}
            setAlertsTableActive={setAlertsTableActive}
          />
        )}
        {activeTab === 'compliance' && <ComplianceDashboard />}
        {activeTab === 'vciso' && <VCISOPortal />}
      </main>
    </div>
  );
}
