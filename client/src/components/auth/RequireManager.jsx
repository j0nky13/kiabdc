import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RequireManager({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/" replace />;

  const role = (user.claimRole ?? user.profileRole ?? '').toLowerCase();
  const isManager = role === 'manager';

  if (!isManager) {
    return <Navigate to="/dashboard/overview" replace state={{ from: location }} />;
  }

  return children;
}