import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';
import StatusBadge from '../../components/ui/StatusBadge';

const ZonalComplaintsPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const [assigningComplaint, setAssigningComplaint] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await zonalService.getComplaints({
        page,
        limit: 15,
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && { search: filters.search }),
      });
      if (data && data.complaints) {
        setComplaints(data.complaints);
        setTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load zonal complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const data = await zonalService.getWorkers();
      if (data && data.workers) {
        setWorkers(data.workers);
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchWorkers();
  }, [page, filters.status, filters.priority]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assigningComplaint || !selectedWorkerId) return;

    try {
      setSubmitting(true);
      await zonalService.assignComplaint(assigningComplaint.id || assigningComplaint.complaintId, {
        worker_id: selectedWorkerId,
        comment: assignNote,
      });
      setAssigningComplaint(null);
      setSelectedWorkerId('');
      setAssignNote('');
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to assign worker');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <ZonalSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="mb-8 pb-4 border-b border-outline-variant/30">
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">District Complaints & Dispatch</h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
            Assign field personnel, inspect ground reports, and ensure on-time SLA resolution
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 mb-6 flex flex-wrap gap-3 items-center justify-between shadow-sm civic-glow">
          <div className="flex-1 min-w-[240px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
            <input
              type="text"
              placeholder="Search complaints in this zone..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && fetchComplaints()}
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:border-primary focus:bg-surface-container-lowest outline-none transition-all placeholder:text-outline"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface outline-none"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED (Unassigned)</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="ESCALATED">ESCALATED</option>
            </select>

            <select
              value={filters.priority}
              onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface outline-none"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm civic-glow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-on-surface-variant mt-3">Loading complaints...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-16 text-outline text-sm font-medium">No complaints in this category.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-low/50 text-outline font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Ref ID</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Assigned Worker</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {complaints.map((c) => (
                    <tr key={c.id || c.complaintId} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        #{c.complaintId || c.id?.slice(-6)}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-bold text-on-surface">
                        {c.category?.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant max-w-xs truncate font-medium">
                        {c.address}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.priority === 'CRITICAL' ? 'bg-error-container text-on-error-container' :
                          c.priority === 'HIGH' ? 'bg-tertiary-container/50 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3.5 px-4 text-on-surface font-medium">
                        {c.assignedWorkerName ? (
                          <span className="text-secondary font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">engineering</span>
                            {c.assignedWorkerName}
                          </span>
                        ) : (
                          <span className="text-outline italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningComplaint(c);
                            setSelectedWorkerId(c.assignedWorkerId || '');
                            setAssignNote('');
                          }}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          {c.assignedWorkerId ? 'Reassign' : 'Assign Worker'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant font-medium bg-surface-container-low/30">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low text-on-surface rounded-xl font-bold disabled:opacity-40 transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low text-on-surface rounded-xl font-bold disabled:opacity-40 transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal for Assigning Worker */}
        {assigningComplaint && (
          <div className="fixed inset-0 bg-scrim/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg p-6 text-on-surface shadow-2xl civic-glow animate-fade-in">
              <div className="flex justify-between items-start mb-4 pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-[11px] font-extrabold text-primary uppercase tracking-wider">Task Assignment</span>
                  <h3 className="text-lg font-extrabold text-on-surface capitalize mt-0.5">
                    #{assigningComplaint.complaintId} — {assigningComplaint.category?.replace('_', ' ')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningComplaint(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Select Field Worker</label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  >
                    <option value="">-- Choose Field Worker --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.worker_id || 'Worker'}) — {w.active_tasks || 0} active task(s)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Special Instructions / Dispatch Note</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Inspect road patch near metro pillar 42, ensure safety cones are set up"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningComplaint(null)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedWorkerId}
                    className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm"
                  >
                    {submitting ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ZonalComplaintsPage;
