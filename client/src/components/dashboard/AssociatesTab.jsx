import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function AssociateTab() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(collection(db, 'workers'), where('userId', '==', user.uid), limit(1));
      const snap = await getDocs(q);
      const w = snap.docs[0]?.data();
      setStats({ assignedToday: w?.assignedToday || 0, assignedMonth: w?.assignedMonth || 0 });
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My Stats & Notes</h2>
      {stats ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="text-sm opacity-70">Assigned Today</div>
            <div className="text-2xl font-bold">{stats.assignedToday}</div>
          </div>
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="text-sm opacity-70">Total Month</div>
            <div className="text-2xl font-bold">{stats.assignedMonth}</div>
          </div>
        </div>
      ) : <div className="opacity-70">Loading…</div>}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="text-sm mb-2 opacity-70">Notes</div>
        <textarea className="w-full h-32 p-3 rounded-xl border border-neutral-300 bg-white/70 focus:outline-none" placeholder="Jot down quick notes here…" />
      </div>
    </div>
  );
}