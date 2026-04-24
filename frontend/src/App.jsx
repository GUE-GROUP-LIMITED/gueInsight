import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Subscription from './pages/Subscription';
import Payment from './pages/Payment';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminCompliance from './pages/AdminCompliance';
import UserManagement from './pages/UserManagement';
import Support from './pages/Support';
import AdminSupport from './pages/AdminSupport';
import NotFound from './pages/NotFound';

const AppShell = () => {
  const location = useLocation();
  const showNavbar = location.pathname !== '/' && !location.pathname.startsWith('/admin');

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute userOnly={true}><Dashboard /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute userOnly={true}><Support /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/compliance" element={<ProtectedRoute adminOnly={true}><AdminCompliance /></ProtectedRoute>} />
        <Route path="/admin/support" element={<ProtectedRoute adminOnly={true}><AdminSupport /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute adminOnly={true}><Profile /></ProtectedRoute>} />
        <Route path="/admin/change-password" element={<ProtectedRoute adminOnly={true}><ResetPassword /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly={true}><UserManagement /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
