import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import StatusBadge from '../components/ui/StatusBadge';
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
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                  <div className="flex items-center gap-3">
                    <StatusBadge status={complaint.status} />
                    <span className="px-3 py-1 bg-surface-container-high text-xs font-bold uppercase rounded-full">
                      Priority: {complaint.priority}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-outline mb-6">Filed on {formatDate(complaint.createdAt)}</p>

                <div className="p-4 bg-surface-container-low rounded-xl mb-6">
                  <h3 className="text-xs font-bold text-outline uppercase tracking-wider mb-2">Description</h3>
                  <p className="font-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                    {complaint.description}
                  </p>
                </div>

                {/* Assigned Department */}
                <div className="flex items-center gap-3 p-4 bg-primary-fixed/30 rounded-xl border border-primary-fixed-dim/40">
                  <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
                  <div>
                    <p className="text-xs font-bold text-on-primary-fixed-variant uppercase">Assigned Authority</p>
                    <p className="font-headline-sm text-sm font-bold text-on-surface">{complaint.department}</p>
                  </div>
                </div>
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

              {/* Status Progression Timeline */}
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
