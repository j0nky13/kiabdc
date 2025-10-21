import { useEffect, useMemo, useState } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  addDoc, collection, serverTimestamp, query, where, orderBy, getDocs, Timestamp
} from 'firebase/firestore';
import { computeCommission, sum, projMonth, projYear } from '../../../lib/commission';
import { Plus, Loader2, Download, Table, X, BarChart3, LineChart } from 'lucide-react';

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d = new Date()) { return new Date(d.getFullYear(), 0, 1); }

// --- Tiny helpers for charts ---
function groupByDayMTD(rows) {
  const s = startOfMonth();
  const map = new Map();
  rows.forEach(r => {
    const dt = r.date?.toDate ? r.date.toDate() : new Date(r.date);
    if (dt >= s) {
      const key = dt.toISOString().slice(0,10); // YYYY-MM-DD
      map.set(key, (map.get(key) || 0) + (Number(r.commission) || 0));
    }
  });
  // fill missing days up to today for smoother chart
  const today = new Date();
  const days = [];
  for (let d = new Date(s); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0,10);
    days.push({ key, amount: map.get(key) || 0 });
  }
  return days;
}

function groupByMonthYTD(rows) {
  const yStart = startOfYear();
  const monthly = Array(12).fill(0);
  rows.forEach(r => {
    const dt = r.date?.toDate ? r.date.toDate() : new Date(r.date);
    if (dt >= yStart) {
      monthly[dt.getMonth()] += Number(r.frontGross) || 0;
    }
  });
  return monthly; // index = 0..11
}

