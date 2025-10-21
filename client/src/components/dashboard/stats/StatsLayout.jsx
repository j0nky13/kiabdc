import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * StatsLayout (final)
 * - No header or info area.
 * - Just acts as a layout container for nested stats routes.
 */
export default function StatsLayout() {
  return (
    <div className="space-y-4">
      <Outlet />
    </div>
  );
}