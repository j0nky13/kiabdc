// client/src/lib/users.js
import { db } from '../lib/firebase';
import {
  collection, getDocs, query, orderBy, limit, startAfter,
  doc, setDoc, updateDoc, deleteDoc, getDoc
} from 'firebase/firestore';

const USERS = collection(db, 'users');

export async function listUsers({ pageSize = 50, cursor = null } = {}) {
  let q = query(USERS, orderBy('email'), limit(pageSize));
  if (cursor) q = query(USERS, orderBy('email'), startAfter(cursor));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function getUser(uid) {
  const ref = doc(db, 'users', uid);
  const s = await getDoc(ref);
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function upsertUser(uid, { email, name, role = 'staff', disabled = false }) {
  const ref = doc(db, 'users', uid);
  // merge true so we never blow away fields by accident
  await setDoc(ref, { email, name, role, disabled }, { merge: true });
}

export async function updateUser(uid, patch) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, patch);
}

export async function removeUser(uid) {
  const ref = doc(db, 'users', uid);
  await deleteDoc(ref);
}