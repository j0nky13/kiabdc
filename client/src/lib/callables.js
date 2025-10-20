// client/src/lib/callables.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

export async function setUserRoleClaim(uid, role) {
  const callable = httpsCallable(functions, 'setUserRole');
  const res = await callable({ uid, role: String(role || '').toLowerCase() });
  return res.data;
}