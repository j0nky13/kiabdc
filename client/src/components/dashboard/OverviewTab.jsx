import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchNextUp, fetchEligibleUsers, fetchRecentLogs } from '../../lib/roundRobin';

export default function OverviewTab() {
  const { user, isManager } = useAuth();

  const [nextUp, setNextUp] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const myIndex = useMemo(() => {
    if (!eligible?.length || !user?.uid) return -1;
    return eligible.findIndex((u) => u.uid === user.uid);
  }, [eligible, user?.uid]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [nu, elig, recent] = await Promise.all([
          fetchNextUp(),            // { next }
          fetchEligibleUsers(),     // array of eligible users
          fetchRecentLogs(10),      // array of recent logs
        ]);
        if (!mounted) return;
        setNextUp(nu?.next ?? null);
        setEligible(Array.isArray(elig) ? elig : []);
        setLogs(Array.isArray(recent) ? recent : []);
      } catch (err) {
        console.error('Overview load failed:', err);
        if (mounted) {
          setNextUp(null);
          setEligible([]);
          setLogs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Round Robin</h2>

      {loading ? (
        <div className="opacity-70">Loading…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/5">
            <div className="text-sm opacity-70">Next Up</div>
            <div className="text-2xl font-bold truncate">
              {nextUp?.name || nextUp?.email || '—'}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/5">
            <div className="text-sm opacity-70">Queue Size</div>
            <div className="text-2xl font-bold">{eligible.length}</div>
          </div>

          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/5">
            <div className="text-sm opacity-70">Your Position</div>
            <div className="text-2xl font-bold">
              {myIndex >= 0 ? `#${myIndex + 1}` : 'Not in rotation'}
            </div>
          </div>
        </div>
      )}

      {/* Eligible list */}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/5">
        <div className="text-sm font-medium mb-2 opacity-80">Eligible Salesman</div>
        <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
          {loading && <div className="px-4 py-3 text-white/60">Loading…</div>}
          {!loading && eligible.length === 0 && (
            <div className="px-4 py-3 text-white/60">No one eligible.</div>
          )}
          {!loading &&
            eligible.map((u) => {
              const isMe = u.uid === user?.uid;
              return (
                <div
                  key={u.uid}
                  className="flex items-center justify-between px-4 py-3 bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {u.name || u.email || u.uid}
                      {isMe && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10">You</span>}
                    </div>
                    <div className="text-xs opacity-70">
                      pos {u.position ?? 0} · onDuty {String(u.onDuty)} · active {String(u.active)}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Recent actions */}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/5">
        <div className="text-sm font-medium mb-2 opacity-80">Recent actions</div>
        <ul className="space-y-1 text-sm">
          {logs.length === 0 && <li className="opacity-70">No recent activity.</li>}
          {logs.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 capitalize">{l.type}</span>
              <span>{l.targetName}</span>
              {l.type === 'assign' && <span className="opacity-70">→ {l.customer}</span>}
              {l.type === 'skip' && <span className="opacity-70">({l.reason})</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}