import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { adminService } from '../../services/adminService';

const AdminEscalatedPage = () => {
  const [escalatedList, setEscalatedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Action Modal State
  const [selectedEscalated, setSelectedEscalated] = useState(null);
  const [actionType, setActionType] = useState('REASSIGN');
  const [actionComment, setActionComment] = useState('');
  const [actionWorkerId, setActionWorkerId] = useState('');
  const [actionHours, setActionHours] = useState('24');
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchEscalated = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDistrict) params.district_id = selectedDistrict;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedPriority) params.priority = selectedPriority;

      const res = await adminService.getEscalatedComplaints(params);
      if (res && res.complaints) {
        setEscalatedList(res.complaints);
      }
    } catch (err) {
      console.error('Failed to load escalated complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalated();
  }, [selectedDistrict, selectedCategory, selectedPriority]);

  const handleSlaScan = async () => {
    try {
      setScanning(true);
      setScanMessage('');
      const res = await adminService.triggerSlaScan();
      const count = res?.result?.escalated_count || 0;
      setScanMessage(`Scan completed: ${count} breached complaint(s) auto-escalated.`);
      fetchEscalated();
    } catch (err) {
      setScanMessage('Failed to run SLA scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleOpenActionModal = async (complaint, type) => {
    setSelectedEscalated(complaint);
    setActionType(type);
    setActionComment('');
    setActionWorkerId('');
    setActionHours('24');

    if (type === 'REASSIGN') {
      try {
        const usersRes = await adminService.getUsers({ role: 'WORKER' });
        if (usersRes && usersRes.users) {
          const cDistrict = (complaint.district_id || '').toLowerCase();
          const filtered = usersRes.users.filter(
            (u) => !cDistrict || (u.district_id || '').toLowerCase() === cDistrict
          );
          setAvailableWorkers(filtered.length > 0 ? filtered : usersRes.users);
        }
      } catch (err) {
        console.error('Failed to load workers for reassignment:', err);
      }
    }
  };

  const handleConfirmEscalatedAction = async (e) => {
    e.preventDefault();
    if (!selectedEscalated) return;

    try {
      setActionSubmitting(true);
      const cid = selectedEscalated.id || selectedEscalated.complaintId;
      const payload = {
        action: actionType,
        comment: actionComment || `Action ${actionType} taken by Super Admin`,
        worker_id: actionWorkerId || null,
        additional_hours: parseInt(actionHours, 10) || 24,
      };

      const res = await adminService.takeEscalatedAction(cid, payload);
      setScanMessage(res.message || 'Action executed successfully');
      // Optimistically remove from local list
      setEscalatedList((prev) => prev.filter((item) => (item.id || item.complaintId) !== cid));
      setSelectedEscalated(null);
      fetchEscalated();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to execute administrative action');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Client-side search filter
  const filteredList = escalatedList.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.complaintId?.toLowerCase().includes(query) ||
      c.description?.toLowerCase().includes(query) ||
      c.address?.toLowerCase().includes(query) ||
      c.assignedWorkerName?.toLowerCase().includes(query) ||
      c.district_name?.toLowerCase().includes(query)
    );
  });

  // Calculate quick stats
  const criticalCount = escalatedList.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH').length;
  const uniqueDistricts = new Set(escalatedList.map((c) => c.district_id).filter(Boolean)).size;

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-error-container text-error px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
              <span className="material-symbols-outlined text-sm animate-pulse">crisis_alert</span>
              <span>High Priority Escalation Desk</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Escalated Civic Issues & SLA Breaches
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Complaints exceeding statutory resolution deadlines. Super Admin intervention required to reallocate, resolve, or extend.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSlaScan}
              disabled={scanning}
              className="px-4 py-2 bg-error hover:bg-error/90 text-white text-xs font-bold rounded-xl shadow-md shadow-error/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${scanning ? 'animate-spin' : ''}`}>
                sync
              </span>
              {scanning ? 'Scanning SLAs...' : 'Run SLA Breach Scan'}
            </button>
            <button
              type="button"
              onClick={fetchEscalated}
              className="p-2 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant border border-outline-variant/30 rounded-xl text-xs transition-colors shadow-sm"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="mb-6 p-4 rounded-xl bg-error-container/40 border border-error/30 text-error text-xs flex items-center justify-between animate-fade-in font-semibold">
            <span>{scanMessage}</span>
            <button type="button" onClick={() => setScanMessage('')} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="p-5 bg-surface-container-lowest rounded-2xl border border-error/30 civic-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-error"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Active Escalations</span>
              <span className="p-2 rounded-xl bg-error-container text-error material-symbols-outlined text-xl">
                warning
              </span>
            </div>
            <p className="text-3xl font-extrabold text-error">{escalatedList.length}</p>
            <p className="text-[11px] text-on-surface-variant mt-1 font-medium">Pending administrator action</p>
          </div>

          <div className="p-5 bg-surface-container-lowest rounded-2xl border border-amber-500/30 civic-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-amber-500"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Critical / High Severity</span>
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-700 material-symbols-outlined text-xl">
                priority_high
              </span>
            </div>
            <p className="text-3xl font-extrabold text-amber-600">{criticalCount}</p>
            <p className="text-[11px] text-on-surface-variant mt-1 font-medium">Requiring immediate dispatch</p>
          </div>

          <div className="p-5 bg-surface-container-lowest rounded-2xl border border-primary/30 civic-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-primary"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Districts Affected</span>
              <span className="p-2 rounded-xl bg-primary-fixed text-primary material-symbols-outlined text-xl">
                location_city
              </span>
            </div>
            <p className="text-3xl font-extrabold text-primary">{uniqueDistricts}</p>
            <p className="text-[11px] text-on-surface-variant mt-1 font-medium">Across Delhi NCT zones</p>
          </div>

          <div className="p-5 bg-surface-container-lowest rounded-2xl border border-secondary/30 civic-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-secondary"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">City Overview Link</span>
              <span className="p-2 rounded-xl bg-secondary-fixed/50 text-secondary material-symbols-outlined text-xl">
                analytics
              </span>
            </div>
            <Link
              to="/admin"
              className="text-xs font-extrabold text-secondary hover:underline flex items-center gap-1 mt-4"
            >
              <span>View Citywide Analytics</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
            <p className="text-[11px] text-on-surface-variant mt-1 font-medium">Return to geospatial dashboard</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 mb-6 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="flex-1 min-w-[220px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search by ID, keyword, address, worker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface placeholder:text-outline outline-none focus:border-primary"
            />
          </div>

          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="">All Districts</option>
            <option value="central_delhi">Central Delhi</option>
            <option value="new_delhi">New Delhi</option>
            <option value="south_delhi">South Delhi</option>
            <option value="north_west_delhi">North West Delhi</option>
            <option value="east_delhi">East Delhi</option>
            <option value="west_delhi">West Delhi</option>
            <option value="north_delhi">North Delhi</option>
            <option value="south_west_delhi">South West Delhi</option>
            <option value="shahdara">Shahdara</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="">All Categories</option>
            <option value="pothole">Pothole</option>
            <option value="broken_streetlight">Broken Streetlight</option>
            <option value="garbage">Garbage</option>
            <option value="drainage">Drainage</option>
            <option value="water_issue">Water Issue</option>
            <option value="public_property">Public Property</option>
            <option value="road_damage">Road Damage</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs text-on-surface font-semibold outline-none focus:border-primary"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {(selectedDistrict || selectedCategory || selectedPriority || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDistrict('');
                setSelectedCategory('');
                setSelectedPriority('');
                setSearchQuery('');
              }}
              className="px-3 py-2 text-xs font-bold text-primary hover:bg-primary-fixed/40 rounded-xl transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Escalations Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm civic-glow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-error border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant mt-4 font-semibold">Loading escalated civic issues...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-16 text-center">
              <span className="material-symbols-outlined text-secondary text-5xl mb-2">verified</span>
              <h3 className="text-base font-extrabold text-on-surface">Zero Escalations in Queue</h3>
              <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
                No civic complaints match the current filters or exceed statutory SLA deadlines across Delhi NCT.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/70 text-on-surface-variant font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ref ID</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assigned Worker</th>
                    <th className="py-3 px-4">Target Date</th>
                    <th className="py-3 px-4">Overdue Time</th>
                    <th className="py-3 px-4">Root Cause / Breach Reason</th>
                    <th className="py-3 px-4 text-right">Super Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredList.map((c) => (
                    <tr key={c.id || c.complaintId} className="hover:bg-error/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        #{c.complaintId || c.id?.slice(-6)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-on-surface capitalize">
                        {c.category?.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-on-surface-variant font-medium">
                        {c.district_name || c.district_id?.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          c.priority === 'CRITICAL'
                            ? 'bg-error text-white'
                            : c.priority === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-700'
                            : 'bg-primary-fixed text-primary'
                        }`}>
                          {c.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface font-medium">
                        {c.assignedWorkerName ? (
                          <span className="flex items-center gap-1 text-secondary font-bold">
                            <span className="material-symbols-outlined text-xs">engineering</span>
                            {c.assignedWorkerName}
                          </span>
                        ) : (
                          <span className="text-error font-semibold italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant font-medium">
                        {c.slaDeadline
                          ? new Date(c.slaDeadline).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Standard SLA'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-error text-white animate-pulse">
                          +{c.overdueHours || 'SLA'}h breached
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant max-w-xs truncate text-[11px]" title={c.escalationReason}>
                        {c.escalationReason || 'Resolution deadline exceeded without completion'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(c, 'REASSIGN')}
                            className="px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            title="Reallocate to another field worker"
                          >
                            <span className="material-symbols-outlined text-xs">person_add</span>
                            Reassign
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(c, 'FORCE_RESOLVE')}
                            className="px-2.5 py-1 bg-secondary/15 hover:bg-secondary text-secondary hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            title="Administrative force resolve"
                          >
                            <span className="material-symbols-outlined text-xs">check</span>
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(c, 'EXTEND_DEADLINE')}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-700 hover:text-white rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                            title="Extend resolution deadline"
                          >
                            <span className="material-symbols-outlined text-xs">update</span>
                            Extend
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(c, 'DISMISS')}
                            className="px-2 py-1 bg-surface-container-low hover:bg-error-container text-outline hover:text-error rounded-lg text-[11px] font-bold transition-all"
                            title="Dismiss / Reject"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Modal */}
        {selectedEscalated && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-error-container text-error material-symbols-outlined text-xl">
                    gavel
                  </span>
                  <h3 className="font-extrabold text-sm text-on-surface">
                    Super Admin Action: {actionType} #{selectedEscalated.complaintId}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEscalated(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl text-xs space-y-1">
                <p className="font-bold text-on-surface">
                  {selectedEscalated.category?.replace('_', ' ').toUpperCase()} • {selectedEscalated.district_name || selectedEscalated.district_id}
                </p>
                <p className="text-on-surface-variant">{selectedEscalated.address}</p>
                <p className="text-error font-semibold">
                  Escalation Reason: {selectedEscalated.escalationReason || 'Resolution deadline breached.'}
                </p>
              </div>

              <form onSubmit={handleConfirmEscalatedAction} className="space-y-4 text-xs">
                {actionType === 'REASSIGN' && (
                  <div>
                    <label className="block text-on-surface font-bold mb-1">Select New Replacement Field Worker</label>
                    <select
                      value={actionWorkerId}
                      onChange={(e) => setActionWorkerId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary"
                    >
                      <option value="">-- Choose field worker --</option>
                      {availableWorkers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.worker_tag || w.worker_id || 'Worker'}) • {w.district_id?.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-outline mt-1">Reassigning will automatically grant a 24-hour extension on SLA.</p>
                  </div>
                )}

                {actionType === 'EXTEND_DEADLINE' && (
                  <div>
                    <label className="block text-on-surface font-bold mb-1">Additional Extension Hours</label>
                    <select
                      value={actionHours}
                      onChange={(e) => setActionHours(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary"
                    >
                      <option value="12">+12 Hours Extension</option>
                      <option value="24">+24 Hours Extension (1 Day)</option>
                      <option value="48">+48 Hours Extension (2 Days)</option>
                      <option value="72">+72 Hours Extension (3 Days)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-on-surface font-bold mb-1">Administrative Note / Directives</label>
                  <textarea
                    rows={3}
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    required
                    placeholder={`Enter directives for ${actionType.toLowerCase()} action...`}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary resize-none font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setSelectedEscalated(null)}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionSubmitting}
                    className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                  >
                    {actionSubmitting ? 'Executing...' : `Execute ${actionType}`}
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

export default AdminEscalatedPage;
