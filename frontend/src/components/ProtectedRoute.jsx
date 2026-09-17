import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Route protection wrapper.
 * Ensures user is authenticated before accessing protected routes.
 * Supports:
 * - adminOnly: redirect non-admin or unauthenticated users to /admin/login
 * - userOnly: redirect admin users to /admin
 */
const ProtectedRoute = ({ children, adminOnly = false, userOnly = false }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(232, 73, 10, 0.2)',
            borderTopColor: '#E8490A',
            borderRadius: '50%',
            animation: 'profileSpin 0.7s linear infinite',
          }}
        />
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, fontFamily: 'inherit' }}>
          Verifying security authorization...
        </p>
      </div>
    );
  }

  if (!user) {
    if (adminOnly) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (userOnly && user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default ProtectedRoute;

