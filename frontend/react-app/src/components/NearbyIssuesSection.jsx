/**
 * NearbyIssuesSection
 *
 * Displays a "Issues Near You" section on the public landing page.
 *
 * Flow:
 *   1. Requests browser GPS permission.
 *   2. Calls GET /api/complaints/nearby?latitude=...&longitude=...&radius=100
 *   3. Renders a Leaflet map with a 100-metre radius circle + complaint markers.
 *   4. Lists complaint cards below the map, filterable by category.
 *   5. Clicking a card opens NearbyIssueModal for the full viewer.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { complaintService } from "../services/complaintService";
import NearbyIssueModal from "./NearbyIssueModal";
import { useAuth } from "../context/AuthContext";

// ─── Fix Leaflet default icon path (Vite asset issue) ────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Icons ────────────────────────────────────────────────────────────────────

const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:36px;height:36px;
    background:#2563eb;
    border-radius:50%;
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(37,99,235,0.5);
    display:flex;align-items:center;justify-content:center;
  ">
    <div style="width:10px;height:10px;background:#fff;border-radius:50%;"></div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const makePriorityIcon = (priority) => {
  const colors = {
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#eab308",
    LOW: "#22c55e",
  };
  const c = colors[priority] || colors.MEDIUM;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;
      background:${c};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

// ─── Map view re-centring helper ──────────────────────────────────────────────

function MapRecentrer({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 17);
  }, [lat, lng, map]);
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL || "http://localhost:5000/uploads";
const getUploadUrl = (f) => (f ? `${UPLOAD_BASE}/${f}` : null);

const CATEGORIES = [
  { key: "all", label: "All", icon: "apps" },
  { key: "pothole", label: "Pothole", icon: "directions_car" },
  { key: "broken_streetlight", label: "Streetlight", icon: "lightbulb" },
  { key: "garbage", label: "Garbage", icon: "delete" },
  { key: "drainage", label: "Drainage", icon: "waves" },
  { key: "water_issue", label: "Water", icon: "water_drop" },
  { key: "public_property", label: "Infrastructure", icon: "account_balance" },
  { key: "road_damage", label: "Road Damage", icon: "traffic" },
  { key: "other", label: "Other", icon: "more_horiz" },
];

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

const PRIORITY_BADGE = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const STATUS_BADGE = {
  SUBMITTED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-purple-50 text-purple-700",
  ASSIGNED: "bg-indigo-50 text-indigo-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  VERIFIED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-50 text-gray-600",
  ESCALATED: "bg-rose-50 text-rose-700",
  REJECTED: "bg-red-50 text-red-700",
};

const formatRelativeTime = (isoStr) => {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

// ─── Complaint Card ───────────────────────────────────────────────────────────

const ComplaintCard = ({ complaint, onClick }) => {
  const img = complaint.images?.[0];
  const dist = complaint.distanceMeters;
  const confirmCount = complaint.community_confirmations ?? 0;
  const catLabel = CATEGORY_LABELS[complaint.category] || complaint.category || "Issue";

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
      onClick={() => onClick(complaint)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(complaint)}
      aria-label={`View complaint: ${catLabel}`}
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-gray-100 overflow-hidden">
        {img ? (
          <img
            src={getUploadUrl(img)}
            alt={catLabel}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { e.target.src = "https://placehold.co/400x200?text=No+Image"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-gray-300">image_not_supported</span>
          </div>
        )}
        {/* Distance pill */}
        {dist != null && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">near_me</span>
            {Math.round(dist)} m away
          </div>
        )}
        {/* Priority badge */}
        <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[complaint.priority] || PRIORITY_BADGE.MEDIUM}`}>
          {complaint.priority || "MEDIUM"}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {/* Category + Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-bold text-gray-800 text-sm truncate">{catLabel}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[complaint.status] || "bg-gray-50 text-gray-600"}`}>
            {(complaint.status || "").replace(/_/g, " ")}
          </span>
        </div>

        {/* Description snippet */}
        {complaint.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{complaint.description}</p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{formatRelativeTime(complaint.createdAt)}</span>
          <div className="flex items-center gap-1 font-semibold text-blue-600">
            <span>👍</span>
            <span>{confirmCount}</span>
            {complaint.last_confirmed_at && (
              <span className="text-gray-400 font-normal">· {formatRelativeTime(complaint.last_confirmed_at)}</span>
            )}
          </div>
        </div>

        {/* View button */}
        <button
          className="mt-2.5 w-full py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors"
          onClick={(e) => { e.stopPropagation(); onClick(complaint); }}
        >
          View Issue
        </button>
      </div>
    </div>
  );
};

// ─── Main Section Component ───────────────────────────────────────────────────

