// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize the Admin SDK once
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

// Callable function: sets a user's custom role claim and revokes tokens
exports.setUserRole = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const callerRole = (context.auth.token.role || 'staff').toString().toLowerCase();
    if (callerRole !== 'manager') {
      throw new functions.https.HttpsError('permission-denied', 'Managers only.');
    }

    const uid = (data && data.uid) ? String(data.uid) : '';
    const role = (data && data.role) ? String(data.role).toLowerCase() : '';
    if (!uid || !role) {
      throw new functions.https.HttpsError('invalid-argument', 'uid and role are required.');
    }

    const normalizedRole = role === 'manager' ? 'manager' : 'staff';

    try {
      await admin.auth().setCustomUserClaims(uid, { role: normalizedRole });
      await admin.auth().revokeRefreshTokens(uid);
      return { ok: true, uid, role: normalizedRole };
    } catch (err) {
      console.error('setUserRole error:', err);
      throw new functions.https.HttpsError('internal', err.message || 'Failed to set role');
    }
  });