import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { adminService } from '../../services/adminService';

const AdminSuspiciousPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actioningId, setActioningId] = useState(null);

  const fetchSuspicious = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSuspicious({ page, limit: 12 });
      if (data && data.complaints) {
        setItems(data.complaints);
        setTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load suspicious queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuspicious();
  }, [page]);

  const handleVerify = async (complaintId) => {
    try {
      setActioningId(complaintId);
      await adminService.verifySuspicious(complaintId);
      fetchSuspicious();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to verify complaint');
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (complaintId) => {
    const reason = prompt('Reason for dismissal / spam rejection:');
    if (!reason) return;

    try {
      setActioningId(complaintId);
      await adminService.dismissSuspicious(complaintId, reason);
      fetchSuspicious();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to dismiss complaint');
    } finally {
      setActioningId(null);
    }
  };

  const getUploadUrl = (filename) => {
    const baseUrl = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';
    return `${baseUrl}/${filename}`;
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-tertiary-fixed/60 text-on-tertiary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
            <span className="material-symbols-outlined text-tertiary text-sm">shield</span>
            <span>Automated Anti-Spam Integrity System</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
            Suspicious & Anomaly Queue
          </h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
            Complaints flagged by automated anti-spam algorithms, bounding checks, or rapid-submission frequency
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-tertiary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-on-surface-variant mt-4 font-semibold">Analyzing suspicious reports...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-12 text-center max-w-lg mx-auto civic-glow">
            <span className="material-symbols-outlined text-secondary text-5xl mb-3">verified</span>
            <h3 className="text-lg font-bold text-on-surface mb-1">Queue Clear</h3>
            <p className="text-xs text-on-surface-variant">No unverified suspicious or fraudulent complaints at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id || item.complaintId}
                className="bg-surface-container-lowest rounded-2xl border border-tertiary-fixed-dim/60 overflow-hidden flex flex-col justify-between shadow-level-1 civic-glow"
              >
                <div>
                  {/* Photo thumbnail */}
                  <div className="h-44 bg-surface-container-low relative">
                    {item.images && item.images[0] ? (
                      <img
                        src={getUploadUrl(item.images[0])}
                        alt="Evidence"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline text-xs">
                        No Image Available
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant font-extrabold text-[11px] rounded-lg shadow-sm border border-tertiary/20">
                      Score: {item.suspiciousScore ? Math.round(item.suspiciousScore * 100) : 50}%
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-primary font-bold">#{item.complaintId}</span>
                      <span className="text-[11px] uppercase font-bold text-on-surface-variant">{item.category?.replace('_', ' ')}</span>
                    </div>

                    <p className="text-xs text-on-surface line-clamp-3 mb-4 leading-relaxed font-medium">
                      {item.description}
                    </p>

                    {/* Reasons list */}
                    <div className="space-y-1 mb-4 p-3 bg-tertiary-fixed/20 rounded-xl border border-tertiary-fixed-dim/40">
                      <span className="text-[10px] font-bold uppercase text-tertiary block tracking-wider">Flagged Reasons:</span>
                      {item.suspiciousReasons?.map((reason, idx) => (
                        <div key={idx} className="text-[11px] text-on-surface-variant flex items-start gap-1 font-medium">
                          <span>•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-on-surface-variant">
                      <strong className="text-on-surface">Location:</strong> {item.address}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-surface-container-low border-t border-outline-variant/20 flex gap-2">
                  <button
                    type="button"
                    disabled={actioningId === (item.id || item.complaintId)}
                    onClick={() => handleVerify(item.id || item.complaintId)}
                    className="flex-1 py-2 bg-secondary hover:bg-on-secondary-container text-on-secondary rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    Mark Genuine
                  </button>
                  <button
                    type="button"
                    disabled={actioningId === (item.id || item.complaintId)}
                    onClick={() => handleDismiss(item.id || item.complaintId)}
                    className="flex-1 py-2 bg-error hover:bg-error/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Dismiss Spam
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminSuspiciousPage;
