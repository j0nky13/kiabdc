// client/src/lib/roundRobin.js
import {
  doc, getDoc, setDoc, addDoc, collection,
  serverTimestamp, query, where, orderBy, limit, getDocs, runTransaction
} from 'firebase/firestore';
import { db } from './firebase';

function isEligible(u, now = Date.now()) {
  const snooze = u.snoozeUntil?.toMillis ? u.snoozeUntil.toMillis() : u.snoozeUntil || 0;
  return u.role === 'staff' && u.active && u.onDuty && (!snooze || snooze <= now);
}

// ---- already had this ----
export async function fetchEligibleUsers() {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'staff'),
    where('active', '==', true),
    where('onDuty', '==', true),
    orderBy('position', 'asc')
  );
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const now = Date.now();
  return list.filter(u => isEligible(u, now));
}

/**
 * NEW: fetchNextUp()
 * Reads rotation/state + current eligible users and returns who’s next
 * without mutating anything.
 */
export async function fetchNextUp() {
  // read current pointer
  const stateRef = doc(db, 'rotation/state', 'current');
  const stateSnap = await getDoc(stateRef);
  const pointerPos = stateSnap.exists() ? (stateSnap.data().pointerPos ?? 0) : 0;

  // read eligible users
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

  if (candidates.length === 0) return null;

  // find first after pointer; else wrap
  let next = candidates.find(u => (u.position ?? 0) > pointerPos);
  if (!next) next = candidates[0];

  return next;
}

/**
 * NEW: fetchRecentLogs(limitN = 10)
 * Returns last N log entries from rotation/logs.
 */
export async function fetchRecentLogs(limitN = 10) {
  const q = query(
    collection(db, 'rotation/logs'),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- already had this ----
export async function assignNextLead({ customer, managerUid, managerName }) {
  if (!customer || !customer.trim()) throw new Error('Customer is required');

  const stateRef = doc(db, 'rotation/state', 'current');
  const logsRef = collection(db, 'rotation/logs');
  const leadsRef = collection(db, 'leads');

  return runTransaction(db, async (tx) => {
    const stateSnap = await tx.get(stateRef);
    const state = stateSnap.exists() ? stateSnap.data() : { pointerPos: 0 };

    // fresh eligible list
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
    if (!pick) pick = candidates[0]; // wrap

    // write lead
    tx.set(doc(leadsRef), {
      customer: customer.trim(),
      assignedTo: pick.uid,
      assignedToName: pick.name || pick.email || 'User',
      assignedBy: managerUid,
      assignedByName: managerName || 'Manager',
      assignedAt: serverTimestamp(),
      source: 'BDC Portal'
    });

    // log
    tx.set(doc(logsRef), {
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

    // advance pointer
    tx.set(stateRef, {
      pointerPos: pick.position ?? 0,
      lastAssignedTo: pick.uid,
      lastAssignedAt: serverTimestamp(),
      updatedBy: managerUid
    }, { merge: true });

    return pick;
  });
}

// ---- already had this ----
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

    // snooze
    const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    tx.set(targetRef, { snoozeUntil, updatedAt: serverTimestamp() }, { merge: true });

    // compute next pointer
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

    // log skip
    tx.set(doc(logsRef), {
      type: 'skip',
      targetUid,
      targetName: target.name || 'User',
      reason: reason.trim(),
      managerUid,
      managerName: managerName || 'Manager',
      pointerPosAfter: nextPos,
      createdAt: serverTimestamp()
    });

    // move pointer
    tx.set(stateRef, { pointerPos: nextPos, updatedBy: managerUid }, { merge: true });

    return { nextPos };
  });
}