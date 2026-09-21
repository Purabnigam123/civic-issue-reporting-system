import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';

const ZonalWorkersPage = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Worker@123',
    skills: 'Pothole repair, Drainage clearance',
  });
  const [saving, setSaving] = useState(false);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await zonalService.getWorkers();
      if (data && data.workers) {
        setWorkers(data.workers);
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const skillsArray = formData.skills.split(',').map((s) => s.trim()).filter(Boolean);
      await zonalService.createWorker({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        skills: skillsArray,
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: 'Worker@123',
        skills: 'Pothole repair, Drainage clearance',
      });
      fetchWorkers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create worker account');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (worker) => {
    const nextStatus = worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await zonalService.updateWorkerStatus(worker.id, nextStatus);
      fetchWorkers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update worker status');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <ZonalSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-4 border-b border-outline-variant/30">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">Field Operations Crew</h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
              Field personnel assigned to this zone for maintenance and municipal fixes
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Field Worker
          </button>
        </div>

        {/* Worker Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-on-surface-variant mt-3">Loading field crew roster...</p>
          </div>
        ) : workers.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-12 text-center max-w-md mx-auto civic-glow">
            <span className="material-symbols-outlined text-outline text-5xl mb-2">engineering</span>
            <p className="text-sm text-on-surface-variant font-bold mb-3">No field workers registered in this zone yet.</p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs rounded-xl font-bold transition-all shadow-sm"
            >
              Add First Worker
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workers.map((w) => (
              <div key={w.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 flex flex-col justify-between shadow-sm civic-glow">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary font-black text-base flex items-center justify-center shadow-sm border border-primary/20">
                        {(w.name || 'W')[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-on-surface text-sm">{w.name}</h3>
                        <span className="text-[11px] font-mono text-primary font-bold">{w.worker_id}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                      w.status === 'ACTIVE'
                        ? 'bg-secondary-container/40 text-secondary border-secondary/20'
                        : 'bg-surface-container-high text-outline border-outline-variant/30'
                    }`}>
                      {w.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-on-surface-variant font-medium mb-4">
                    <p className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-outline text-sm shrink-0">mail</span>
                      <span className="truncate">{w.email}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-sm shrink-0">call</span>
                      {w.phone || 'No phone'}
                    </p>
                  </div>

                  {w.skills && w.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {w.skills.map((skill, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-surface-container-low rounded-lg text-[10px] font-bold text-on-surface-variant border border-outline-variant/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-2 text-center text-xs mb-4">
                    <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/10">
                      <span className="text-outline text-[10px] block font-extrabold uppercase">Active Load</span>
                      <span className="text-lg font-black text-tertiary">{w.active_tasks || 0}</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/10">
                      <span className="text-outline text-[10px] block font-extrabold uppercase">Completed</span>
                      <span className="text-lg font-black text-secondary">{w.completed_tasks || 0}</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(w)}
                      className={`w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        w.status === 'ACTIVE'
                          ? 'border-error/30 text-error hover:bg-error-container/20'
                          : 'border-secondary/30 text-secondary hover:bg-secondary-container/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {w.status === 'ACTIVE' ? 'power_settings_new' : 'check'}
                      </span>
                      {w.status === 'ACTIVE' ? 'Deactivate Worker' : 'Activate Worker'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add Worker */}
        {showAddModal && (
          <div className="fixed inset-0 bg-scrim/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 text-on-surface shadow-2xl civic-glow animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/20">
                <h3 className="text-base font-extrabold text-on-surface">Create Field Worker Account</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateWorker} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Email (Login ID)</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh.field@civicpulse.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Initial Password</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-mono font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div>
                  <label className="block text-on-surface-variant font-bold mb-1">Skills (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Pothole repair, Streetlight wiring, Drainage clearance"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-medium outline-none focus:border-primary focus:bg-surface-container-lowest"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl text-on-surface-variant hover:bg-surface-container-low font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold disabled:opacity-50 transition-all shadow-sm"
                  >
                    {saving ? 'Creating...' : 'Create Worker'}
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

export default ZonalWorkersPage;
