import { NavLink, useLocation } from 'react-router-dom';

const DashboardTabsNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const isThreatActive =
    path === '/dashboard'
    || path === '/threatintel'
    || path === '/dashboard/workspace'
    || path === '/threatintel/workspace';
  const isComplianceActive = path.startsWith('/dashboard/compliance');
  const isVcisoActive = path.startsWith('/dashboard/vciso');

  return (
    <nav className="dashboard-tabs" aria-label="Dashboard areas">
      <NavLink to="/threatintel" className={`dashboard-tabs__item${isThreatActive ? ' dashboard-tabs__item--active' : ''}`}>
        Threat Intel
      </NavLink>
      <NavLink to="/dashboard/compliance" className={`dashboard-tabs__item${isComplianceActive ? ' dashboard-tabs__item--active' : ''}`}>
        Compliance
      </NavLink>
      <NavLink to="/dashboard/vciso" className={`dashboard-tabs__item${isVcisoActive ? ' dashboard-tabs__item--active' : ''}`}>
        vCISO Portal
      </NavLink>
    </nav>
  );
};

export default DashboardTabsNav;
