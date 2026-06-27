import { NavLink } from 'react-router-dom';

const DashboardTabsNav = () => {
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard areas">
      <NavLink to="/threatintel" className={({ isActive }) => `dashboard-tabs__item${isActive ? ' dashboard-tabs__item--active' : ''}`}>
        Threat Intel
      </NavLink>
      <NavLink to="/dashboard/compliance" className={({ isActive }) => `dashboard-tabs__item${isActive ? ' dashboard-tabs__item--active' : ''}`}>
        Compliance
      </NavLink>
      <NavLink to="/dashboard/vciso" className={({ isActive }) => `dashboard-tabs__item${isActive ? ' dashboard-tabs__item--active' : ''}`}>
        vCISO Portal
      </NavLink>
    </nav>
  );
};

export default DashboardTabsNav;
