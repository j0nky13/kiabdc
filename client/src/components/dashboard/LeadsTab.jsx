import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import {
  collection, query, orderBy, limit, getDocs,
  where, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { Search, CheckCircle2, XCircle } from 'lucide-react';

export default function LeadsTab() {
  const { isManager, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [qText, setQText] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlyOpen, setOnlyOpen] = useState(true);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    return rows.filter(r => {
      if (onlyOpen && r.closed) return false;
      if (!t) return true;
      return (r.customer || '').toLowerCase().includes(t) ||
             (r.assignedToName || '').toLowerCase().includes(t);
    });
  }, [rows, qText, onlyOpen]);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const base = collection(db, 'leads');
      let qy;
      if (onlyOpen) {
        // show open first, newest handed first
        qy = query(base, where('closed', '==', false), orderBy('assignedAt', 'desc'), limit(100));
      } else {
        qy = query(base, orderBy('assignedAt', 'desc'), limit(100));
      }
      const snap = await getDocs(qy);
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [onlyOpen]);

  const closeLead = async (leadId) => {
    await updateDoc(doc(db, 'leads', leadId), {
      closed: true,
      status: 'closed',
      closedAt: serverTimestamp(),
      closedByUid: user.uid,
      closedByName: user.name || user.email || 'Manager'
    });
    await load();
  };

  const reopenLead = async (leadId) => {
    await updateDoc(doc(db, 'leads', leadId), {
      closed: false,
      status: 'handed',
      closedAt: null,
      closedByUid: null,
      closedByName: null
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search customers or assignee…"
            className="w-full rounded-lg bg-white/10 border border-white/10 pl-9 pr-3 py-2 outline-none placeholder:text-white/50"
          />
        </div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-sky-500"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          Only open
        </label>
      </div>

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-left px-4 py-2">Assigned To</th>
              <th className="text-left px-4 py-2">Assigned At</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Follow-up Due</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading && (
              <tr><td className="px-4 py-3 text-white/60" colSpan={6}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td className="px-4 py-3 text-white/60" colSpan={6}>No leads found.</td></tr>
            )}
            {!loading && filtered.map((l) => (
              <tr key={l.id} className="align-middle">
                <td className="px-4 py-2">{l.customer}</td>
                <td className="px-4 py-2">{l.assignedToName || l.assignedTo}</td>
                <td className="px-4 py-2">{l.assignedAt?.seconds ? new Date(l.assignedAt.seconds * 1000).toLocaleString() : '—'}</td>
                <td className="px-4 py-2">{l.status || (l.closed ? 'closed' : 'handed')}</td>
                <td className="px-4 py-2">
                  {l.followUpDue
                    ? new Date(l.followUpDue?.seconds ? l.followUpDue.seconds * 1000 : l.followUpDue).toLocaleString()
                    : '—'}
                </td>
                <td className="px-4 py-2">
                  {l.closed ? (
                    <button
                      onClick={() => reopenLead(l.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20"
                    >
                      <XCircle size={14}/> Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => closeLead(l.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20"
                    >
                      <CheckCircle2 size={14}/> Mark Closed
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}