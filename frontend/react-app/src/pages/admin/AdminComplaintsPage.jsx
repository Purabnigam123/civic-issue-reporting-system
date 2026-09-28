import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { adminService } from '../../services/adminService';
import StatusBadge from '../../components/ui/StatusBadge';

const AdminComplaintsPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    search: '',
  });

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState({ status: '', comment: '' });
  const [updating, setUpdating] = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
      };
      const data = await adminService.getComplaints(params);
      if (data && data.complaints) {
        setComplaints(data.complaints);
        setTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [page, filters.status, filters.priority, filters.category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchComplaints();
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint || !statusUpdate.status) return;

    try {
      setUpdating(true);
      const res = await adminService.updateComplaintStatus(selectedComplaint.id || selectedComplaint.complaintId, {
        status: statusUpdate.status,
        comment: statusUpdate.comment,
      });
      if (res && res.complaint) {
        setSelectedComplaint(null);
        setStatusUpdate({ status: '', comment: '' });
        fetchComplaints();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
            <span className="material-symbols-outlined text-primary text-sm">list_alt</span>
            <span>Municipal Issue Ledger</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
            City-Wide Civic Complaints
          </h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
            Search, filter, inspect evidence, and manage lifecycle status across all Delhi zones
          </p>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 mb-6 flex flex-wrap gap-3 items-center justify-between civic-glow">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] flex gap-2">
            <input
              type="text"
              placeholder="Search by ID, keyword, address, or reporter..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface placeholder:text-outline focus:border-primary outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container shadow-sm"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2 flex-wrap">
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface outline-none"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="RESOLUTION_SUBMITTED">RESOLUTION SUBMITTED (Pending Review)</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="REJECTED">REJECTED</option>
            </select>

            <select
              value={filters.priority}
              onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface outline-none"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
              className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface outline-none"
            >
              <option value="">All Categories</option>
              <option value="pothole">Pothole</option>
              <option value="broken_streetlight">Broken Streetlight</option>
              <option value="garbage">Garbage / Waste</option>
              <option value="drainage">Drainage</option>
              <option value="water_issue">Water Issue</option>
              <option value="public_property">Damaged Public Property</option>
              <option value="road_damage">Road Damage</option>
            </select>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden civic-glow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant mt-3 font-semibold">Loading complaints register...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-outline text-4xl mb-2">inbox</span>
              <p className="text-sm text-on-surface-variant font-medium">No complaints match your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-bold uppercase">
                    <th className="py-3.5 px-4">Ref ID</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">District</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">SLA Target</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {complaints.map((c) => (
                    <tr key={c.id || c.complaintId} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        #{c.complaintId || c.id?.slice(-6)}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-on-surface">
                        {c.category?.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant font-medium">
                        {c.district_name || 'Central Delhi'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.priority === 'CRITICAL' ? 'bg-error-container text-error' :
                          c.priority === 'HIGH' ? 'bg-tertiary-fixed text-tertiary' : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-bold ${
                          c.slaStatus === 'BREACHED' ? 'text-error' :
                          c.slaStatus === 'AT_RISK' ? 'text-tertiary' : 'text-secondary'
                        }`}>
                          {c.slaStatus || 'ON_TRACK'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComplaint(c);
                            setStatusUpdate({ status: c.status, comment: '' });
                          }}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg disabled:opacity-40 font-semibold"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg disabled:opacity-40 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal for Super Admin Management */}
        {selectedComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 text-on-surface shadow-2xl civic-glow-shadow">
              <div className="flex justify-between items-start mb-4 pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Manage Complaint</span>
                  <h3 className="text-lg font-bold text-on-surface capitalize">
                    #{selectedComplaint.complaintId} — {selectedComplaint.category?.replace('_', ' ')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="text-on-surface-variant hover:text-on-surface text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-on-surface-variant font-bold uppercase tracking-wider mb-1">Description</p>
                  <p className="p-3 bg-surface-container-low rounded-xl text-on-surface whitespace-pre-wrap leading-relaxed">
                    {selectedComplaint.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-container-low rounded-xl">
                    <span className="text-on-surface-variant block font-bold">District</span>
                    <span className="font-semibold text-on-surface">{selectedComplaint.district_name || 'Central Delhi'}</span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-xl">
                    <span className="text-on-surface-variant block font-bold">Current Status</span>
                    <StatusBadge status={selectedComplaint.status} />
                  </div>
                </div>

                {/* Status Override Form */}
                <form onSubmit={handleStatusSubmit} className="space-y-3 pt-3 border-t border-outline-variant/20">
                  <h4 className="font-bold text-on-surface text-sm">Override Lifecycle Status</h4>
                  <div>
                    <label className="block text-on-surface-variant font-semibold mb-1">Select New Status</label>
                    <select
                      value={statusUpdate.status}
                      onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none"
                    >
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="ESCALATED">ESCALATED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-on-surface-variant font-semibold mb-1">Admin Audit Reason / Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Manually escalated due to resident escalation"
                      value={statusUpdate.comment}
                      onChange={(e) => setStatusUpdate({ ...statusUpdate, comment: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedComplaint(null)}
                      className="px-4 py-2 border border-outline-variant/30 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold disabled:opacity-50 shadow-sm"
                    >
                      {updating ? 'Saving...' : 'Apply Transition'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminComplaintsPage;
