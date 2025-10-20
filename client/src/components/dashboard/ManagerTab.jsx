// client/src/components/dashboard/ManagerTab.jsx
import { useEffect, useState } from 'react';
import { doc, setDoc, getDocs, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { setUserRoleClaim } from '../../lib/callables';
import UserRow from './UserRow';
import EditUserModal from './EditUserModal';
import { Plus } from 'lucide-react';
import { getAuth } from 'firebase/auth';

export default function ManagerTab() {
  const { user, sendMagicLink, isManager } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(query(collection(db, 'users'), orderBy('email')));
        if (!mounted) return;
        const list = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })); // id === uid
        setItems(list);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setModalOpen(true); };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const email = (form.email || '').trim().toLowerCase();
      const name = (form.name || '').trim();
      const role = (form.role || 'staff').toLowerCase();

      if (editing && editing.uid) {
        // Editing an existing profile (has uid) → update Firestore and claims
        await setDoc(doc(db, 'users', editing.uid), { email, name, role }, { merge: true });

        try {
          await setUserRoleClaim(editing.uid, role); // CF: set custom claim + revoke tokens
        } catch (e) {
          console.error('setUserRoleClaim failed', e);
          alert('Role updated in profile, but updating permissions failed. Try again.');
        }

        // If manager edited themselves, force token refresh so UI updates immediately
        const auth = getAuth();
        if (auth.currentUser?.uid === editing.uid) {
          await auth.currentUser.getIdToken(true);
        }

        setItems(prev => prev.map(x => x.uid === editing.uid ? { ...x, email, name, role } : x));
      } else {
        // Adding a new person (no uid yet) → write invite to directory/{email}
        await setDoc(doc(db, 'directory', email), {
          email,
          name: name || 'User',
          role,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Optional: send them a magic link now
        try {
          await sendMagicLink(email);
        } catch (e) {
          console.warn('Could not send magic link:', e);
        }

        // Do NOT add to users list yet (no uid). They appear after first sign-in.
      }

      setModalOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (u) => {
    await setDoc(doc(db, 'users', u.uid), { disabled: !u.disabled }, { merge: true });
    setItems(prev => prev.map(x => x.uid === u.uid ? { ...x, disabled: !u.disabled } : x));
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete ${u.email}? This removes only the profile doc.`)) return;
    alert('Soft-delete not implemented in this version.');
  };

  if (!isManager) {
    return <div className="text-white/70">You do not have permission to view this tab.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">User Management</h2>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="grid gap-2">
        {loading && <div className="text-white/60">Loading users…</div>}
        {!loading && items.length === 0 && (
          <div className="text-white/60">No users yet.</div>
        )}
        {items.map(u => (
          <UserRow
            key={u.uid}
            u={u}
            onEdit={openEdit}
            onToggleDisabled={handleToggleDisabled}
            onDelete={handleDelete}
            onSendLink={async (row) => {
              try {
                await sendMagicLink(row.email);
                alert(`Magic link sent to ${row.email}`);
              } catch (e) {
                alert(`Failed to send link: ${e.message}`);
              }
            }}
          />
        ))}
      </div>

      <EditUserModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}