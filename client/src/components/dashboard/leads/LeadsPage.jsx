import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Plus, Trash2, UserRoundCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { createLead, fetchAllLeads, fetchMyLeads, removeLead, updateLead } from '../../../lib/leads';

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return isNaN(d) ? '—' : d.toLocaleString();
}
function isOverdue(lead) {
  if (lead.status === 'closed') return false;
  const now = new Date();
  const due = lead.dueAt?.toDate ? lead.dueAt.toDate() : new Date(lead.dueAt);
  return due < now;
}

export default function LeadsPage() {
  const { user, isManager } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // form
  const [customer, setCustomer] = useState('');
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 24*3600*1000).toISOString().slice(0,16)); // tomorrow, local
  const [assigneeId, setAssigneeId] = useState('me'); // 'me' | 'custom'
  const [assigneeEmail, setAssigneeEmail] = useState(''); // quick entry if manager wants to assign by email/name
  const assignedName = useMemo(() => assigneeEmail.split('@')[0] || user?.name || 'User', [assigneeEmail, user]);

  async function load() {
    setLoading(true);
    try {
      const data = isManager ? await fetchAllLeads() : await fetchMyLeads(user.uid);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (user) load(); }, [user, isManager]);

  async function onAdd() {
    if (!customer || !dueAt) return;
    const assignedTo = assigneeId === 'me' ? user.uid : assigneeEmail || user.uid;
    await createLead({
      customer,
      assignedTo,
      assignedName,
      dueAt,
      note: ''
    });
    setCustomer('');
    setAssigneeEmail('');
    await load();
  }

  function downloadCSV() {
    const headers = ['Customer','Status','AssignedTo','AssignedName','DueAt','CreatedAt'];
    const lines = rows.map(r => [
      r.customer, r.status, r.assignedTo, r.assignedName || '',
      r.dueAt?.toDate ? r.dueAt.toDate().toISOString() : '',
      r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : ''
    ].join(','));
    const blob = new Blob([[headers.join(',') + '\n' + lines.join('\n')]], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const overdueCount = rows.filter(isOverdue).length;

  return (
    <div className="max-w-6xl mx-auto px-3 space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="text-white/80 text-lg font-semibold flex items-center gap-2">
          Leads {overdueCount > 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200">
              {overdueCount} overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/10 hover:bg-white/20">
            <Download size={16}/> CSV
          </button>
        </div>
      </div>

      {/* Add lead */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70 mb-3">Add Lead</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60 block mb-1">Customer</label>
            <input
              className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none"
              placeholder="Jane Doe"
              value={customer}
              onChange={(e)=>setCustomer(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">Follow-up</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none"
              value={dueAt}
              onChange={(e)=>setDueAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">Assign</label>
            <div className="flex gap-2">
              <button
                onClick={()=>setAssigneeId('me')}
                className={`px-3 py-2 rounded-lg border ${assigneeId==='me' ? 'bg-white/20 border-white/20' : 'bg-white/10 border-white/10 hover:bg-white/15'}`}>
                Me
              </button>
              {isManager && (
                <>
                  <button
                    onClick={()=>setAssigneeId('custom')}
                    className={`px-3 py-2 rounded-lg border ${assigneeId==='custom' ? 'bg-white/20 border-white/20' : 'bg-white/10 border-white/10 hover:bg-white/15'}`}>
                    Other
                  </button>
                  {assigneeId==='custom' && (
                    <input
                      className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 outline-none"
                      placeholder="user@company.com"
                      value={assigneeEmail}
                      onChange={(e)=>setAssigneeEmail(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-400/20 bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-100">
            <Plus size={16}/> Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-3 py-2 text-sm text-white/70 border-b border-white/10 flex items-center gap-2">
          <Filter size={16}/> {isManager ? 'All Leads' : 'My Leads'}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="text-left px-4 py-2">Customer</th>
                <th className="text-left px-4 py-2">Assigned</th>
                <th className="text-left px-4 py-2">Due</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.length === 0 && (
                <tr><td className="px-4 py-6 text-white/60" colSpan={5}>No leads yet.</td></tr>
              )}
              {rows.map(l => {
                const overdue = isOverdue(l);
                return (
                  <tr key={l.id} className={overdue ? 'bg-rose-500/5' : ''}>
                    <td className="px-4 py-2">{l.customer}</td>
                    <td className="px-4 py-2">{l.assignedName || l.assignedTo?.slice(0,6)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${overdue ? 'bg-rose-500/20 text-rose-200' : 'bg-white/10 text-white/80'}`}>
                        {overdue ? <AlertCircle size={14}/> : null}
                        {fmtDate(l.dueAt)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={l.status}
                        onChange={async (e)=>{ await updateLead(l.id, { status: e.target.value }); await load(); }}
                        className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="working">Working</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/20"
                          onClick={async ()=>{ await updateLead(l.id, { status: 'closed' }); await load(); }}>
                          <CheckCircle2 size={14}/> Close
                        </button>
                        {(isManager || l.assignedTo === user.uid) && (
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-rose-500/20"
                            onClick={async ()=>{ await removeLead(l.id); await load(); }}>
                            <Trash2 size={14}/> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}