import React, { useState, useEffect } from 'react';
import WorkerNavbar from '../../components/worker/WorkerNavbar';
import { workerService } from '../../services/workerService';
import StatusBadge from '../../components/ui/StatusBadge';

const WorkerDashboardPage = () => {
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');

  const [resolveTaskObj, setResolveTaskObj] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [proofFiles, setProofFiles] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [actionTaskId, setActionTaskId] = useState(null);

  const [stats, setStats] = useState(null);

  const fetchTasksAndProfile = async () => {
    try {
      setLoading(true);
      const [tasksRes, profileRes, statsRes] = await Promise.all([
        workerService.getTasks(activeFilter === 'ALL' ? '' : activeFilter),
        workerService.getProfile().catch(() => null),
        workerService.getStats().catch(() => null),
      ]);

      if (tasksRes && tasksRes.tasks) {
        setTasks(tasksRes.tasks);
      }
      if (profileRes) {
        setProfile(profileRes);
      }
      if (statsRes && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error('Failed to load worker tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndProfile();
  }, [activeFilter]);

  const handleStartWork = async (taskId) => {
    try {
      setActionTaskId(taskId);
      await workerService.startTask(taskId, 'Field worker arrived and started repairs');
      fetchTasksAndProfile();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start work');
    } finally {
      setActionTaskId(null);
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveTaskObj) return;

    try {
      setResolving(true);
      const formData = new FormData();
      formData.append('notes', proofNotes || 'Repairs completed and site cleared');
      if (proofFiles && proofFiles.length > 0) {
        for (let i = 0; i < proofFiles.length; i++) {
          formData.append('files', proofFiles[i]);
        }
      }

      await workerService.resolveTask(resolveTaskObj.id || resolveTaskObj.complaintId, formData);
      setResolveTaskObj(null);
      setProofNotes('');
      setProofFiles([]);
      fetchTasksAndProfile();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit resolution proof');
    } finally {
      setResolving(false);
    }
  };

  const getUploadUrl = (filename) => {
    const baseUrl = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';
    return `${baseUrl}/${filename}`;
  };

  const displayStats = stats || profile?.stats || {
    total_assigned: 0,
    in_progress: 0,
    resolved_today: 0,
    overdue_count: 0,
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md antialiased pb-16">
      <WorkerNavbar />

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Profile / Stats Header - 4 Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm civic-glow text-center">
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-outline font-extrabold uppercase block tracking-wider">To Do</span>
            <span className="text-xl font-black text-tertiary">{displayStats.total_assigned ?? 0}</span>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-outline font-extrabold uppercase block tracking-wider">Active</span>
            <span className="text-xl font-black text-primary">{displayStats.in_progress ?? 0}</span>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-outline font-extrabold uppercase block tracking-wider">Resolved</span>
            <span className="text-xl font-black text-secondary">{displayStats.resolved_today ?? displayStats.resolved ?? 0}</span>
          </div>
          <div className={`p-3 rounded-xl border transition-all ${
            (displayStats.overdue_count || 0) > 0
              ? 'bg-error-container/40 border-error/40 text-error'
              : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant'
          }`}>
            <span className="text-[10px] font-extrabold uppercase block tracking-wider opacity-80">Overdue</span>
            <span className="text-xl font-black flex items-center justify-center gap-1">
              {(displayStats.overdue_count || 0) > 0 && (
                <span className="material-symbols-outlined text-sm animate-pulse text-error">warning</span>
              )}
              {displayStats.overdue_count ?? 0}
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'ALL', label: 'All Jobs' },
            { key: 'ASSIGNED', label: 'To Do (New)' },
            { key: 'IN_PROGRESS', label: 'Active Repairs' },
            { key: 'RESOLVED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                activeFilter === tab.key
                  ? 'bg-primary text-on-primary shadow-primary/20'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container-low border border-outline-variant/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-on-surface-variant mt-3">Fetching assigned jobs...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-12 text-center civic-glow">
            <span className="material-symbols-outlined text-outline text-5xl mb-2">done_all</span>
            <p className="text-sm font-extrabold text-on-surface">No jobs in this category</p>
            <p className="text-xs text-outline mt-1 font-medium">All assigned repairs are up to date!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id || task.complaintId}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 space-y-4 shadow-sm civic-glow hover:border-primary/40 transition-all"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold text-primary">#{task.complaintId}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        task.priority === 'CRITICAL' ? 'bg-error-container text-on-error-container' :
                        task.priority === 'HIGH' ? 'bg-tertiary-container/50 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant'
                      }`}>
                        {task.priority}
                      </span>

                      {/* SLA Countdown Chip */}
                      {task.isOverdue ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-error/15 text-error border border-error/30 flex items-center gap-1 animate-pulse">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          BREACHED ({Math.abs(task.slaRemainingHours || 0)}h overdue)
                        </span>
                      ) : task.slaRemainingHours !== null && task.slaRemainingHours !== undefined ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          task.slaRemainingHours < 6
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          {task.slaRemainingHours}h left
                        </span>
                      ) : null}
                    </div>
                    <h3 className="font-extrabold text-base text-on-surface capitalize">
                      {task.category?.replace('_', ' ')}
                    </h3>
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                {/* Description */}
                <p className="text-xs text-on-surface-variant leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/20 font-medium">
                  {task.description}
                </p>

                {/* Photos if any */}
                {task.images && task.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {task.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={getUploadUrl(img)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-outline-variant/30 shadow-sm"
                      >
                        <img src={getUploadUrl(img)} alt="Issue" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Address & GPS Navigation link */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <p className="text-on-surface-variant max-w-[240px] truncate flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-outline text-sm">location_on</span>
                    {task.address}
                  </p>
                  {task.latitude && task.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:text-primary-container font-bold flex items-center gap-1 text-[11px]"
                    >
                      <span className="material-symbols-outlined text-sm">directions</span>
                      Navigate
                    </a>
                  )}
                </div>

                {/* Actions depending on state */}
                <div className="pt-3 border-t border-outline-variant/20 flex gap-2">
                  {task.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      disabled={actionTaskId === (task.id || task.complaintId)}
                      onClick={() => handleStartWork(task.id || task.complaintId)}
                      className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">play_arrow</span>
                      {actionTaskId === (task.id || task.complaintId) ? 'Starting...' : 'Start Job (Arrived)'}
                    </button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => setResolveTaskObj(task)}
                      className="w-full py-2.5 bg-secondary hover:bg-secondary-container hover:text-on-secondary-container text-on-secondary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-base">add_a_photo</span>
                      Submit Fix & Proof Photo
                    </button>
                  )}

                  {(task.status === 'RESOLVED' || task.status === 'VERIFIED') && (
                    <div className="w-full py-2 bg-secondary-container/40 border border-secondary/30 text-secondary text-center rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-base">verified</span>
                      Completed & Submitted
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Resolve with photo proof */}
        {resolveTaskObj && (
          <div className="fixed inset-0 bg-scrim/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 text-on-surface shadow-2xl civic-glow animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-[10px] text-primary font-extrabold uppercase block tracking-wider">Resolution Submission</span>
                  <h3 className="text-base font-extrabold text-on-surface mt-0.5">Complete Job #{resolveTaskObj.complaintId}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResolveTaskObj(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-on-surface-variant font-bold mb-1.5">Upload After-Fix Photo Proof</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => setProofFiles(e.target.files)}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-on-primary shadow-sm"
                  />
                  <p className="text-[11px] text-outline mt-1 font-medium">Take a live photo of the repaired site</p>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1.5">Work Summary / Repair Notes</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Cleared drain blockage with suction pipe; water flow restored."
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    className="w-full p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResolveTaskObj(null)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resolving}
                    className="px-4 py-2 bg-secondary hover:bg-secondary-container hover:text-on-secondary-container text-on-secondary rounded-xl font-bold disabled:opacity-50 flex items-center gap-1 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">task_alt</span>
                    {resolving ? 'Uploading Proof...' : 'Complete & Mark Fixed'}
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

export default WorkerDashboardPage;
