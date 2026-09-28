import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';
import StatusBadge from '../../components/ui/StatusBadge';
import { Link } from 'react-router-dom';

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

  // Auto assign state
  const [autoAssigningId, setAutoAssigningId] = useState(null);
  const [autoAssigningAll, setAutoAssigningAll] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');

  // Target Date Modal State
  const [targetDateModalObj, setTargetDateModalObj] = useState(null);
  const [newTargetDate, setNewTargetDate] = useState('');
  const [additionalHours, setAdditionalHours] = useState('24');
  const [targetDateReason, setTargetDateReason] = useState('Operational adjustment by District Officer');
  const [dateUpdating, setDateUpdating] = useState(false);

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

  const handleAutoAssign = async (complaintId) => {
    try {
      setAutoAssigningId(complaintId);
      setNotificationMsg('');
      const res = await zonalService.autoAssignComplaint(complaintId);
      setNotificationMsg(res.message || 'AI Auto-assigned successfully!');
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to auto-assign worker');
    } finally {
      setAutoAssigningId(null);
    }
  };

  const handleAutoAssignAll = async () => {
    try {
      setAutoAssigningAll(true);
      setNotificationMsg('');
      const res = await zonalService.autoAssignAll();
      setNotificationMsg(res.message || 'Batch AI Auto-assignment completed!');
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to auto-assign pending complaints');
    } finally {
      setAutoAssigningAll(false);
    }
  };

  const handleOpenTargetDateModal = (c) => {
    setTargetDateModalObj(c);
    setAdditionalHours('24');
    setTargetDateReason('Extended resolution target date approved by District Admin');
    if (c.slaDeadline) {
      try {
        const d = new Date(c.slaDeadline);
        setNewTargetDate(d.toISOString().slice(0, 16));
      } catch {
        setNewTargetDate('');
      }
    } else {
      setNewTargetDate('');
    }
  };

  const handleTargetDateSubmit = async (e) => {
    e.preventDefault();
    if (!targetDateModalObj) return;

    try {
      setDateUpdating(true);
      const cid = targetDateModalObj.id || targetDateModalObj.complaintId;
      await zonalService.updateTargetDate(cid, {
        target_date: newTargetDate || null,
        additional_hours: !newTargetDate ? additionalHours : null,
        reason: targetDateReason,
      });
      setTargetDateModalObj(null);
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update target date');
    } finally {
      setDateUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <ZonalSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-outline-variant/30">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
              District Complaints & Dispatch
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
              AI auto-assign field personnel, manage resolution deadlines, and inspect SLA timelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAutoAssignAll}
              disabled={autoAssigningAll}
              className="px-4 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${autoAssigningAll ? 'animate-spin' : ''}`}>
                {autoAssigningAll ? 'sync' : 'auto_fix_high'}
              </span>
              {autoAssigningAll ? 'Auto-Assigning with AI...' : 'AI Auto-Assign All Unassigned'}
            </button>

            <Link
              to="/zonal/verifications"
              className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">verified</span>
              Resolution Verifications
            </Link>
          </div>
        </div>

        {notificationMsg && (
          <div className="mb-6 p-4 rounded-xl bg-primary-fixed/40 border border-primary/20 text-on-primary-fixed-variant text-xs flex items-center justify-between animate-fade-in font-medium">
            <span>{notificationMsg}</span>
            <button type="button" onClick={() => setNotificationMsg('')} className="font-bold ml-2">✕</button>
          </div>
        )}

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
              <option value="RESOLUTION_SUBMITTED">RESOLUTION SUBMITTED (Pending Review)</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="ESCALATED">ESCALATED (Breached SLA)</option>
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
            <div className="text-center py-16 text-outline text-sm font-medium">No complaints match current filters.</div>
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
                    <th className="py-3.5 px-4">Target Resolution Date</th>
                    <th className="py-3.5 px-4">Assigned Worker</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {complaints.map((c) => {
                    const isOverdue = c.isOverdue || c.status === 'ESCALATED';
                    return (
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

                        {/* Date Section to Get Resolved */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-semibold text-on-surface text-[11px]">
                                {c.slaDeadline
                                  ? new Date(c.slaDeadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : 'Not specified'}
                              </p>
                              <div className="mt-0.5">
                                {isOverdue ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-error/15 text-error border border-error/30 flex items-center gap-1 w-fit animate-pulse">
                                    <span className="material-symbols-outlined text-[10px]">warning</span>
                                    Overdue {c.slaRemainingHours ? `(${Math.abs(c.slaRemainingHours)}h)` : ''}
                                  </span>
                                ) : c.slaRemainingHours !== null && c.slaRemainingHours !== undefined ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold w-fit block ${
                                    c.slaRemainingHours < 12 ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary'
                                  }`}>
                                    {c.slaRemainingHours}h remaining
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-outline">Standard SLA</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenTargetDateModal(c)}
                              className="p-1 rounded-lg hover:bg-surface-container-high text-outline hover:text-primary transition-colors"
                              title="Set / Adjust Target Date"
                            >
                              <span className="material-symbols-outlined text-sm">edit_calendar</span>
                            </button>
                          </div>
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
                          <div className="flex items-center justify-end gap-1.5">
                            {!c.assignedWorkerId && c.status === 'SUBMITTED' && (
                              <button
                                type="button"
                                disabled={autoAssigningId === (c.id || c.complaintId)}
                                onClick={() => handleAutoAssign(c.id || c.complaintId)}
                                className="px-2.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50"
                                title="Use AI to automatically find and assign best worker"
                              >
                                <span className={`material-symbols-outlined text-sm ${autoAssigningId === (c.id || c.complaintId) ? 'animate-spin' : ''}`}>
                                  {autoAssigningId === (c.id || c.complaintId) ? 'sync' : 'auto_fix_high'}
                                </span>
                                AI Assign
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setAssigningComplaint(c);
                                setSelectedWorkerId(c.assignedWorkerId || '');
                                setAssignNote('');
                              }}
                              className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                              {c.assignedWorkerId ? 'Reassign' : 'Manual'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                    <option value="">-- Choose available personnel --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.worker_tag || w.worker_id || 'Worker'}) — {w.skills?.join(', ') || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Dispatch Instructions (Optional)</label>
                  <textarea
                    rows={3}
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="Enter instructions, location landmarks, or special gear requirements..."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary focus:bg-surface-container-lowest resize-none font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setAssigningComplaint(null)}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                  >
                    {submitting ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Set / Adjust Target Resolution Date */}
        {targetDateModalObj && (
          <div className="fixed inset-0 bg-scrim/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 text-on-surface shadow-2xl civic-glow animate-fade-in space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">event_upcoming</span>
                  <h3 className="text-base font-extrabold text-on-surface">
                    Set Target Resolution Date
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetDateModalObj(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl text-xs space-y-1">
                <p className="font-bold text-on-surface">
                  #{targetDateModalObj.complaintId} — {targetDateModalObj.category?.replace('_', ' ')}
                </p>
                <p className="text-outline text-[11px]">
                  Current SLA Deadline:{' '}
                  {targetDateModalObj.slaDeadline
                    ? new Date(targetDateModalObj.slaDeadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                    : 'Standard SLA'}
                </p>
              </div>

              <form onSubmit={handleTargetDateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-on-surface font-bold mb-1">Pick Specific Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary font-medium"
                  />
                  <p className="text-[10px] text-outline mt-1">Or choose quick extension below:</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '+12 Hours', val: '12' },
                    { label: '+24 Hours', val: '24' },
                    { label: '+48 Hours', val: '48' },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => {
                        setAdditionalHours(btn.val);
                        const d = new Date();
                        d.setHours(d.getHours() + parseInt(btn.val, 10));
                        setNewTargetDate(d.toISOString().slice(0, 16));
                      }}
                      className="py-1.5 bg-surface-container-low hover:bg-primary/15 border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface text-center"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-on-surface font-bold mb-1">Reason for Deadline Setting / Extension</label>
                  <input
                    type="text"
                    value={targetDateReason}
                    onChange={(e) => setTargetDateReason(e.target.value)}
                    placeholder="e.g. Procurement of spare parts required"
                    required
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setTargetDateModalObj(null)}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={dateUpdating}
                    className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold shadow-sm disabled:opacity-50"
                  >
                    {dateUpdating ? 'Updating...' : 'Save Target Date'}
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
