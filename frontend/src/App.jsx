import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import DashboardShell from './pages/DashboardShell';
import AnalysisResults from './pages/AnalysisResults';
import Profile from './pages/Profile';
import Subscription from './pages/Subscription';
import Billing from './pages/Billing';
import Payment from './pages/Payment';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminCompliance from './pages/AdminCompliance';
import Documentation from './pages/Documentation';
import Resources from './pages/Resources';
import Status from './pages/Status';
import UserManagement from './pages/UserManagement';
import Support from './pages/Support';
import AdminSupport from './pages/AdminSupport';
import AdminAccessControl from './pages/AdminAccessControl';
import ActivateAdmin from './pages/ActivateAdmin';
import NotFound from './pages/NotFound';

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return null;
};

const AppShell = () => {
  const location = useLocation();
  const publicHeaderRoutes = ['/', '/login', '/signup', '/reset-password', '/docs', '/subscription', '/activate-admin'];
  const showNavbar = !publicHeaderRoutes.includes(location.pathname) && !location.pathname.startsWith('/admin');
  const showFooter = !location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollToTop />
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/activate-admin" element={<ActivateAdmin />} />
        <Route path="/dashboard" element={<ProtectedRoute userOnly={true}><DashboardShell /></ProtectedRoute>} />
        <Route path="/dashboard/workspace" element={<ProtectedRoute userOnly={true}><Navigate to="/threatintel" replace /></ProtectedRoute>} />
        <Route path="/threatintel" element={<ProtectedRoute userOnly={true}><DashboardShell /></ProtectedRoute>} />
        <Route path="/threatintel/workspace" element={<ProtectedRoute userOnly={true}><Navigate to="/threatintel" replace /></ProtectedRoute>} />
        <Route path="/dashboard/compliance" element={<ProtectedRoute userOnly={true}><DashboardShell defaultTab="compliance" /></ProtectedRoute>} />
        <Route path="/dashboard/vciso" element={<ProtectedRoute userOnly={true}><DashboardShell defaultTab="vciso" /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute userOnly={true}><Navigate to="/threatintel?mode=file" replace /></ProtectedRoute>} />
        <Route path="/dashboard/upload" element={<ProtectedRoute userOnly={true}><Navigate to="/threatintel?mode=file" replace /></ProtectedRoute>} />
        <Route path="/analysis/:analysisId" element={<ProtectedRoute userOnly={true}><AnalysisResults /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute userOnly={true}><Support /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/status" element={<Status />} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/compliance" element={<ProtectedRoute adminOnly={true}><AdminCompliance /></ProtectedRoute>} />
        <Route path="/admin/support" element={<ProtectedRoute adminOnly={true}><AdminSupport /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute adminOnly={true}><Profile /></ProtectedRoute>} />
        <Route path="/admin/change-password" element={<ProtectedRoute adminOnly={true}><ResetPassword /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly={true}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/access" element={<ProtectedRoute adminOnly={true}><AdminAccessControl /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {showFooter && <Footer />}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;
