export default function StatsLeads() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-medium mb-2">Lead KPIs</div>
      <ul className="text-sm text-white/70 list-disc pl-4 space-y-1">
        <li>Leads received per associate (last 30 days)</li>
        <li>Closed leads per associate</li>
        <li>Close % per associate</li>
        <li>Skips/Passes breakdown (from rotation logs)</li>
      </ul>
      <div className="text-xs text-white/50 mt-3">
        ()
      </div>
    </div>
  );
}