import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchNextUp,
  fetchEligibleUsers,
  fetchRecentLogs,
  assignNextLead,
  skipUserOnce,
  setUserFlags,
  swapPositions
} from '../../lib/roundRobin';
import { ArrowUp, ArrowDown, ArrowRightCircle, SkipForward, ToggleLeft, ToggleRight, Users, List, Loader2 } from 'lucide-react';

export default function RoutingTab() {
  const { user, isManager } = useAuth();
  const [eligible, setEligible] = useState([]);
  const [nextUp, setNextUp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [customer, setCustomer] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [busy, setBusy] = useState(false);

  const meIndex = useMemo(() => {
    if (!eligible?.length || !user?.uid) return -1;
    return eligible.findIndex(u => u.uid === user.uid);
  }, [eligible, user?.uid]);

  const reload = async () => {
    const [{ next, eligible: list }, recent] = await Promise.all([
      fetchNextUp(),
      fetchRecentLogs(12)
    ]).then(([a, b]) => [a, b]);
    setNextUp(next || null);
    setEligible(list || []);
    setLogs(recent || []);
  };

  useEffect(() => { reload(); }, []);

  if (!isManager) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Users size={18}/> Round Robin</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Next up:</div>
          <div className="text-lg font-semibold">{nextUp?.name || nextUp?.email || '—'}</div>
          <div className="mt-3 text-sm text-white/60">You are {meIndex >= 0 ? `#${meIndex + 1}` : 'not in rotation'}.</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium mb-2 flex items-center gap-2"><List size={16}/> Recent actions</div>
          <ul className="space-y-1 text-sm text-white/80">
            {logs.length === 0 && <li className="text-white/60">No recent activity.</li>}
            {logs.map(l => (
              <li key={l.id} className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-white/10">{l.type}</span>
                <span>{l.targetName}</span>
                {l.type === 'assign' && <span className="text-white/60">→ {l.customer}</span>}
                {l.type === 'skip' && <span className="text-white/60">({l.reason})</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const doAssign = async () => {
    if (!customer.trim()) return;
    setBusy(true);
    try {
      await assignNextLead({
        customer: customer.trim(),
        managerUid: user.uid,
        managerName: user.name
      });
      setCustomer('');
      await reload();
    } catch (e) {
      alert(e.message || 'Failed to assign');
    } finally {
      setBusy(false);
    }
  };

  const doSkip = async () => {
    if (!selectedUid) return alert('Select a user to skip');
    if (!skipReason.trim()) return alert('Reason required');
    setBusy(true);
    try {
      await skipUserOnce({
        targetUid: selectedUid,
        reason: skipReason.trim(),
        managerUid: user.uid,
        managerName: user.name,
        snoozeMinutes: 30
      });
      setSkipReason('');
      setSelectedUid('');
      await reload();
    } catch (e) {
      alert(e.message || 'Failed to skip');
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = async (uid, field, current) => {
    setBusy(true);
    try {
      await setUserFlags(uid, { [field]: !current });
      await reload();
    } catch (e) {
      alert(e.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const moveUp = async (idx) => {
    if (idx <= 0) return;
    const a = eligible[idx];
    const b = eligible[idx - 1];
    setBusy(true);
    try {
      await swapPositions(a.uid, a.position ?? idx + 1, b.uid, b.position ?? idx);
      await reload();
    } catch (e) {
      alert(e.message || 'Failed to reorder');
    } finally {
      setBusy(false);
    }
  };

  const moveDown = async (idx) => {
    if (idx >= eligible.length - 1) return;
    const a = eligible[idx];
    const b = eligible[idx + 1];
    setBusy(true);
    try {
      await swapPositions(a.uid, a.position ?? idx + 1, b.uid, b.position ?? idx + 2);
      await reload();
    } catch (e) {
      alert(e.message || 'Failed to reorder');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2"><Users size={18}/> Round Robin (Manager)</h2>

      {/* Assign Next */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70 mb-2">Assign the next eligible associate</div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none placeholder:text-white/50"
            placeholder="Customer name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
          <button
            onClick={doAssign}
            disabled={busy || !customer.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowRightCircle size={16}/>}
            Assign Next
          </button>
        </div>
        <div className="mt-3 text-sm text-white/60">Next up: <span className="font-medium">{nextUp?.name || nextUp?.email || '—'}</span></div>
      </div>

      {/* Skip */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70 mb-2">Skip an associate (30 min snooze)</div>
        <div className="flex gap-2">
          <select
            className="w-56 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none"
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
          >
            <option value="">Select associate…</option>
            {eligible.map(u => (
              <option key={u.uid} value={u.uid}>
                {u.name || u.email} — pos {u.position ?? 0}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none placeholder:text-white/50"
            placeholder="Reason"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
          />
          <button
            onClick={doSkip}
            disabled={busy || !selectedUid || !skipReason.trim()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/15 hover:bg-white/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" size={16}/> : <SkipForward size={16}/>}
            Skip
          </button>
        </div>
      </div>

      {/* Eligible table with toggles & reorder */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium mb-2 flex items-center gap-2"><Users size={16}/> Eligible associates</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Position</th>
                <th className="text-left py-2">Active</th>
                <th className="text-left py-2">On Duty</th>
                <th className="text-left py-2">Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {eligible.map((u, idx) => (
                <tr key={u.uid} className="align-middle">
                  <td className="py-2">{u.name || u.email}</td>
                  <td className="py-2">{u.position ?? idx + 1}</td>
                  <td className="py-2">
                    <button
                      onClick={() => toggleFlag(u.uid, 'active', !!u.active)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20"
                    >
                      {u.active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                      {String(!!u.active)}
                    </button>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => toggleFlag(u.uid, 'onDuty', !!u.onDuty)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20"
                    >
                      {u.onDuty ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                      {String(!!u.onDuty)}
                    </button>
                  </td>
                  <td className="py-2">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0 || busy}
                        className="p-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 disabled:opacity-40"
                      >
                        <ArrowUp size={14}/>
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === eligible.length - 1 || busy}
                        className="p-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20 disabled:opacity-40"
                      >
                        <ArrowDown size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {eligible.length === 0 && (
                <tr><td className="py-3 text-white/60" colSpan={5}>No eligible associates.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent actions */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium mb-2 flex items-center gap-2"><List size={16}/> Recent actions</div>
        <ul className="space-y-1 text-sm text-white/80">
          {logs.length === 0 && <li className="text-white/60">No recent activity.</li>}
          {logs.map(l => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/10">{l.type}</span>
              <span>{l.targetName}</span>
              {l.type === 'assign' && <span className="text-white/60">→ {l.customer}</span>}
              {l.type === 'skip' && <span className="text-white/60">({l.reason})</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}