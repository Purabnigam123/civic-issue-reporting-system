import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { complaintService } from '../services/complaintService';

const DashboardPage = () => {
  const { user } = useAuth();
  const { lastEvent } = useNotifications();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await complaintService.getMyComplaints();
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
      setError('Failed to fetch recent complaints from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [lastEvent]);

  const totalSubs = complaints.length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED' || c.status === 'VERIFIED').length;
  const activeCount = complaints.filter((c) => c.status !== 'RESOLVED' && c.status !== 'VERIFIED').length;

  const quickCategories = [
    { key: 'pothole', label: 'Pothole', icon: 'moving' },
    { key: 'broken_streetlight', label: 'Streetlight', icon: 'lightbulb' },
    { key: 'garbage', label: 'Garbage', icon: 'delete' },
    { key: 'drainage', label: 'Drainage', icon: 'water_drop' },
    { key: 'water_issue', label: 'Water', icon: 'plumbing' },
    { key: 'public_property', label: 'Infrastructure', icon: 'location_city' },
    { key: 'road_damage', label: 'Road Damage', icon: 'warning' },
    { key: 'other', label: 'Other', icon: 'more_horiz' },
  ];

  const getCategoryTitle = (category) => {
    switch (category) {
      case 'pothole':
        return 'Pothole Road Damage';
      case 'broken_streetlight':
        return 'Broken Streetlight';
      case 'garbage':
        return 'Garbage / Waste Overflow';
      case 'drainage':
        return 'Drainage & Sewage Blockage';
      case 'water_issue':
        return 'Water Supply Disruption';
      case 'public_property':
        return 'Public Infrastructure Damage';
      case 'road_damage':
        return 'Road Surface Degradation';
      case 'other':
      default:
        return 'Civic Concern';
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md selection:bg-primary selection:text-on-primary pb-24 md:pb-12 pt-16">
      <DashboardNavbar />

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-8 mb-section-gap">
        {/* Welcome Section */}
        <section className="mb-12">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-2 font-bold">
            Good morning, {user?.name || 'Citizen'}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Here is an overview of your civic engagement.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-gutter">
          <div className="flex flex-col gap-8">
            {/* Overview Cards (Bento style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_30px_rgba(15,23,42,0.08)] transition-shadow duration-300 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase font-semibold">
                    Active Inquiries
                  </h3>
                  <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" data-icon="pending_actions">
                      pending_actions
                    </span>
                  </div>
                </div>
                <div className="font-headline-xl text-headline-xl text-primary font-bold">
                  {loading ? '...' : activeCount}
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_30px_rgba(15,23,42,0.08)] transition-shadow duration-300 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase font-semibold">
                    Resolved
                  </h3>
                  <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary" data-icon="check_circle">
                      check_circle
                    </span>
                  </div>
                </div>
                <div className="font-headline-xl text-headline-xl text-secondary font-bold">
                  {loading ? '...' : resolvedCount}
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_30px_rgba(15,23,42,0.08)] transition-shadow duration-300 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant uppercase font-semibold">
                    Total Subs
                  </h3>
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant" data-icon="receipt_long">
                      receipt_long
                    </span>
                  </div>
                </div>
                <div className="font-headline-xl text-headline-xl text-on-surface font-bold">
                  {loading ? '...' : totalSubs}
                </div>
              </div>
            </div>

            {/* Quick Category Launcher */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-6 font-bold">
                Quick Category Launcher
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {quickCategories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => navigate(`/report?category=${cat.key}`)}
                    className="flex flex-col items-center justify-center p-4 rounded-lg bg-surface-container-low hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors duration-200 group text-on-surface-variant border border-transparent hover:border-primary-fixed-dim"
                  >
                    <span className="material-symbols-outlined text-3xl mb-2 group-hover:scale-110 transition-transform duration-200" data-icon={cat.icon}>
                      {cat.icon}
                    </span>
                    <span className="font-label-sm text-label-sm text-center font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Complaints Feed */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Recent Complaints Feed
                </h2>
                <Link className="text-primary font-label-md text-label-md hover:underline font-semibold" to="/complaints">
                  View All
                </Link>
              </div>

              {error && (
                <div className="p-4 bg-error-container/30 text-error rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col gap-4 py-8 items-center justify-center">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-on-surface-variant">Loading your complaint records...</p>
                </div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-outline-variant/40 rounded-xl">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2">assignment_late</span>
                  <p className="font-headline-sm text-on-surface mb-1">No complaints filed yet</p>
                  <p className="text-sm text-on-surface-variant mb-6">
                    Have you spotted a civic issue? Log it now to alert your municipal department.
                  </p>
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md shadow-sm hover:bg-primary-container"
                  >
                    <span className="material-symbols-outlined text-base">add_circle</span>
                    Report an Issue
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {complaints.slice(0, 4).map((complaint) => (
                    <div
                      key={complaint._id}
                      onClick={() => navigate(`/complaints/${complaint._id}`)}
                      className="p-4 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors duration-200 border border-transparent hover:border-outline-variant/30 cursor-pointer overflow-hidden"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <StatusBadge status={complaint.status} />
                        <span className="text-on-surface-variant font-label-sm text-label-sm shrink-0">
                          {formatRelativeTime(complaint.createdAt)}
                        </span>
                      </div>
                      <h4 className="font-headline-sm text-headline-sm text-on-surface mb-1 font-bold truncate">
                        {getCategoryTitle(complaint.category)} — {complaint.complaintId}
                      </h4>
                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 break-words">
                        {complaint.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-outline gap-2 min-w-0">
                        <span className="flex items-center gap-1 min-w-0 truncate">
                          <span className="material-symbols-outlined text-sm shrink-0">location_on</span>
                          <span className="truncate" title={complaint.address}>{complaint.address || 'Location Tagged'}</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-primary shrink-0">
                          {complaint.department}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default DashboardPage;
