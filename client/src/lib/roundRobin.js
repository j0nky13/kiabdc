import {
  doc, getDoc, setDoc, addDoc, collection,
  serverTimestamp, query, where, orderBy, limit, getDocs, runTransaction, updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

function isEligible(u, now = Date.now()) {
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

export async function fetchRecentLogs(limitCount = 10) {
  const q = query(
    collection(db, 'rotation/logs'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map(d => ({ id: d.id, ...d.data() }));
}

// ---------- Manager actions ----------
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

    // Follow-up due in 24h (client-side timestamp for filter queries)
    const followUpDue = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Write lead with follow-up fields
    await addDoc(leadsRef, {
      customer: customer.trim(),
      assignedTo: pick.uid,
      assignedToName: pick.name || pick.email || 'User',
      assignedBy: managerUid,
      assignedByName: managerName || 'Manager',
      assignedAt: serverTimestamp(),
      status: 'handed',       // for daily follow-up reminders
      followUpDue,            // queryable immediately
      closed: false,
      source: 'BDC Portal'
    });

    // Log action
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

    // Advance pointer
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

    const after = candidates.find(u => (u.position ?? 0) > (target.position ?? 0));
    const nextPos = (after?.position ?? candidates[0]?.position ?? 0);

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

// toggle booleans
export async function setUserFlags(uid, { active, onDuty }) {
  if (!uid) throw new Error('uid required');
  const ref = doc(db, 'users', uid);
  const patch = {};
  if (typeof active === 'boolean') patch.active = active;
  if (typeof onDuty === 'boolean') patch.onDuty = onDuty;
  patch.updatedAt = serverTimestamp();
  await updateDoc(ref, patch);
}

// set absolute position
export async function setUserPosition(uid, position) {
  if (!uid) throw new Error('uid required');
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { position, updatedAt: serverTimestamp() });
}

// swap two users’ positions (simple up/down)
export async function swapPositions(aUid, aPos, bUid, bPos) {
  const aRef = doc(db, 'users', aUid);
  const bRef = doc(db, 'users', bUid);
  await runTransaction(db, async (tx) => {
    tx.update(aRef, { position: bPos, updatedAt: serverTimestamp() });
    tx.update(bRef, { position: aPos, updatedAt: serverTimestamp() });
  });
}

// Daily manager reminder query (overdue follow-ups)
export async function fetchOverdueLeadsForManager(limitCount = 50) {
  const now = new Date();
  const q = query(
    collection(db, 'leads'),
    where('status', '==', 'handed'),
    where('followUpDue', '<', now),
    orderBy('followUpDue', 'asc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}