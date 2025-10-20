import {
  doc, getDoc, setDoc, addDoc, collection,
  serverTimestamp, query, where, orderBy, getDocs, runTransaction
} from 'firebase/firestore';
import { db } from './firebase';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

export function isEligible(u, now = Date.now()) {
  const snooze = toMillis(u?.snoozeUntil);
  return (
    String(u?.role || '').toLowerCase() === 'staff' &&
    !!u?.active &&
    !!u?.onDuty &&
    (!snooze || snooze <= now)
  );
}

export async function fetchEligibleUsers() {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'staff'),
    where('active', '==', true),
    where('onDuty', '==', true),
    orderBy('position', 'asc')
  );
  const snap = await getDocs(q);
  const now = Date.now();
  const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return list.filter(u => isEligible(u, now)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export async function fetchNextUp() {
  const stateRef = doc(db, 'rotation/state', 'current');
  const stateSnap = await getDoc(stateRef);
  const pointerPos = stateSnap.exists() ? (stateSnap.data().pointerPos ?? 0) : 0;
  const eligible = await fetchEligibleUsers();
  if (eligible.length === 0) return { next: null, eligible, pointerPos };

  let next = eligible.find(u => (u.position ?? 0) > pointerPos);
  if (!next) next = eligible[0];
  return { next, eligible, pointerPos };
}

export async function assignNextLead({ customer, managerUid, managerName }) {
  if (!customer || !customer.trim()) throw new Error('Customer is required');

  const stateRef = doc(db, 'rotation/state', 'current');
  const logsRef = collection(db, 'rotation/logs');
  const leadsRef = collection(db, 'leads');

  return runTransaction(db, async (tx) => {
    const stateSnap = await tx.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { pointerPos: 0 };

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'staff'),
      where('active', '==', true),
      where('onDuty', '==', true),
      orderBy('position', 'asc')
    );
    const usersSnap = await getDocs(q);
    const now = Date.now();
    const candidates = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => isEligible(u, now))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    if (candidates.length === 0) throw new Error('No eligible associates right now.');

    const pointerPos = state.pointerPos ?? 0;
    let pick = candidates.find(u => (u.position ?? 0) > pointerPos);
    if (!pick) pick = candidates[0];

    await addDoc(leadsRef, {
      customer: customer.trim(),
      assignedTo: pick.uid,
      assignedToName: pick.name || pick.email || 'User',
      assignedBy: managerUid,
      assignedByName: managerName || 'Manager',
      assignedAt: serverTimestamp(),
      source: 'BDC Portal'
    });

    await addDoc(logsRef, {
      type: 'assign',
      customer: customer.trim(),
      targetUid: pick.uid,
      targetName: pick.name || 'User',
      reason: null,
      managerUid,
      managerName: managerName || 'Manager',
      pointerPosAfter: pick.position ?? 0,
      createdAt: serverTimestamp()
    });

    tx.set(stateRef, {
      pointerPos: pick.position ?? 0,
      lastAssignedTo: pick.uid,
      lastAssignedAt: serverTimestamp(),
      updatedBy: managerUid
    }, { merge: true });

    return pick;
  });
}

export async function skipUserOnce({ targetUid, reason, managerUid, managerName, snoozeMinutes = 30 }) {
  if (!targetUid) throw new Error('targetUid required');
  if (!reason || !reason.trim()) throw new Error('Reason required');

  const stateRef = doc(db, 'rotation/state', 'current');
  const targetRef = doc(db, 'users', targetUid);
  const logsRef = collection(db, 'rotation/logs');

  return runTransaction(db, async (tx) => {
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists()) throw new Error('User not found');
    const target = targetSnap.data();

    const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    tx.set(targetRef, { snoozeUntil, updatedAt: serverTimestamp() }, { merge: true });

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'staff'),
      where('active', '==', true),
      where('onDuty', '==', true),
      orderBy('position', 'asc')
    );
    const usersSnap = await getDocs(q);
    const now = Date.now();
    const candidates = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => isEligible(u, now))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    let nextPos = 0;
    if (candidates.length > 0) {
      const after = candidates.find(u => (u.position ?? 0) > (target.position ?? 0));
      nextPos = (after?.position ?? candidates[0]?.position ?? 0);
    }

    await addDoc(logsRef, {
      type: 'skip',
      targetUid,
      targetName: target.name || 'User',
      reason: reason.trim(),
      managerUid,
      managerName: managerName || 'Manager',
      pointerPosAfter: nextPos,
      createdAt: serverTimestamp()
    });

    tx.set(stateRef, { pointerPos: nextPos, updatedBy: managerUid }, { merge: true });

    return { nextPos };
  });
}

export async function fetchRecentLogs(limit = 10) {
  const q = query(
    collection(db, 'rotation/logs'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
}

// client/src/components/dashboard/RoutingTab.jsx
import { useEffect, useMemo, useState } from 'react';
import { fetchEligibleUsers, assignNextLead, skipUserOnce, fetchNextUp, fetchRecentLogs } from '../../lib/roundRobin';
import { useAuth } from '../../context/AuthContext';
import { ArrowRightCircle, SkipForward, Users, List, Loader2 } from 'lucide-react';

export default function RoutingTab() {
  const { user, isManager } = useAuth();
  const [eligible, setEligible] = useState([]);
  const [nextUp, setNextUp] = useState(null);
  const [customer, setCustomer] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  const meIndex = useMemo(() => {
    if (!eligible?.length || !user?.uid) return -1;
    return eligible.findIndex(u => u.uid === user.uid);
  }, [eligible, user?.uid]);

  useEffect(() => {
    const load = async () => {
      const [{ next, eligible: list }, recent] = await Promise.all([
        fetchNextUp(),
        fetchRecentLogs(10)
      ]).then(([a, b]) => [a, b]);
      setNextUp(next?.uid ? next : null);
      setEligible(list || []);
      setLogs(recent || []);
    };
    load();
  }, []);

  if (!isManager) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Users size={18}/> Round Robin</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Next up:</div>
          <div className="text-lg font-semibold">{nextUp?.name || nextUp?.email || '—'}</div>
          <div className="mt-3 text-sm text-white/60">
            You are {meIndex >= 0 ? `#${meIndex + 1}` : 'currently not in rotation'}.
          </div>
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
      const { next, eligible: list } = await fetchNextUp();
      setNextUp(next || null);
      setEligible(list || []);
      setLogs(await fetchRecentLogs(10));
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
      const { next, eligible: list } = await fetchNextUp();
      setNextUp(next || null);
      setEligible(list || []);
      setLogs(await fetchRecentLogs(10));
    } catch (e) {
      alert(e.message || 'Failed to skip');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Users size={18}/> Round Robin (Manager)</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Next up:</div>
          <div className="text-lg font-semibold">{nextUp?.name || nextUp?.email || '—'}</div>

          <div className="mt-4 flex gap-2">
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
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70 mb-2">Skip someone (30 min snooze)</div>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none"
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
