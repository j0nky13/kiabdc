import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchOverdueLeadsForManager } from '../../lib/roundRobin';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function OverdueFollowupsCard() {
  const { isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState([]);

  useEffect(() => {
    if (!isManager) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchOverdueLeadsForManager(50);
        if (alive) setOverdue(rows || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isManager]);

  if (!isManager) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={18} className="text-amber-400" />
        <div className="text-sm font-semibold">Overdue follow-ups (24h+)</div>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/10">
          {loading ? '—' : overdue.length}
        </span>
      </div>

      {loading && <div className="text-sm text-white/60">Loading…</div>}

      {!loading && overdue.length === 0 && (
        <div className="text-sm text-white/60 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          Nothing overdue. Nice!
        </div>
      )}

      {!loading && overdue.length > 0 && (
        <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {overdue.map(l => (
            <div key={l.id} className="px-4 py-3 bg-white/5 text-sm">
              <div className="font-medium">{l.customer}</div>
              <div className="text-white/60">
                Assigned to <span className="font-medium">{l.assignedToName || l.assignedTo}</span>
                {' '}· due {new Date(l.followUpDue?.seconds ? l.followUpDue.seconds * 1000 : l.followUpDue).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}