const NearbyIssuesSection = () => {
  const { isAuthenticated } = useAuth();

  // GPS state
  const [gpsState, setGpsState] = useState("idle"); // idle | requesting | granted | denied | error
  const [userCoords, setUserCoords] = useState(null); // { latitude, longitude }

  // Complaints state
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter
  const [activeCategory, setActiveCategory] = useState("all");

  // Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  // ── GPS ──
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState("error");
      return;
    }
    setGpsState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsState("granted");
      },
      (err) => {
        console.warn("GPS denied:", err.message);
        setGpsState("denied");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // Auto-request GPS on mount
  useEffect(() => {
    requestGps();
  }, [requestGps]);

  // ── Fetch complaints when coords are available ──
  const fetchNearby = useCallback(async (lat, lng, cat) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await complaintService.getNearbyComplaints({
        latitude: lat,
        longitude: lng,
        radius: 100, // exactly 100 metres
        category: cat === "all" ? null : cat,
        limit: 20,
      });
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error("Failed to fetch nearby complaints:", err);
      setFetchError("Could not load nearby issues. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userCoords) {
      fetchNearby(userCoords.latitude, userCoords.longitude, activeCategory);
    }
  }, [userCoords, activeCategory, fetchNearby]);

  // ── Filtered list (backend already filters by category; this is a no-op guard) ──
  const visibleComplaints = complaints;

  // ── Render ──
  return (
    <section className="py-16 bg-slate-50" id="nearby-issues">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 font-semibold text-xs px-4 py-1.5 rounded-full uppercase tracking-wider mb-4">
            <span className="material-symbols-outlined text-sm">my_location</span>
            Live — 100 Metre Radius
          </span>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Issues <span className="text-blue-600">Near You</span>
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">
            Civic complaints reported within 100 metres of your current location.
            Use this to confirm issues that are still present.
          </p>
        </div>

        {/* ── GPS permission states ── */}
        {gpsState === "idle" || gpsState === "requesting" ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-3xl text-blue-500">my_location</span>
            </div>
            <p className="text-gray-600 font-medium">
              {gpsState === "idle" ? "Preparing location access…" : "Requesting your location…"}
            </p>
            <p className="text-xs text-gray-400 max-w-xs text-center">
              Allow location access to see civic issues reported within 100 metres of you.
            </p>
          </div>
        ) : gpsState === "denied" || gpsState === "error" ? (
          <div className="flex flex-col items-center gap-4 py-16 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-400">location_off</span>
            </div>
            <h3 className="font-bold text-gray-800">Location Access Required</h3>
            <p className="text-sm text-gray-500">
              {gpsState === "error"
                ? "Your browser doesn't support geolocation."
                : "Location permission was denied. Enable it in your browser settings and try again."}
            </p>
            {gpsState === "denied" && (
              <button
                onClick={requestGps}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md"
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          /* gpsState === "granted" */
          <>
            {/* ── Map ── */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md mb-8" style={{ height: 340 }}>
              <MapContainer
                center={[userCoords.latitude, userCoords.longitude]}
                zoom={17}
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
                attributionControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <MapRecentrer lat={userCoords.latitude} lng={userCoords.longitude} />

                {/* 100 m radius circle */}
                <Circle
                  center={[userCoords.latitude, userCoords.longitude]}
                  radius={100}
                  pathOptions={{
                    color: "#2563eb",
                    fillColor: "#2563eb",
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: "6 4",
                  }}
                />

                {/* User marker */}
                <Marker
                  position={[userCoords.latitude, userCoords.longitude]}
                  icon={userIcon}
                >
                  <Popup>
                    <strong>📍 Your Location</strong>
                    <br />
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      Showing issues within 100 m
                    </span>
                  </Popup>
                </Marker>

                {/* Complaint markers */}
                {visibleComplaints.map((c) => {
                  const lat = parseFloat(c.latitude);
                  const lng = parseFloat(c.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  return (
                    <Marker
                      key={c.id || c.complaintId}
                      position={[lat, lng]}
                      icon={makePriorityIcon(c.priority)}
                      eventHandlers={{ click: () => setSelectedComplaint(c) }}
                    >
                      <Popup>
                        <strong>{CATEGORY_LABELS[c.category] || c.category}</strong>
                        <br />
                        <span style={{ fontSize: "11px" }}>
                          {Math.round(c.distanceMeters ?? 0)} m away · {c.status?.replace(/_/g, " ")}
                        </span>
                        <br />
                        <button
                          onClick={() => setSelectedComplaint(c)}
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#2563eb",
                            fontWeight: "600",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          View Details →
                        </button>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* ── Map legend ── */}
            <div className="flex items-center gap-6 justify-center mb-8 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border-2 border-white shadow-sm" />
                Your location
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                CRITICAL
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                HIGH
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                MEDIUM
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                LOW
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <span className="w-8 h-px border-t-2 border-dashed border-blue-400 inline-block" />
                100 m radius
              </span>
            </div>

            {/* ── Category filter tabs ── */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                    ${activeCategory === cat.key
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                >
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* ── Complaint list ── */}
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Searching within 100 m…</p>
              </div>
            ) : fetchError ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-red-300 mb-3 block">error</span>
                <p className="text-sm text-gray-500">{fetchError}</p>
                <button
                  onClick={() => fetchNearby(userCoords.latitude, userCoords.longitude, activeCategory)}
                  className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : visibleComplaints.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-gray-300">search_off</span>
                </div>
                <h3 className="font-bold text-gray-700 mb-1">No Issues Nearby</h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  {activeCategory === "all"
                    ? "No civic issues have been reported within 100 metres of your location."
                    : `No ${CATEGORY_LABELS[activeCategory] || activeCategory} issues within 100 m. Try a different category.`}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4 font-medium">
                  {visibleComplaints.length} issue{visibleComplaints.length !== 1 ? "s" : ""} within 100 m of your location
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleComplaints.map((c) => (
                    <ComplaintCard
                      key={c.id || c.complaintId}
                      complaint={c}
                      onClick={setSelectedComplaint}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {selectedComplaint && (
        <NearbyIssueModal
          complaint={selectedComplaint}
          userCoords={userCoords}
          onClose={() => setSelectedComplaint(null)}
          isAuthenticated={isAuthenticated}
        />
      )}
    </section>
  );
};

export default NearbyIssuesSection;
