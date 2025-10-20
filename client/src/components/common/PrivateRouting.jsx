import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { user } = useAuth();

  // When auth context hasn't resolved yet you can render nothing (or a spinner)
  if (user === undefined) return null;

  if (!user) return <Navigate to="/" replace />;

  return children;
}