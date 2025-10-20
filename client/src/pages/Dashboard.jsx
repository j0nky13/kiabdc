import RequireManager from "../components/auth/RequireManager";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import OverviewTab from "../components/dashboard/OverviewTab";
import AssociatesTab from "../components/dashboard/AssociatesTab";
// import SalesTab from "../components/dashboard/SalesTab"; // TEMP off due to index error
import ManagerTab from "../components/dashboard/ManagerTab";
import SettingsTab from "../components/dashboard/SettingsTab";

export default function Dashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewTab />} />
        <Route path="associates" element={<AssociatesTab />} />
        {/* TEMP placeholder to avoid crashing the outlet */}
        <Route path="sales" element={<div className="text-white/70">Sales coming soon…</div>} />
        <Route path="manager" element={
          <RequireManager>
            <ManagerTab />
          </RequireManager>
        } />
        <Route path="management" element={
          <RequireManager>
            <ManagerTab />
          </RequireManager>
        } />
        <Route path="settings" element={<SettingsTab />} />
      </Route>
    </Routes>
  );
}