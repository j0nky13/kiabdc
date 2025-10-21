// client/src/lib/leads.js
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export const LEADS = () => collection(db, 'leads');

export async function createLead({ customer, assignedTo, assignedName, dueAt, note = '' }) {
  const payload = {
    customer: (customer || '').trim(),
    status: 'open',                      // open | working | closed
    assignedTo,
    assignedName: assignedName || null,  // display helper
    dueAt: Timestamp.fromDate(new Date(dueAt)),
    note,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(LEADS(), payload);
}

export async function updateLead(id, patch) {
  const ref = doc(db, 'leads', id);
  const payload = { ...patch, updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
}

export async function removeLead(id) {
  await deleteDoc(doc(db, 'leads', id));
}

// Queries
export async function fetchMyLeads(uid) {
  const q = query(LEADS(), where('assignedTo', '==', uid), orderBy('dueAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAllLeads() {
  const q = query(LEADS(), orderBy('dueAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}