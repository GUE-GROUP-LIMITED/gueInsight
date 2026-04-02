import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext, normalizeRole } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly, userOnly }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="container py-4">Checking session...</div>;
  }

  const role = normalizeRole(user?.role || user?.app_metadata?.role || user?.user_metadata?.role);
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" />;
  if (userOnly && role === 'admin') return <Navigate to="/admin" />;
  return children;
};
export default ProtectedRoute;
