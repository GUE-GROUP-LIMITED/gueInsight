import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext, normalizeRole } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly, userOnly }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="container py-4">Checking session...</div>;
  }

  const role = normalizeRole(user?.role || user?.app_metadata?.role || user?.user_metadata?.role);
  if (!user) {
    const loginPath = adminOnly ? '/admin/login' : '/login';
    return <Navigate to={loginPath} replace />;
  }

  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (userOnly && role === 'admin') return <Navigate to="/admin" replace />;
  return children;
};
export default ProtectedRoute;
