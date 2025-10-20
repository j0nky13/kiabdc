// client/src/components/dashboard/EditUserModal.jsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function EditUserModal({ open, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'staff',
    disabled: false,
  });

  // hydrate form when opening / initial changes
  useEffect(() => {
    if (initial) {
      setForm({
        email: initial.email || '',
        name: initial.name || '',
        role: initial.role || 'staff',
        disabled: !!initial.disabled,
      });
    } else {
      setForm({ email: '', name: '', role: 'staff', disabled: false });
    }
  }, [initial, open]);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) {
      alert('Email is required.');
      return;
    }
    onSave(form);
  };

  // Render in a portal so it can NEVER be clipped by headers/containers
  return createPortal(
  <div
  className="
    fixed inset-0 z-[99999]
    flex items-center justify-center
    backdrop-blur-sm
  "
  style={{ position: 'fixed', top: 0, left: 0 }}
  aria-modal="true"
  role="dialog"
  onMouseDown={onClose}
>
      {/* Click shield is transparent; no dark backdrop */}
      <div className="absolute inset-0" />

      {/* Card */}
      <div
        className="
          pointer-events-auto relative
          mx-4 my-10 w-[420px]
          rounded-2xl border border-white/20 bg-white/10
          p-6 text-white shadow-2xl backdrop-blur-xl
          transition-all duration-150
        "
        onMouseDown={(e) => e.stopPropagation()} // prevent outside click from firing when clicking inside
      >
        <h2 className="text-lg font-semibold mb-4 text-center">
          {initial ? 'Edit User' : 'Add User'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg px-3 py-2 bg-black/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={!!initial} // lock when editing
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg px-3 py-2 bg-black/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg px-3 py-2 bg-black/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Save…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}