// Simple SVG Line Chart
function MiniLineChart({ points = [], height = 120, className = '' }) {
  if (!points.length) return <div className="text-white/60 text-sm">No data</div>;
  const width = 560; // fixed for now; container will scroll if smaller
  const max = Math.max(...points.map(p => p.amount), 1);
  const stepX = width / Math.max(points.length - 1, 1);
  const path = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.amount / max) * (height - 20) - 10;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-full h-[${height}px]` + className}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80" />
    </svg>
  );
}

// Simple SVG Bar Chart
function MiniBarChart({ values = [], height = 160, className = '' }) {
  if (!values.length) return <div className="text-white/60 text-sm">No data</div>;
  const width = 560;
  const max = Math.max(...values, 1);
  const barW = Math.max(8, Math.floor(width / (values.length * 1.5)));
  const gap = Math.max(6, Math.floor(barW / 2));
  const chartW = values.length * (barW + gap) + gap;
  return (
    <svg viewBox={`0 0 ${chartW} ${height}`} className={`w-full h-[${height}px]` + className}>
      {values.map((v, i) => {
        const h = Math.round((v / max) * (height - 20));
        const x = gap + i * (barW + gap);
        const y = height - h - 10;
        return <rect key={i} x={x} y={y} width={barW} height={h} className="fill-white/80" rx="3" />
      })}
    </svg>
  );
}

// Helper to derive the commission plan from a front gross
function derivePlan(frontGross, split50) {
  const fg = Number(frontGross || 0);
  const split = split50 ? 0.5 : 1; // 50/50 or 100
  if (fg <= 0) return { type: 'flat', flat: 0, percent: 0, split };
  if (fg < 1000) return { type: 'flat', flat: 75, percent: 0, split };
  if (fg < 1701) return { type: 'flat', flat: 100, percent: 0, split };
  // Percent tiers
  if (fg < 2000) return { type: 'percent', percent: 0.25, flat: 0, split };
  if (fg < 3000) return { type: 'percent', percent: 0.30, flat: 0, split };
  return { type: 'percent', percent: 0.35, flat: 0, split };
}

export default function StatsSales() {
  const { user } = useAuth();
  const [frontGross, setFrontGross] = useState('');
  const [vehicleType, setVehicleType] = useState('new'); // new | used (for charts/filters)
  const [split50, setSplit50] = useState(false);          // 50/50 split toggle
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysElapsedInMonth = today.getDate();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);

  // Live plan and commission preview
  const plan = useMemo(() => derivePlan(frontGross, split50), [frontGross, split50]);
  const commissionPreview = useMemo(() => {
    return computeCommission({
      frontGross: Number(frontGross || 0),
      vehicleType, // passed through for completeness
      type: plan.type,
      percent: plan.percent,
      flat: plan.flat,
      split: plan.split
    });
  }, [frontGross, vehicleType, plan]);

  const reload = async () => {
    setLoading(true);
    try {
      const base = collection(db, 'salesRecords');
      const qy = query(base, where('uid', '==', user.uid), orderBy('date', 'desc'));
      const snap = await getDocs(qy);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) reload(); }, [user]);

  const mtd = useMemo(() => {
    const mStart = startOfMonth();
    const list = rows.filter(r => (r.date?.toDate?.() || new Date(r.date)) >= mStart);
    return {
      gross: sum(list.map(l => l.frontGross)),
      commission: sum(list.map(l => l.commission)),
      count: list.length
    };
  }, [rows]);

  const ytd = useMemo(() => {
    const yStart = startOfYear();
    const list = rows.filter(r => (r.date?.toDate?.() || new Date(r.date)) >= yStart);
    return {
      gross: sum(list.map(l => l.frontGross)),
      commission: sum(list.map(l => l.commission)),
      count: list.length
    };
  }, [rows]);

  const projections = useMemo(() => ({
    month: projMonth(mtd.commission, daysElapsedInMonth, daysInMonth),
    year: projYear(ytd.commission, dayOfYear)
  }), [mtd, ytd, daysElapsedInMonth, daysInMonth, dayOfYear]);

  const mtdDaily = useMemo(() => groupByDayMTD(rows), [rows]);
  const ytdMonthlyGross = useMemo(() => groupByMonthYTD(rows), [rows]);

  const save = async () => {
    if (!frontGross) return;
    setSaving(true);
    try {
      const commission = computeCommission({
        frontGross: Number(frontGross || 0),
        vehicleType,
        type: plan.type,
        percent: plan.percent,
        flat: plan.flat,
        split: plan.split
      });

      await addDoc(collection(db, 'salesRecords'), {
        uid: user.uid,
        repName: user.name || user.email || 'User',
        date: Timestamp.fromDate(new Date()),
        vehicleType,
        frontGross: Number(frontGross || 0),
        plan,            // persist the auto-detected plan
        commission,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      setFrontGross('');
      setSplit50(false);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const downloadCSV = () => {
    const headers = [
      'Date','FrontGross','Commission','VehicleType','PlanType','Percent','Flat','Split'
    ];
    const lines = rows.map(r => {
      const dt = r.date?.toDate ? r.date.toDate() : new Date(r.date);
      const p = r.plan || {};
      return [
        dt.toISOString(),
        r.frontGross ?? '',
        r.commission ?? '',
        r.vehicleType ?? '',
        p.type ?? '',
        (p.percent ?? ''),
        (p.flat ?? ''),
        (p.split ?? '')
      ].join(',');
    });
    const blob = new Blob([[headers.join(',')].concat('\n').concat(lines.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_records.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pretty label for the detected plan
  const planLabel = plan.type === 'flat'
    ? `Mini $${plan.flat}`
    : `${Math.round(plan.percent * 100)}% ${plan.split !== 1 ? `· split ${Math.round(plan.split * 100)}%` : ''}`;

return (
  <div className="space-y-6 max-w-6xl mx-auto px-3">
      {/* Top: Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">MTD Commission</div>
          <div className="text-2xl font-semibold">${mtd.commission.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">Tracking Units (MTD)</div>
          <div className="text-2xl font-semibold">{mtd.count}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">MTD Gross</div>
          <div className="text-2xl font-semibold">${mtd.gross.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">Projected Year</div>
          <div className="text-2xl font-semibold">${projections.year.toLocaleString()}</div>
          <div className="text-xs text-white/50">Based on current YTD pace</div>
        </div>
      </div>

    {/* Middle: Entry form (refined two-column layout) */}
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* LEFT: Entry form */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-5">
          <div className="text-sm font-medium tracking-wide text-white/80">Add Sale</div>

          {/* Inputs row */}
          <div className="flex items-end gap-5 flex-wrap">
            {/* Gross */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">Front Gross</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="2450"
                  value={frontGross}
                  onChange={(e) => setFrontGross(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !saving && save()}
                  className="w-[11ch] sm:w-[12ch] rounded-lg bg-white/10 border border-white/10 pl-7 pr-3 py-2 outline-none placeholder:text-white/40 text-base focus:ring-2 focus:ring-white/20"
                />
              </div>
            </label>

            {/* Vehicle Type */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60">Vehicle Type</span>
              <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => setVehicleType('new')}
                  className={`px-3 py-2 text-xs transition ${
                    vehicleType === 'new' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleType('used')}
                  className={`px-3 py-2 text-xs transition border-l border-white/10 ${
                    vehicleType === 'used' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Used
                </button>
              </div>
            </div>

            {/* Split selector (segmented) */}
            <div className="flex flex-col gap-1 ml-auto">
              <span className="text-xs text-white/60">Split</span>
              <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => setSplit50(false)}
                  className={`px-3 py-2 text-xs transition ${
                    !split50 ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setSplit50(true)}
                  className={`px-3 py-2 text-xs transition border-l border-white/10 ${
                    split50 ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  50/50
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20"
            >
              <Download size={16} /> CSV
            </button>
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20"
            >
              <Table size={16} /> View all
            </button>
          </div>
        </div>

        {/* RIGHT: Preview + Add */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 flex flex-col lg:self-stretch">
          <div className="space-y-3">
            <div className="text-xs text-white/60">Detected plan</div>
            <div className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-2 py-1 text-sm w-fit">
              {plan.type === 'flat'
                ? `Mini $${plan.flat}`
                : `${Math.round(plan.percent * 100)}%${plan.split !== 1 ? ` · split ${Math.round(plan.split * 100)}%` : ''}`}
            </div>
            <div className="text-xs text-white/60">Preview commission</div>
            <div className="text-3xl font-semibold">${commissionPreview.toLocaleString()}</div>
          </div>
          <div className="mt-auto pt-4">
            <button
              onClick={save}
              disabled={saving || !frontGross}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-emerald-400/20 bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Add Sale
            </button>
          </div>
        </div>
      </div>
    </div>
      {/* Bottom: Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-2"><LineChart size={16}/> MTD Daily Commission</div>
          <div className="overflow-x-auto">
            <MiniLineChart points={mtdDaily} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-2"><BarChart3 size={16}/> YTD Monthly Gross</div>
          <div className="overflow-x-auto">
            <MiniBarChart values={ytdMonthlyGross} />
          </div>
        </div>
      </div>

      {/* Modal: All entries */}
      {showAll && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAll(false)} />
          <div className="relative w-[95vw] max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 backdrop-blur-xl">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="text-sm font-medium">All Entries</div>
              <button onClick={() => setShowAll(false)} className="text-white/70 hover:text-white"><X size={18}/></button>
            </div>
            <div className="overflow-auto max-h-[75vh]">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/60 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Front Gross</th>
                    <th className="text-left px-4 py-2">Vehicle</th>
                    <th className="text-left px-4 py-2">Plan</th>
                    <th className="text-left px-4 py-2">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.length === 0 && (
                    <tr><td className="px-4 py-3 text-white/60" colSpan={5}>No entries.</td></tr>
                  )}
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{r.date?.toDate ? r.date.toDate().toLocaleString() : new Date(r.date).toLocaleString()}</td>
                      <td className="px-4 py-2">${(r.frontGross || 0).toLocaleString()}</td>
                      <td className="px-4 py-2">{r.vehicleType || r.plan?.vehicleType || '—'}</td>
                      <td className="px-4 py-2">
                        {r.plan?.type === 'flat'
                          ? `Flat $${r.plan.flat}`
                          : `${(r.plan?.percent || 0) * 100}% ${r.plan?.split && r.plan.split !== 1 ? `· split ${(r.plan.split * 100)}%` : ''}`}
                      </td>
                      <td className="px-4 py-2 font-semibold">${(r.commission || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}