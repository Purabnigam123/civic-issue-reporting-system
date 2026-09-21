import React, { useState } from 'react';
import { complaintService } from '../services/complaintService';

const TrackComplaintModal = ({ isOpen, onClose }) => {
  const [complaintIdInput, setComplaintIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanInput = complaintIdInput.trim().replace(/^[#\s]+/g, '');
    if (!cleanInput) {
      setError('Please enter a complaint reference number.');
      return;
    }

    setLoading(true);
    setError('');
    setComplaint(null);

    try {
      const res = await complaintService.trackComplaintPublic(cleanInput);
      const foundComplaint = res?.complaint || res?.data?.complaint;
      if (foundComplaint) {
        setComplaint(foundComplaint);
      } else {
        setError('No complaint found with this reference number.');
      }
    } catch (err) {
      console.error('Tracking error:', err);
      setError(err.response?.data?.message || 'No complaint found matching this reference ID.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300';
      case 'ASSIGNED':
      case 'UNDER_REVIEW':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';
      default:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-level-3 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest dark:bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">search</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">Track Complaint Status</h3>
              <p className="text-xs text-on-surface-variant">Check complaint status instantly without signing in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                Complaint Reference Number
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant/70 text-xl">
                  tag
                </span>
                <input
                  type="text"
                  placeholder="e.g. CIV-10012"
                  value={complaintIdInput}
                  onChange={(e) => setComplaintIdInput(e.target.value)}
                  className="w-full pl-11 pr-28 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface text-sm font-mono tracking-wide"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-xs font-medium hover:bg-primary-container transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      <span>Track</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="p-4 rounded-xl bg-error-container/30 border border-error/30 text-error flex items-center gap-3 text-sm">
              <span className="material-symbols-outlined shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Complaint Result Card */}
          {complaint && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-xs text-on-surface-variant font-mono">Reference Number</span>
                  <div className="font-headline-sm font-bold text-primary font-mono text-base">
                    {complaint.complaintId}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(
                    complaint.status
                  )}`}
                >
                  {complaint.status ? complaint.status.replace('_', ' ') : 'SUBMITTED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-on-surface-variant">Category:</span>
                  <p className="font-semibold text-on-surface capitalize">
                    {complaint.category ? complaint.category.replace('_', ' ') : 'Civic Issue'}
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Assigned Department:</span>
                  <p className="font-semibold text-on-surface">{complaint.department || 'Municipal Dept'}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Submitted Date:</span>
                  <p className="font-semibold text-on-surface">
                    {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Priority:</span>
                  <p className="font-semibold text-on-surface">{complaint.priority || 'MEDIUM'}</p>
                </div>
              </div>

              <div>
                <span className="text-xs text-on-surface-variant">Location:</span>
                <p className="text-xs font-medium text-on-surface flex items-start gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-error text-sm shrink-0">location_on</span>
                  {complaint.address}
                </p>
              </div>

              <div>
                <span className="text-xs text-on-surface-variant">Description:</span>
                <p className="text-xs text-on-surface bg-surface-container-low p-3 rounded-lg mt-1 italic">
                  "{complaint.description}"
                </p>
              </div>

              {/* Progress Timeline Indicator */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-on-surface-variant mb-3 block">Resolution Lifecycle</span>
                <div className="flex items-center justify-between text-center relative px-2">
                  <div className="absolute top-3 left-4 right-4 h-0.5 bg-outline-variant/30 -z-0"></div>
                  {['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].map((step, idx) => {
                    const statusOrder = ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];
                    const currentIdx = statusOrder.indexOf(complaint.status || 'SUBMITTED');
                    const isPassed = idx <= currentIdx;
                    return (
                      <div key={step} className="flex flex-col items-center z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isPassed ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {isPassed ? '✓' : idx + 1}
                        </div>
                        <span className="text-[10px] mt-1 text-on-surface-variant max-w-[50px] leading-tight">
                          {step.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest dark:bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackComplaintModal;
