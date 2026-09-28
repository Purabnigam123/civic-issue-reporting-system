import React, { useState, useEffect, useCallback } from "react";
import { complaintService } from "../services/complaintService";

// ─── helpers ──────────────────────────────────────────────────────────────────

const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL || "http://localhost:5000/uploads";

const getUploadUrl = (filename) =>
  filename ? `${UPLOAD_BASE}/${filename}` : null;

const formatRelativeTime = (isoStr) => {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} second${s !== 1 ? "s" : ""} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? "s" : ""} ago`;
};

const formatDate = (isoStr) => {
  if (!isoStr) return "N/A";
  return new Date(isoStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Returns a label and colour class for the confirmation count */
const confirmationLabel = (count) => {
  if (count >= 10)
    return { label: "Strongly Confirmed", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (count >= 3)
    return { label: "Community Confirmed", cls: "text-blue-700 bg-blue-50 border-blue-200" };
  return { label: "Few Confirmations", cls: "text-amber-700 bg-amber-50 border-amber-200" };
};

const PRIORITY_COLOURS = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLOURS = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  ASSIGNED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  VERIFIED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ESCALATED: "bg-rose-100 text-rose-700",
  REOPENED: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

const CATEGORY_LABELS = {
  pothole: "Pothole",
  broken_streetlight: "Broken Streetlight",
  garbage: "Garbage / Waste",
  drainage: "Drainage & Sewage",
  water_issue: "Water Supply Issue",
  public_property: "Public Infrastructure",
  road_damage: "Road Damage",
  other: "Other Civic Issue",
};

// ─── GPS helper (returns a Promise) ───────────────────────────────────────────

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

// ─── Anonymous fingerprint (session-stable, non-identifying) ──────────────────

const getOrCreateFingerprint = () => {
  const key = "civic_anon_fp";
  let fp = sessionStorage.getItem(key);
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, fp);
  }
  return fp;
};

// ─── Main Modal Component ─────────────────────────────────────────────────────

/**
 * NearbyIssueModal
 *
 * Props:
 *   complaint  – complaint object from the /nearby API
 *   userCoords – { latitude, longitude } of the viewing user (may be null)
 *   onClose    – called when the user dismisses the modal
 *   isAuthenticated – boolean from AuthContext
 */
const NearbyIssueModal = ({ complaint, userCoords, onClose, isAuthenticated }) => {
  const [confirmState, setConfirmState] = useState("idle"); // idle | loading | success | already | error
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmCount, setConfirmCount] = useState(complaint?.community_confirmations ?? 0);
  const [lastConfirmedAt, setLastConfirmedAt] = useState(complaint?.last_confirmed_at ?? null);
  const [activeImage, setActiveImage] = useState(0);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleStillExists = useCallback(async () => {
    setConfirmState("loading");
    setConfirmMsg("");

    let lat, lng;
    try {
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      setConfirmState("error");
      setConfirmMsg("Unable to get your location. Please enable GPS and try again.");
      return;
    }

    const complaintId = complaint.complaintId || complaint.id;
    const fingerprint = isAuthenticated ? "" : getOrCreateFingerprint();

    try {
      const res = await complaintService.confirmComplaint(complaintId, {
        latitude: lat,
        longitude: lng,
        fingerprint,
      });

      setConfirmCount(res.community_confirmations ?? confirmCount + 1);
      setLastConfirmedAt(res.last_confirmed_at ?? new Date().toISOString());

      if (res.already_confirmed) {
        setConfirmState("already");
        setConfirmMsg("You have already confirmed that this issue exists.");
      } else {
        setConfirmState("success");
        setConfirmMsg("Thank you — your confirmation has been recorded.");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not confirm. Please try again.";
      setConfirmState("error");
      setConfirmMsg(detail);
    }
  }, [complaint, confirmCount, isAuthenticated]);

  if (!complaint) return null;

  const images = complaint.images || [];
  const status = complaint.status || "SUBMITTED";
  const priority = complaint.priority || "MEDIUM";
  const catLabel = CATEGORY_LABELS[complaint.category] || complaint.category || "Issue";
  const confirmInfo = confirmationLabel(confirmCount);

  // Timeline: prefer status_history, fall back to timeline array
  const timeline =
    (complaint.status_history || []).slice().reverse() ||
    (complaint.timeline || []).slice().reverse();

  const distStr =
    complaint.distanceMeters != null
      ? `${Math.round(complaint.distanceMeters)} m away`
      : "";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Issue Details"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col shadow-2xl animate-slide-up">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-gray-900 text-base truncate">{catLabel}</span>
              {complaint.complaintId && (
                <span className="text-xs text-gray-400 font-mono">{complaint.complaintId}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {distStr && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                <span className="material-symbols-outlined text-sm">near_me</span>
                {distStr}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-gray-600">close</span>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1">

          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="relative">
              <img
                src={getUploadUrl(images[activeImage])}
                alt={`Evidence ${activeImage + 1}`}
                className="w-full h-56 sm:h-72 object-cover"
                onError={(e) => { e.target.src = "https://placehold.co/800x400?text=No+Image"; }}
              />
              {/* Priority badge overlay */}
              <span
                className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full border ${PRIORITY_COLOURS[priority] || PRIORITY_COLOURS.MEDIUM}`}
              >
                {priority}
              </span>
              {/* Status badge overlay */}
              <span
                className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOURS[status] || "bg-gray-100 text-gray-700"}`}
              >
                {status.replace(/_/g, " ")}
              </span>
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${idx === activeImage ? "border-white bg-white scale-125" : "border-white/70 bg-white/40"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-40 bg-gray-100 flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl text-gray-300">image_not_supported</span>
              <span className="text-sm text-gray-400">No image available</span>
            </div>
          )}

          <div className="px-5 py-4 space-y-5">

            {/* ── Community Confirmation Box ── */}
            <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-blue-700">{confirmCount}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confirmInfo.cls}`}
                    >
                      {confirmInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {confirmCount === 0
                      ? "No nearby citizens have confirmed this issue yet."
                      : `${confirmCount} nearby ${confirmCount === 1 ? "citizen has" : "citizens have"} confirmed this issue still exists.`}
                  </p>
                  {lastConfirmedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last confirmed: <span className="font-medium text-gray-600">{formatRelativeTime(lastConfirmedAt)}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    Community Confirmed — not official government verification
                  </p>
                </div>

                {/* Still Exists Button */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {confirmState === "success" || confirmState === "already" ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold text-center">Confirmed!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleStillExists}
                      disabled={confirmState === "loading"}
                      id="still-exists-btn"
                      className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm
                        ${confirmState === "loading"
                          ? "bg-gray-50 border-gray-200 cursor-not-allowed"
                          : "bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-400 hover:shadow-md active:scale-95"
                        }`}
                      aria-label="Still Exists — confirm this issue is physically present near you"
                    >
                      {confirmState === "loading" ? (
                        <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-2xl select-none">👍</span>
                      )}
                    </button>
                  )}
                  <span className="text-[10px] text-gray-500 font-medium text-center leading-tight max-w-[70px]">
                    Still Exists
                  </span>
                </div>
              </div>

              {/* Feedback message */}
              {confirmMsg && (
                <div
                  className={`mt-3 text-xs font-medium px-3 py-2 rounded-lg border
                    ${confirmState === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}
                >
                  {confirmMsg}
                </div>
              )}

              {/* 100m proximity note */}
              {(confirmState === "idle" || confirmState === "error") && (
                <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">location_on</span>
                  You must be within 100 m of this issue to confirm
                </p>
              )}
            </div>

            {/* ── Description ── */}
            {complaint.description && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Description</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{complaint.description}</p>
              </div>
            )}

            {/* ── Details Grid ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Category</p>
                <p className="text-sm font-semibold text-gray-800">{catLabel}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Priority</p>
                <p className={`text-sm font-bold ${priority === "CRITICAL" || priority === "HIGH" ? "text-red-700" : priority === "MEDIUM" ? "text-amber-700" : "text-green-700"}`}>
                  {priority}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Status</p>
                <p className="text-sm font-semibold text-gray-800">{status.replace(/_/g, " ")}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Reported</p>
                <p className="text-sm font-semibold text-gray-800">{formatRelativeTime(complaint.createdAt) || formatDate(complaint.createdAt)}</p>
              </div>
            </div>

            {/* ── Address ── */}
            {complaint.address && (
              <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="material-symbols-outlined text-gray-400 flex-shrink-0 mt-0.5">location_on</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Approximate Location</p>
                  <p className="text-sm text-gray-700">{complaint.address}</p>
                  {complaint.district_name && (
                    <p className="text-xs text-gray-400 mt-0.5">{complaint.district_name}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── ETA ── */}
            {complaint.estimated_resolution_at && (
              <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
                <span className="material-symbols-outlined text-amber-500 flex-shrink-0 mt-0.5">schedule</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Estimated Resolution</p>
                  <p className="text-sm font-semibold text-amber-800">{formatDate(complaint.estimated_resolution_at)}</p>
                </div>
              </div>
            )}

            {/* ── Timeline ── */}
            {timeline.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Status Timeline</h3>
                <div className="relative pl-4">
                  <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-4">
                    {timeline.slice(0, 6).map((entry, idx) => {
                      const ts = entry.changed_at || entry.timestamp;
                      const toStatus = entry.to_status || entry.status || "—";
                      return (
                        <div key={idx} className="flex gap-3 relative">
                          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 relative z-10" />
                          <div>
                            <p className="text-xs font-semibold text-gray-800">
                              {toStatus.replace(/_/g, " ")}
                            </p>
                            {entry.comment && (
                              <p className="text-xs text-gray-500 mt-0.5">{entry.comment}</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(ts)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI Verification ── */}
            {complaint.aiVerified !== undefined && (
              <div className={`flex items-center gap-3 rounded-xl p-3 border ${complaint.aiVerified ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <span className={`material-symbols-outlined ${complaint.aiVerified ? "text-green-600" : "text-gray-400"}`}>
                  smart_toy
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">AI Verification</p>
                  <p className="text-xs font-semibold text-gray-700">
                    {complaint.aiVerified
                      ? `Verified — ${Math.round((complaint.aiConfidence || 0) * 100)}% confidence`
                      : "Not AI-verified"}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/80 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
      `}</style>
    </div>
  );
};

export default NearbyIssueModal;
