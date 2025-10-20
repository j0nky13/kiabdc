import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onIdTokenChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  getIdTokenResult,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// ----------------------
// Context setup
// ----------------------
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ----------------------
// Helpers
// ----------------------

// Build action code settings with email embedded in the URL
function buildActionCodeSettings(email) {
  const origin = window.location.origin;
  return {
    url: `${origin}/finish-login?e=${encodeURIComponent(email)}`, // <- no /login route used
    handleCodeInApp: true,
  };
}

// Create/merge a Firestore profile doc for the user
async function ensureUserDoc(uid, data) {
  const ref = doc(db, 'users', uid);
  const prevSnap = await getDoc(ref);
  const exists = prevSnap.exists();

  const payload = {
    // always keep email up to date so lists can render
    ...(data.email ? { email: data.email } : {}),
    updatedAt: serverTimestamp(),
    ...(exists ? {} : { createdAt: serverTimestamp() }),
  };

  // Only set name if caller provided one, or if this is a brand-new doc
  if (data.name && String(data.name).trim()) {
    payload.name = String(data.name).trim();
  } else if (!exists) {
    payload.name = 'User';
  }

  // Only set role if caller provided one, or if this is a brand-new doc
  if (data.role && String(data.role).trim()) {
    const r = String(data.role).trim().toLowerCase();
    payload.role = r === 'manager' ? 'manager' : 'staff';
  } else if (!exists) {
    payload.role = 'staff';
  }

  await setDoc(ref, payload, { merge: true });

  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Assemble enriched user object for the app
async function hydrateUser(firebaseUser) {
  if (!firebaseUser) return null;

  // Pull custom claims (role) if present
  const tokenResult = await getIdTokenResult(firebaseUser).catch(() => null);
  const claimRole = tokenResult?.claims?.role || null;

  // Make sure Firestore profile exists and read it (defensive)
  let profile = null;
  try {
    profile = await ensureUserDoc(firebaseUser.uid, {
      email: firebaseUser.email ?? null,
      // pass a name only if Auth has one; otherwise don't overwrite Firestore
      name: firebaseUser.displayName || undefined,
      // don't set role from claims here; default is staff on first login
    });
  } catch (e) {
    console.warn('ensureUserDoc failed (continuing):', e?.message || e);
  }

  // Keep displayName in Firebase Auth in sync with Firestore name (best-effort)
  if (profile?.name && firebaseUser.displayName !== profile.name) {
    try { await updateProfile(firebaseUser, { displayName: profile.name }); } catch {}
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: profile?.name || firebaseUser.displayName || 'User',
    claimRole: claimRole || null,              // from custom claims (Cloud Function)
    profileRole: (profile?.role || 'staff').toString().toLowerCase(),     // from Firestore doc
    profile,                                   // raw doc
    _raw: firebaseUser,                        // original Firebase user
  };
}

// ----------------------
// Provider
// ----------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // hydrated user
  const [loading, setLoading] = useState(true); // true until we know auth state
  const [authError, setAuthError] = useState(null);

  // Keep user + claims in sync with token changes (sign in, claim updates, refresh)
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      try {
        setLoading(true);
        setAuthError(null);

        if (!fbUser) {
          setUser(null);
          return;
        }

        const enriched = await hydrateUser(fbUser);
        setUser(enriched);
      } catch (err) {
        console.error('Auth state hydrate error:', err);
        setAuthError(err?.message || 'Auth error');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: { ...(prev.profile || {}), ...data },
          profileRole: (data.role || prev.profileRole || 'staff').toString().toLowerCase(),
          name: data.name || prev.name || 'User',
        };
      });
    });
    return () => unsub();
  }, [user?.uid]);

  // Update the signed-in user's display name in Firestore (+ keep Auth in sync)
  const updateProfileName = async (newName) => {
    const trimmed = (newName || '').trim();
    if (!user?.uid) throw new Error('Not signed in');
    if (!trimmed) throw new Error('Name is required');

    const ref = doc(db, 'users', user.uid);
    // 1) Write to Firestore (source of truth for profile)
    await setDoc(
      ref,
      { name: trimmed, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // 2) Best-effort: keep Firebase Auth displayName in sync
    try {
      if (auth.currentUser) {
        if (auth.currentUser.displayName !== trimmed) {
          await updateProfile(auth.currentUser, { displayName: trimmed });
        }
        // Force a fresh ID token so any dependent UI sees the latest state
        await auth.currentUser.getIdToken(true);
      }
    } catch (_) {
      // non-fatal; Firestore is the source of truth and snapshot listener will update UI
    }
  };

  // ----------------------
  // Public API
  // ----------------------

  // Send email magic link (OTP)
  const sendMagicLink = async (email) => {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) throw new Error('Email required');

    // Store email locally as a fallback if user opens link in same browser
    localStorage.setItem('emailForSignIn', clean);

    await sendSignInLinkToEmail(auth, clean, buildActionCodeSettings(clean));
    return { sentTo: clean };
  };

  // Complete sign-in (use on /finish-login)
  const completeMagicFromUrl = async () => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) {
      throw new Error('Invalid or expired sign-in link.');
    }

    // Prefer email in URL; fallback to localStorage
    const params = new URLSearchParams(window.location.search);
    const email = params.get('e') || localStorage.getItem('emailForSignIn');
    if (!email) {
      throw new Error('Missing email for link sign-in.');
    }

    await signInWithEmailLink(auth, email, href);
    localStorage.removeItem('emailForSignIn');

    // Ensure the new ID token with fresh state/claims is available immediately
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }

    // onIdTokenChanged will fire and hydrate user
    return { email };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      localStorage.removeItem('emailForSignIn');
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,

      // role helpers
      role:
        ((user?.profile?.role ?? user?.profileRole ?? user?.claimRole ?? 'staff') + '')
          .trim()
          .toLowerCase(),
      isManager:
        (((user?.profile?.role ?? user?.profileRole ?? user?.claimRole ?? 'staff') + '')
          .trim()
          .toLowerCase() === 'manager'),

      // actions
      sendMagicLink,
      completeMagicFromUrl,
      updateProfileName,
      logout,
    }),
    [user, loading, authError]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}