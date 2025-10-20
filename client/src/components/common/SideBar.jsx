import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LucideHome,
  LucideUsers,
  LucideTrendingUp,
  LucideSettings,
  LucideBriefcase,
  LucideLogOut,
  LucideMenu,
} from "lucide-react";



export default function SideBar({ open = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const { user, logout, isManager } = useAuth();

console.log('role debug:', {
  profile: user?.profile?.role,
  profileRole: user?.profileRole,
  claimRole: user?.claimRole
});


  // Avoid rendering wrong menu state while auth hydrates
  if (!user) return null;

  const activeClass =
    "flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 dark:bg-neutral-800 text-white font-medium transition";
  const defaultClass =
    "flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 dark:hover:bg-neutral-800/30 text-gray-300 transition";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-500"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-50 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex`}
      >
        <div className="flex flex-col m-3 h-[calc(100vh-1.5rem)] md:sticky md:top-3 md:m-0 md:h-[calc(100vh-1.5rem)] rounded-2xl border border-white/20 bg-white/10 dark:bg-neutral-900/20 backdrop-blur-xl p-3 pt-4 shadow-2xl shadow-black/20 w-64">
          <div className="relative flex items-center mb-6 h-7">
            {/* Centered title */}
            <h1 className="absolute inset-x-0 text-center text-white text-2xl md:text-2xl font-semibold pointer-events-none select-none">
              BDC Portal
            </h1>
            {/* Close button (right) */}
            <button
              className="ml-auto md:hidden text-white/70 hover:text-white relative z-10"
              onClick={onClose}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>


          {/* Navigation */}
          <nav className="flex flex-col gap-2 text-sm mt-2">
            {user?.email && (
              <div className="text-gray-300 text-sm font-medium text-center mb-3 break-all px-2 flex justify-center">
                <span className="text-center block">{user.email}</span>
              </div>
            )}
            <NavLink to="/dashboard/overview" end onClick={onClose} className={({ isActive }) => (isActive ? activeClass : defaultClass)}>
              <LucideHome size={18} /> Overview
            </NavLink>
            <NavLink to="/dashboard/associates" end onClick={onClose} className={({ isActive }) => (isActive ? activeClass : defaultClass)}>
              <LucideUsers size={18} /> Sales
            </NavLink>
            <NavLink to="/dashboard/sales" end onClick={onClose} className={({ isActive }) => (isActive ? activeClass : defaultClass)}>
              <LucideTrendingUp size={18} /> Stats
            </NavLink>

            {/* Manager tab only */}
            {isManager && (
              <NavLink to="/dashboard/management" end onClick={onClose} className={({ isActive }) => (isActive ? activeClass : defaultClass)}>
                <LucideBriefcase size={18} /> Manager
              </NavLink>
            )}

            <NavLink to="/dashboard/settings" end onClick={onClose} className={({ isActive }) => (isActive ? activeClass : defaultClass)}>
              <LucideSettings size={18} /> Settings
            </NavLink>
          </nav>

          {/*
          // User email (previous location, now moved below)
          {user?.email && (
            <div className="text-gray-400 text-xs text-center mb-4 mt-auto border-t border-white/5 pt-3 break-all px-2">
              {user.email}
            </div>
          )}
          */}

          {/* Logout */}
          <div className="mt-auto pt-4 border-t border-white/10">
            <button
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="flex items-center gap-2 text-red-400 hover:text-red-500 transition w-full px-4 py-2"
            >
              <LucideLogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}