import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';
import StatusBadge from '../../components/ui/StatusBadge';

const ZonalVerificationsPage = () => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submittingId, setSubmittingId] = useState(null);
  const [reviewModalObj, setReviewModalObj] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // 'approve' | 'reject'
  const [reviewNote, setReviewNote] = useState('');
  const [fullImageModal, setFullImageModal] = useState(null);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const res = await zonalService.getVerifications({ page, limit: 12 });
      if (res && res.verifications) {
        setVerifications(res.verifications);
        setTotalPages(res.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load verifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [page]);

  const handleOpenReview = (item, action) => {
    setReviewModalObj(item);
    setReviewAction(action);
    setReviewNote(action === 'approve' ? 'Work inspected and resolution verified.' : 'Resolution proof insufficient. Please revisit site.');
  };

  const handleConfirmReview = async (e) => {
    e.preventDefault();
    if (!reviewModalObj) return;

    const cid = reviewModalObj.id || reviewModalObj.complaintId;
    try {
      setSubmittingId(cid);
      await zonalService.verifyResolution(cid, {
        approved: reviewAction === 'approve',
        comment: reviewNote,
      });
      setReviewModalObj(null);
      fetchVerifications();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit verification review');
    } finally {
      setSubmittingId(null);
    }
  };

  const getUploadUrl = (filename) => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    const baseUrl = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';
    return `${baseUrl}/${filename}`;
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <ZonalSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full font-label-sm text-xs font-bold mb-1.5 border border-amber-500/20">
              <span className="material-symbols-outlined text-sm">verified</span>
              Quality Assurance & District Verification
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
              Work Completion Verifications
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
              Inspect before & after proof uploaded by field workers. Once verified, the status will update to <span className="font-bold text-secondary">RESOLVED</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchVerifications}
            className="p-2.5 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant hover:text-primary rounded-xl text-xs font-semibold transition-all border border-outline-variant/30 shadow-sm flex items-center gap-1.5"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-on-surface-variant mt-3">Loading completed submissions...</p>
          </div>
        ) : verifications.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-16 text-center shadow-sm civic-glow">
            <div className="w-16 h-16 rounded-full bg-secondary-container/30 text-secondary mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <h3 className="text-base font-extrabold text-on-surface">All Clear! No Pending Verifications</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
              When field workers complete assignments and upload their after-fix photos, they will appear here for District Officer review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {verifications.map((item) => {
              const evidence = item.resolutionEvidence || {};
              const proofImages = evidence.images || [];
              const beforeImages = item.images || [];
              const aiCheck = evidence.aiVerification;

              return (
                <div
                  key={item.id || item.complaintId}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 space-y-4 shadow-sm civic-glow relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 h-1 w-full bg-amber-500"></div>

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-primary">#{item.complaintId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.priority === 'CRITICAL' ? 'bg-error-container text-on-error-container' :
                          item.priority === 'HIGH' ? 'bg-tertiary-container/50 text-tertiary' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {item.priority}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <h3 className="font-extrabold text-base text-on-surface capitalize">
                        {item.category?.replace('_', ' ')}
                      </h3>
                    </div>

                    <div className="text-right text-[11px] text-on-surface-variant">
                      <span className="font-bold text-secondary flex items-center justify-end gap-1">
                        <span className="material-symbols-outlined text-sm">engineering</span>
                        {item.assignedWorkerName || evidence.resolved_by_worker || 'Field Worker'}
                      </span>
                      {evidence.resolved_at && (
                        <span className="text-outline block text-[10px]">
                          {new Date(evidence.resolved_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location & Issue description */}
                  <div className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-xl border border-outline-variant/20 space-y-1">
                    <p className="flex items-center gap-1 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                      {item.address}
                    </p>
                    <p className="text-[11px] text-outline font-medium line-clamp-2">
                      <span className="font-bold text-on-surface">Issue: </span>
                      {item.description}
                    </p>
                  </div>

                  {/* Before vs After Photos (Side by Side) */}
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-outline block mb-2">
                      Evidence Comparison (Before vs After)
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Before Photo */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-outline uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Reported (Before)
                        </span>
                        <div className="h-32 rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low relative group">
                          {beforeImages[0] ? (
                            <img
                              src={getUploadUrl(beforeImages[0])}
                              alt="Before"
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                              onClick={() => setFullImageModal(getUploadUrl(beforeImages[0]))}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline text-[11px]">
                              No before photo
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 bg-scrim/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                            Click to zoom
                          </span>
                        </div>
                      </div>

                      {/* After Photo (Proof) */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-secondary uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Worker Proof (After)
                        </span>
                        <div className="h-32 rounded-xl overflow-hidden border border-secondary/40 bg-surface-container-low relative group">
                          {proofImages[0] ? (
                            <img
                              src={getUploadUrl(proofImages[0])}
                              alt="After Fix"
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                              onClick={() => setFullImageModal(getUploadUrl(proofImages[0]))}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline text-[11px]">
                              No proof uploaded
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 bg-scrim/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                            Click to zoom
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Worker notes */}
                  {evidence.notes && (
                    <div className="p-3 bg-primary-fixed/20 border border-primary/20 rounded-xl text-xs">
                      <span className="font-bold text-primary block text-[10px] uppercase tracking-wider mb-0.5">
                        Worker Completion Note
                      </span>
                      <p className="text-on-surface font-medium">{evidence.notes}</p>
                    </div>
                  )}

                  {/* AI Vision Resolution Verification result */}
                  {aiCheck && (
                    <div className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-base">smart_toy</span>
                        <span className="font-bold text-on-surface text-[11px]">AI Vision Analysis</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        aiCheck.verified ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary'
                      }`}>
                        {aiCheck.verified ? 'AI Match: Repaired' : 'Manual Review Advised'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-outline-variant/20 flex gap-2">
                    <button
                      type="button"
                      disabled={submittingId === (item.id || item.complaintId)}
                      onClick={() => handleOpenReview(item, 'approve')}
                      className="flex-1 py-2.5 bg-secondary hover:bg-secondary-container text-on-secondary hover:text-on-secondary-container rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Verify & Approve (RESOLVED)
                    </button>

                    <button
                      type="button"
                      disabled={submittingId === (item.id || item.complaintId)}
                      onClick={() => handleOpenReview(item, 'reject')}
                      className="py-2.5 px-4 bg-surface-container-low hover:bg-error-container text-outline hover:text-error border border-outline-variant/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                      title="Request Rework"
                    >
                      <span className="material-symbols-outlined text-base">replay</span>
                      <span>Rework</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex justify-between items-center text-xs text-on-surface-variant font-medium">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low text-on-surface rounded-xl font-bold disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low text-on-surface rounded-xl font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Modal: Confirm Approval or Rejection */}
        {reviewModalObj && (
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 text-on-surface shadow-2xl civic-glow animate-fade-in space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-xl ${reviewAction === 'approve' ? 'text-secondary' : 'text-error'}`}>
                    {reviewAction === 'approve' ? 'verified' : 'published_with_changes'}
                  </span>
                  <h3 className="text-base font-extrabold text-on-surface">
                    {reviewAction === 'approve' ? 'Approve & Mark Resolved' : 'Request Rework from Worker'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModalObj(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <p className="text-xs text-on-surface-variant font-medium">
                {reviewAction === 'approve'
                  ? `You are confirming that complaint #${reviewModalObj.complaintId} has been successfully resolved based on the uploaded proof. Status will update to RESOLVED.`
                  : `You are requesting rework on complaint #${reviewModalObj.complaintId}. The complaint status will return to IN_PROGRESS for the worker.`
                }
              </p>

              <form onSubmit={handleConfirmReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-on-surface font-bold mb-1">
                    {reviewAction === 'approve' ? 'Officer Verification Note' : 'Rework Reason / Guidance'}
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    required
                    placeholder="Enter review notes..."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary resize-none font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setReviewModalObj(null)}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingId !== null}
                    className={`px-4 py-2 rounded-xl font-bold text-white shadow-sm transition-all ${
                      reviewAction === 'approve'
                        ? 'bg-secondary hover:bg-secondary-container hover:text-on-secondary-container'
                        : 'bg-error hover:bg-error/90'
                    }`}
                  >
                    {submittingId ? 'Processing...' : reviewAction === 'approve' ? 'Confirm & Mark RESOLVED' : 'Send for Rework'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Full Image Lightbox */}
        {fullImageModal && (
          <div 
            className="fixed inset-0 bg-scrim/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setFullImageModal(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setFullImageModal(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black font-bold"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <img src={fullImageModal} alt="Enlarged" className="w-full max-h-[85vh] object-contain rounded-xl" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ZonalVerificationsPage;
