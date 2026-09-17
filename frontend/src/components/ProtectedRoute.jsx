import React from 'react';

const ProtectedRoute = ({ children }) => {
  // Security temporarily bypassed per user request to allow dashboard navigation and UI work
  return children;
};

export default ProtectedRoute;

