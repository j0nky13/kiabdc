// client/src/components/dashboard/UserRow.jsx
import { useState } from 'react';
import { ShieldCheck, User, Ban, Trash2, Pencil, Mail } from 'lucide-react';

export default function UserRow({ u, onEdit, onToggleDisabled, onDelete, onSendLink }) {
  const [busy, setBusy] = useState(false);
  const badge =
    (u.role || 'staff').toLowerCase() === 'manager'
      ? 'bg-emerald-500/20 text-emerald-300'
      : 'bg-sky-500/20 text-sky-300';

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-2xs px-2 py-0.5 rounded-full ${badge}`}>
            {(u.role || 'staff').toUpperCase()}
          </span>
          <span className="font-medium text-white truncate">{u.name || '—'}</span>
        </div>
        <div className="text-xs text-white/60 truncate">{u.email || '—'}</div>
      </div>

      <div className="flex items-center gap-2">
        {/* Edit */}
        <button
          className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/80"
          onClick={() => onEdit(u)}
          title="Edit"
          disabled={busy}
        >
          <Pencil size={16} />
        </button>

        {/* Send Login Link */}
        <button
          className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/80"
          onClick={() => onSendLink(u)}
          title="Send login link"
          disabled={busy}
        >
          <Mail size={16} />
        </button>

        {/* Disable / Enable */}
        <button
          className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/80"
          onClick={async () => {
            try {
              setBusy(true);
              await onToggleDisabled(u);
            } finally {
              setBusy(false);
            }
          }}
          title={u.disabled ? 'Enable' : 'Disable'}
        >
          <Ban size={16} />
        </button>

        {/* Delete */}
        <button
          className="px-2 py-1 rounded-lg hover:bg-red-500/10 text-red-300"
          onClick={() => onDelete(u)}
          title="Delete"
          disabled={busy}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}