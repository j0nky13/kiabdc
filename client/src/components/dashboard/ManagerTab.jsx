import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  LucidePencil,
  LucideMail,
  LucideBan,
  LucideTrash2,
  LucidePlus,
} from 'lucide-react';

function EditUserModal({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[90] w-full max-w-lg rounded-xl border border-white/10 bg-neutral-900/80 p-5">
        <h3 className="text-lg font-semibold mb-4">Edit User</h3>

        <label className="text-xs uppercase opacity-70">Email</label>
        <input
          className="w-full mt-1 mb-3 rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
          value={form.email || ''}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim().toLowerCase() }))}
        />

        <label className="text-xs uppercase opacity-70">Name</label>
        <input
          className="w-full mt-1 mb-3 rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
          value={form.name || ''}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Display name"
        />

        <label className="text-xs uppercase opacity-70">Role</label>
        <select
          className="w-full mt-1 mb-6 rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none"
          value={form.role || 'staff'}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-3 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-500 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerTab() {
  const { isManager } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Read both /directory and /users, merge by email, optionally include disabled, prefer directory data, log sources.
  const load = async (includeDeleted = false) => {
    setLoading(true);
    try {
      const byEmail = new Map();

      // ---- Read /directory (keyed by email) ----
      try {
        const dirSnap = await getDocs(collection(db, 'directory'));
        let dirCount = 0;
        dirSnap.forEach((d) => {
          const data = d.data() || {};
          const isDisabled = data.disabled === true;
          if (!includeDeleted && isDisabled) return; // hide if not including deleted
          const email = (d.id || data.email || '').toLowerCase();
          if (!email) return;
          dirCount++;
          byEmail.set(email, {
            email,
            name: (data.name || 'User').toString(),
            role: (data.role || 'staff').toString().toLowerCase() === 'manager' ? 'manager' : 'staff',
            uid: data.uid || null,
            disabled: !!isDisabled,
            _src: 'directory',
          });
        });
        console.log('[ManagerTab] loaded from /directory:', dirCount);
      } catch (e) {
        console.warn('[ManagerTab] failed to read /directory:', e?.message || e);
      }

      // ---- Read /users (keyed by uid). Merge by email if not present, or fill missing fields. ----
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let usersCount = 0;
        usersSnap.forEach((d) => {
          const data = d.data() || {};
          const isDisabled = data.disabled === true;
          if (!includeDeleted && isDisabled) return; // hide if not including deleted
          const email = (data.email || '').toLowerCase();
          if (!email) return;
          usersCount++;
          if (!byEmail.has(email)) {
            // No directory entry; use users doc
            byEmail.set(email, {
              email,
              name: (data.name || 'User').toString(),
              role: (data.role || 'staff').toString().toLowerCase() === 'manager' ? 'manager' : 'staff',
              uid: d.id,
              disabled: !!isDisabled,
              _src: 'users',
            });
          } else {
            // Merge missing bits into existing directory-based row
            const existing = byEmail.get(email);
            byEmail.set(email, {
              ...existing,
              name: existing.name || (data.name || 'User'),
              role: existing.role || ((data.role || 'staff').toString().toLowerCase() === 'manager' ? 'manager' : 'staff'),
              uid: existing.uid || d.id,
              disabled: existing.disabled || !!isDisabled,
            });
          }
        });
        console.log('[ManagerTab] loaded from /users:', usersCount);
      } catch (e) {
        console.warn('[ManagerTab] failed to read /users:', e?.message || e);
      }

      const list = Array.from(byEmail.values());
      setRows(list);
    } catch (err) {
      console.error('[ManagerTab] load error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(showDeleted);
  }, [showDeleted]);

  const sorted = useMemo(() => {
    // managers first, then staff, then alpha by name
    return [...rows].sort((a, b) => {
      const rank = (r) => (r === 'manager' ? 0 : 1);
      if (rank(a.role) !== rank(b.role)) return rank(a.role) - rank(b.role);
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rows]);

  if (!isManager) {
    return (
      <div className="text-sm opacity-75">
        You need manager permissions to view this page.
      </div>
    );
  }

  const openEdit = (row) => {
    setEditing({
      email: row?.email || '',
      name: row?.name || 'User',
      role: row?.role || 'staff',
      uid: row?.uid || null,
    });
    setModalOpen(true);
  };

  // Upsert to both collections
  const upsertDirectoryAndUser = async ({ email, name, role, uid, disabled }) => {
    const safeRole = (role || 'staff').toLowerCase() === 'manager' ? 'manager' : 'staff';
    const base = {
      email,
      name: name?.trim() || 'User',
      role: safeRole,
      disabled: !!disabled,
      updatedAt: serverTimestamp(),
    };

    // directory keyed by email
    await setDoc(
      doc(db, 'directory', email),
      disabled
        ? { disabled: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() }
        : { ...base, deletedAt: null },
      { merge: true }
    );

    // users keyed by uid (when present)
    if (uid) {
      await setDoc(
        doc(db, 'users', uid),
        disabled
          ? { disabled: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), name: base.name, role: base.role }
          : { ...base, deletedAt: null },
        { merge: true }
      );
    }
  };

  const handleSave = async (form) => {
    try {
      if (!form?.email) {
        alert('Email is required.');
        return;
      }
      await upsertDirectoryAndUser({
        email: form.email.toLowerCase(),
        name: form.name,
        role: form.role,
        uid: form.uid || (await maybeFindUidByEmail(form.email)),
        disabled: false,
      });
      setModalOpen(false);
      await load(showDeleted);
      // toast replacement
      alert('User profile updated.');
    } catch (e) {
      console.error('Save failed', e);
      alert('Failed to save: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleSoftDelete = async (row) => {
    if (!confirm(`Soft-delete ${row.email}? They will be hidden until restored.`)) return;
    try {
      await upsertDirectoryAndUser({
        email: row.email,
        name: row.name,
        role: row.role,
        uid: row.uid,
        disabled: true,
      });
      await load(showDeleted);
      alert('User soft-deleted.');
    } catch (e) {
      console.error('Soft delete failed', e);
      alert('Failed to soft-delete: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleDisableToggle = async (row) => {
    // “Disable” is same as soft delete; you can keep both icons if you want.
    return handleSoftDelete(row);
  };

  const handleRestore = async (row) => {
    try {
      await upsertDirectoryAndUser({
        email: row.email,
        name: row.name,
        role: row.role,
        uid: row.uid,
        disabled: false,
      });
      await load(showDeleted);
      alert('User restored.');
    } catch (e) {
      console.error('Restore failed', e);
      alert('Failed to restore: ' + (e?.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">User Management</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm opacity-80 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Show deleted
          </label>
          <button
            onClick={() =>
              openEdit({ email: '', name: '', role: 'staff', uid: null })
            }
            className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 transition"
          >
            <LucidePlus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="opacity-70 text-sm">Loading...</div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="opacity-70 text-sm">
            {showDeleted ? 'No users (including deleted).' : 'No active users.'}
          </div>
        )}

        {sorted.map((row) => (
          <div
            key={row.email}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              row.disabled
                ? 'border-amber-400/20 bg-amber-900/10 opacity-70'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold rounded-full px-2 py-1 ${
                  row.role === 'manager'
                    ? 'bg-emerald-700/50 text-emerald-100'
                    : 'bg-sky-700/40 text-sky-100'
                }`}
              >
                {row.role.toUpperCase()}
              </span>
              <div className="flex flex-col">
                <div className={`font-medium ${row.disabled ? 'line-through' : ''}`}>{row.name || 'User'}</div>
                <div className="text-xs opacity-70">{row.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {row.disabled ? (
                <button
                  title="Restore"
                  className="px-2 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-sm"
                  onClick={() => handleRestore(row)}
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    title="Edit"
                    className="p-2 rounded-md hover:bg-white/10"
                    onClick={() => openEdit(row)}
                  >
                    <LucidePencil size={16} />
                  </button>

                  {row.email && (
                    <a
                      title="Email"
                      className="p-2 rounded-md hover:bg-white/10"
                      href={`mailto:${row.email}`}
                    >
                      <LucideMail size={16} />
                    </a>
                  )}

                  <button
                    title="Disable"
                    className="p-2 rounded-md hover:bg-white/10"
                    onClick={() => handleDisableToggle(row)}
                  >
                    <LucideBan size={16} />
                  </button>

                  <button
                    title="Soft Delete"
                    className="p-2 rounded-md hover:bg-white/10 text-red-400 hover:text-red-300"
                    onClick={() => handleSoftDelete(row)}
                  >
                    <LucideTrash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <EditUserModal
        open={modalOpen}
        initial={editing || { email: '', name: '', role: 'staff', uid: null }}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

/**
 * Optionally back-fill uid for a directory entry.
 * If you store uid on /directory docs, you can delete this and rely on row.uid.
 */
async function maybeFindUidByEmail(email) {
  try {
    const ref = doc(db, '_emailToUid', email); // if you keep a mapping doc, use it
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data()?.uid || null : null;
  } catch {
    return null;
  }
}