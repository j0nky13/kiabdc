import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function SalesTab() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(
        collection(db, 'sales'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My Sales & Forecasts</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Vehicle</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-2 pr-4">{s.date?.toDate ? s.date.toDate().toLocaleDateString() : '—'}</td>
                <td className="py-2 pr-4">{s.customer}</td>
                <td className="py-2 pr-4">{s.vehicle}</td>
                <td className="py-2 pr-4">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}