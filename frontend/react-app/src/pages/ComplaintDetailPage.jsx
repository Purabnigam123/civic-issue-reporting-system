import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { complaintService } from '../services/complaintService';

const customPinIcon = L.divIcon({
  className: 'custom-civic-pin',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(0, 88, 190, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 34px; height: 34px; background: #0058be; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 38],
  popupAnchor: [0, -38],
});

const ComplaintDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upvoting, setUpvoting] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteMessage, setUpvoteMessage] = useState('');
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  const handleUpvote = async (providedPhone = '') => {
    const phoneToUse = providedPhone || phoneInput;
    if (!isAuthenticated && (!phoneToUse || phoneToUse.trim().length < 8)) {
      setPhonePrompt(true);
      return;
    }

    setUpvoting(true);
    try {
      const targetId = complaint?.complaintId || id;
      const res = await complaintService.upvoteComplaint(targetId, isAuthenticated ? '' : phoneToUse);
      if (res && res.success) {
        setComplaint((prev) => (prev ? { ...prev, upvotes: res.upvotes } : prev));
        setUpvoted(true);
        setPhonePrompt(false);
        setUpvoteMessage(
          res.alreadyUpvoted
            ? 'You have already upvoted this complaint.'
            : 'Upvoted successfully! Thank you for validating this issue.'
        );
      }
    } catch (err) {
      setUpvoteMessage(err.response?.data?.detail || 'Failed to upvote complaint.');
    } finally {
      setUpvoting(false);
    }
  };

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await complaintService.getComplaintById(id);
        setComplaint(data.complaint);
      } catch (err) {
        console.error('Fetch complaint detail error:', err);
        setError('Complaint not found or you do not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDetail();
    }
  }, [id]);

  const getUploadUrl = (filename) => {
    const baseUrl = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';
    return `${baseUrl}/${filename}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusSteps = [
    { key: 'SUBMITTED', label: 'Submitted', desc: 'Complaint logged in civic register' },
    { key: 'UNDER_REVIEW', label: 'Under Review', desc: 'Engineering team reviewing report' },
    { key: 'ASSIGNED', label: 'Assigned', desc: 'Dispatched to field maintenance crew' },
    { key: 'IN_PROGRESS', label: 'In Progress', desc: 'Repair work actively ongoing' },
    { key: 'RESOLVED', label: 'Resolved', desc: 'Issue inspected & closure verified' },
  ];

  const getStatusIndex = (status) => {
    const normalized = (status || '').toUpperCase();
    switch (normalized) {
      case 'SUBMITTED':
        return 0;
      case 'UNDER_REVIEW':
        return 1;
      case 'ASSIGNED':
        return 2;
      case 'IN_PROGRESS':
        return 3;
      case 'RESOLVED':
        return 4;
      default:
        return 0;
    }
  };

  const resolutionEvidence = complaint?.status_history
    ?.slice()
    ?.reverse()
    ?.find((h) => h.evidence && (h.evidence.images?.length > 0 || h.evidence.notes))?.evidence;

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen pt-20 pb-24 md:pb-12">
      <DashboardNavbar />

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/complaints')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Complaints Archive
          </button>
        </div>

        {error && (
          <div className="p-6 bg-error-container/30 border border-error/30 text-error rounded-2xl mb-8 flex items-start gap-4">
            <span className="material-symbols-outlined text-2xl">error</span>
            <div>
              <h3 className="font-bold text-base mb-1">Error Loading Report</h3>
              <p className="text-sm">{error}</p>
              <Link to="/complaints" className="inline-block mt-3 px-4 py-2 bg-error text-white text-xs rounded-lg font-bold">
                Return to Archive
              </Link>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="font-label-md text-on-surface-variant mt-4">Loading complaint details...</p>
          </div>
        ) : complaint ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Complaint Details & Timeline */}
            <div className="lg:col-span-8 space-y-6">
              {/* Header Card */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div>
                    <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1 block">
                      #{complaint.complaintId}
                    </span>
                    <h1 className="font-headline-md md:font-headline-lg text-on-surface font-bold capitalize">
                      {complaint.category.replace('_', ' ')}
                    </h1>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={complaint.status} />
                    <span className="px-3 py-1 bg-surface-container-high text-xs font-bold uppercase rounded-full">
                      Priority: {complaint.priority}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpvote()}
                      disabled={upvoting || upvoted}
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                        upvoted
                          ? "bg-emerald-600 text-white cursor-default"
                          : "bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container active:scale-95"
                      } disabled:opacity-80`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {upvoted ? "check_circle" : "thumb_up"}
                      </span>
                      {upvoting
                        ? "Upvoting..."
                        : upvoted
                        ? `Upvoted (${complaint.upvotes || 0})`
                        : `Upvote (${complaint.upvotes || 0})`}
                    </button>
                  </div>
                </div>

                {upvoteMessage && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                    <span>{upvoteMessage}</span>
                    <button type="button" onClick={() => setUpvoteMessage('')} className="font-bold ml-2">✕</button>
                  </div>
                )}

                {phonePrompt && (
                  <div className="mb-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2">
                    <p className="text-xs font-semibold text-on-surface">Enter your phone number to upvote anonymously:</p>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="10-digit phone number"
                        className="px-3 py-1.5 text-xs rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface outline-none focus:border-primary flex-1 max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpvote(phoneInput)}
                        disabled={upvoting || phoneInput.trim().length < 8}
                        className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        Confirm Upvote
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhonePrompt(false)}
                        className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <p className="text-xs text-outline">Filed on {formatDate(complaint.createdAt)}</p>
                  {complaint.slaDeadline && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                      complaint.slaStatus === 'BREACHED' ? 'bg-error/15 text-error border border-error/30' :
                      complaint.slaStatus === 'AT_RISK' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                      complaint.slaStatus === 'RESOLVED_ON_TIME' ? 'bg-secondary/15 text-secondary border border-secondary/30' :
                      'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">timer</span>
                      SLA: {complaint.slaStatus || 'ON_TRACK'} ({complaint.slaHours || 48}h target)
                    </span>
                  )}
                </div>

                {/* AI Vision Analysis Detection Card */}
                {(complaint.aiCategory || (complaint.aiConfidence && complaint.aiConfidence > 0)) && (
                  <div className="p-4 bg-surface-container-low rounded-xl mb-6 border border-outline-variant/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
                        <span className="text-xs font-bold text-on-surface">AI Computer Vision Analysis</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        complaint.aiSeverity === 'CRITICAL' ? 'bg-error-container text-on-error-container' :
                        complaint.aiSeverity === 'HIGH' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {complaint.aiSeverity || (complaint.aiVerified ? 'VERIFIED' : 'PENDING')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                      <span className="text-on-surface-variant">
                        Detected: <b className="text-on-surface">{complaint.aiCategory || complaint.category}</b>
                      </span>
                      <span className="text-primary font-bold">{Math.round((complaint.aiConfidence || 0) * 100)}% Confidence</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((complaint.aiConfidence || 0) * 100)}%` }}
                      ></div>
                    </div>
                    {complaint.aiMessage && (
                      <p className="text-[11px] text-outline mt-2 italic">{complaint.aiMessage}</p>
                    )}
                  </div>
                )}

                <div className="p-4 bg-surface-container-low rounded-xl mb-6">
                  <h3 className="text-xs font-bold text-outline uppercase tracking-wider mb-2">Description</h3>
                  <p className="font-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                    {complaint.description}
                  </p>
                </div>

                {/* District & Department Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 bg-primary-fixed/30 rounded-xl border border-primary-fixed-dim/40">
                    <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
                    <div>
                      <p className="text-xs font-bold text-on-primary-fixed-variant uppercase">Assigned Authority</p>
                      <p className="font-headline-sm text-sm font-bold text-on-surface">{complaint.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-secondary-fixed/30 rounded-xl border border-secondary-fixed-dim/40">
                    <span className="material-symbols-outlined text-secondary text-2xl">location_city</span>
                    <div>
                      <p className="text-xs font-bold text-on-secondary-fixed-variant uppercase">Municipal District</p>
                      <p className="font-headline-sm text-sm font-bold text-on-surface">{complaint.district_name || 'Central Delhi'}</p>
                    </div>
                  </div>
                </div>

                {/* Citizen Verification Action Banner when RESOLVED */}
                {complaint.status === 'RESOLVED' && (
                  <div className="p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl mb-6">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-amber-500 text-2xl">verified_user</span>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-on-surface mb-1">Worker Marked This Issue as Resolved</h4>
                        <p className="text-xs text-on-surface-variant mb-4">
                          Please verify if the repair work has been completed satisfactorily at the location.
                        </p>
                        <div className="flex gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const targetId = complaint?.complaintId || id;
                                const res = await complaintService.updateStatus(targetId, {
                                  status: 'VERIFIED',
                                  comment: 'Citizen confirmed satisfactory resolution.',
                                });
                                setComplaint(res.complaint);
                              } catch (err) {
                                alert(err.response?.data?.detail || 'Failed to verify');
                              }
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Confirm & Close Issue
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const reason = prompt('Please explain why the issue is not resolved:');
                              if (!reason) return;
                              try {
                                const targetId = complaint?.complaintId || id;
                                const res = await complaintService.updateStatus(targetId, {
                                  status: 'REOPENED',
                                  comment: reason,
                                });
                                setComplaint(res.complaint);
                              } catch (err) {
                                alert(err.response?.data?.detail || 'Failed to reopen');
                              }
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">replay</span>
                            Not Fixed (Reopen)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Photo Evidence */}
              {complaint.images && complaint.images.length > 0 && (
                <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                  <h3 className="font-headline-sm text-on-surface font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">photo_library</span>
                    Photo Evidence ({complaint.images.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {complaint.images.map((imgName, index) => (
                      <a
                        key={index}
                        href={getUploadUrl(imgName)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl overflow-hidden border border-outline-variant/30 h-48 block group relative"
                      >
                        <img
                          src={getUploadUrl(imgName)}
                          alt={`Evidence ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <span className="material-symbols-outlined">zoom_in</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Field Crew Resolution Evidence */}
              {resolutionEvidence && (
                <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-secondary/30 civic-glow">
                  <div className="flex items-center gap-2 mb-4 text-secondary">
                    <span className="material-symbols-outlined text-2xl">task_alt</span>
                    <h3 className="font-headline-sm text-on-surface font-bold">Field Crew Resolution Evidence</h3>
                  </div>

                  {resolutionEvidence.notes && (
                    <div className="p-4 bg-surface-container-low rounded-xl mb-4 border border-outline-variant/20">
                      <span className="text-[11px] font-bold text-outline uppercase block mb-1">Worker Notes</span>
                      <p className="text-xs text-on-surface leading-relaxed font-medium">{resolutionEvidence.notes}</p>
                    </div>
                  )}

                  {resolutionEvidence.images && resolutionEvidence.images.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {resolutionEvidence.images.map((imgName, index) => (
                        <a
                          key={index}
                          href={getUploadUrl(imgName)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl overflow-hidden border border-outline-variant/30 h-44 block group relative"
                        >
                          <img
                            src={getUploadUrl(imgName)}
                            alt={`Resolution Proof ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">zoom_in</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {resolutionEvidence.aiVerification && (
                    <div className="p-3 bg-secondary-container/30 border border-secondary/20 rounded-xl flex items-center justify-between text-xs text-secondary font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">verified</span>
                        AI Resolution Verified
                      </span>
                      <span>
                        Match Score: {Math.round((resolutionEvidence.aiVerification.resolutionScore || 0.9) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Status Progression Timeline & Detailed Audit History */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 border border-outline-variant/30 civic-glow">
                <h3 className="font-headline-sm text-on-surface font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">timeline</span>
                  Resolution Progression Timeline
                </h3>

                <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
                  {statusSteps.map((step, index) => {
                    const activeIndex = getStatusIndex(complaint.status);
                    const isCompleted = index <= activeIndex;
                    const isCurrent = index === activeIndex;

                    return (
                      <div key={step.key} className="relative flex items-start gap-4">
                        <div
                          className={`absolute -left-[30px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-surface-container-lowest ${
                            isCurrent
                              ? 'bg-primary text-on-primary animate-pulse'
                              : isCompleted
                              ? 'bg-secondary text-on-secondary'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        <div>
                          <h4
                            className={`font-label-md text-sm font-bold ${
                              isCurrent ? 'text-primary' : isCompleted ? 'text-on-surface' : 'text-outline'
                            }`}
                          >
                            {step.label}
                          </h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Audit Status History Log */}
                {complaint.status_history && complaint.status_history.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-outline-variant/30">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-outline mb-4">Official Activity Log</h4>
                    <div className="space-y-3">
                      {complaint.status_history.map((entry, idx) => (
                        <div key={idx} className="p-3 bg-surface-container-low rounded-xl flex items-start justify-between gap-3 text-xs">
                          <div>
                            <span className="font-bold text-on-surface">{entry.to_status}</span>
                            {entry.comment && <p className="text-on-surface-variant mt-0.5">{entry.comment}</p>}
                            <span className="text-[11px] text-outline mt-1 block">
                              By {entry.changed_by_name || 'System'} ({entry.changed_by_role || 'CITIZEN'})
                            </span>
                          </div>
                          <span className="text-[11px] text-outline whitespace-nowrap">
                            {formatDate(entry.changed_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Location Map & Metadata */}
            <div className="lg:col-span-4 space-y-6">
              {/* Geolocation Card */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <h3 className="font-headline-sm text-on-surface font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  Geotagged Location
                </h3>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">{complaint.address}</p>

                {/* Mini Leaflet Map */}
                <div className="w-full h-56 rounded-xl overflow-hidden border border-outline-variant/30 mb-4 z-0">
                  <MapContainer
                    center={[complaint.latitude, complaint.longitude]}
                    zoom={15}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[complaint.latitude, complaint.longitude]} icon={customPinIcon}>
                      <Popup>{complaint.address}</Popup>
                    </Marker>
                  </MapContainer>
                </div>

                <div className="text-xs text-outline space-y-1">
                  <p>
                    <strong>Latitude:</strong> {complaint.latitude}
                  </p>
                  <p>
                    <strong>Longitude:</strong> {complaint.longitude}
                  </p>
                </div>
              </div>

              {/* Quick Action Card */}
              <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/20">
                <h4 className="font-bold text-on-surface text-sm mb-2">Need to report another issue?</h4>
                <p className="text-xs text-on-surface-variant mb-4">
                  Log other neighborhood road, lighting, or sanitation hazards in just 2 minutes.
                </p>
                <Link
                  to="/report"
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-container shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Report New Issue
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ComplaintDetailPage;
