import { useState } from "react";
import { Outlet } from "react-router-dom";
import SideBar from "../components/common/SideBar";
import { Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import WeatherBadge from "../components/common/WeatherBadge";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  // Prefer Firestore name; fallback to email-derived pretty name (already normalized by AuthContext)
  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');

  const hrs = new Date().getHours();
  const dayGreeting = hrs < 12 ? 'Good morning' : hrs < 18 ? 'Good afternoon' : 'Good evening';
  const greetText = user?.greeting?.trim() ? user.greeting.trim() : dayGreeting;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-neutral-100/70 to-neutral-300/40 dark:from-neutral-900 dark:to-neutral-800 text-neutral-900 dark:text-white relative overflow-hidden">
      <SideBar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col relative z-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between p-4 backdrop-blur-md bg-white/40 dark:bg-neutral-900/40 border-b border-white/20 shadow-sm">
          <button
            className="md:hidden p-2 rounded-md hover:bg-white/30 dark:hover:bg-neutral-700/30 transition"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          {/* Greeting */}
          <div className="flex flex-col">
            <h1 className="font-semibold text-lg tracking-tight">
              {greetText}, <span className="capitalize">{displayName}</span> 
            </h1>
            {/* Weather goes here instead of "welcome back..." */}
            <div className="mt-1">
              <WeatherBadge />
            </div>
          </div>

          {/* Right-side spacer or status */}
          <div className="hidden md:flex text-sm opacity-70 items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Online
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-6 md:pl-[1rem]">
          <div className="rounded-2xl backdrop-blur-xl bg-white/40 dark:bg-neutral-800/40 shadow-xl border border-white/20 p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
