import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardNavbar from '../components/layout/DashboardNavbar';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import StatusBadge from '../components/ui/StatusBadge';
import { complaintService } from '../services/complaintService';
import potholeImg from '../assets/images/potehole.png';

const ComplaintsPage = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL', 'ACTIVE', 'RESOLVED', 'REOPENED'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7; // 1 featured + 6 standard

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const data = await complaintService.getMyComplaints();
        setComplaints(data.complaints || []);
      } catch (err) {
        console.error('Complaints fetch error:', err);
        setError('Failed to load your complaints archive. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, []);

  useEffect(() => {
    let list = [...complaints];

    // Filter by tab
    if (filterTab === 'ACTIVE') {
      list = list.filter((c) => c.status !== 'RESOLVED' && c.status !== 'REOPENED');
    } else if (filterTab === 'RESOLVED') {
      list = list.filter((c) => c.status === 'RESOLVED');
    } else if (filterTab === 'REOPENED') {
      list = list.filter((c) => c.status === 'REOPENED');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.complaintId?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q)
      );
    }

    setFilteredComplaints(list);
    setCurrentPage(1);
  }, [complaints, filterTab, searchQuery]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'pothole':
        return { icon: 'landscape', colorClass: 'bg-primary-container/20 text-primary' };
      case 'broken_streetlight':
        return { icon: 'lightbulb', colorClass: 'bg-tertiary-container/20 text-tertiary' };
      case 'garbage':
        return { icon: 'delete', colorClass: 'bg-secondary-container/20 text-secondary' };
      case 'drainage':
        return { icon: 'water_drop', colorClass: 'bg-primary-container/20 text-primary' };
      case 'water_issue':
        return { icon: 'plumbing', colorClass: 'bg-primary-container/20 text-primary' };
      case 'public_property':
        return { icon: 'park', colorClass: 'bg-tertiary-container/20 text-tertiary' };
      case 'road_damage':
        return { icon: 'traffic', colorClass: 'bg-tertiary-container/20 text-tertiary' };
      case 'other':
      default:
        return { icon: 'error_outline', colorClass: 'bg-surface-variant text-on-surface-variant' };
    }
  };

  const getCategoryDisplayName = (cat) => {
    switch (cat) {
      case 'pothole':
        return 'Pothole Road Damage';
      case 'broken_streetlight':
        return 'Streetlight Outage';
      case 'garbage':
        return 'Garbage / Waste Collection';
      case 'drainage':
        return 'Drainage & Sewage Blockage';
      case 'water_issue':
        return 'Water Main Leak';
      case 'public_property':
        return 'Public Property Damage';
      case 'road_damage':
        return 'Road Surface Degradation';
      case 'other':
      default:
        return 'Civic Concern';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getUploadUrl = (filename) => {
    const baseUrl = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5000/uploads';
    return `${baseUrl}/${filename}`;
  };

  // Pagination slice
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;
  const currentItems = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const featuredItem = currentItems.length > 0 ? currentItems[0] : null;
  const standardItems = currentItems.length > 1 ? currentItems.slice(1) : [];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen pt-20 pb-24 md:pb-12">
      <DashboardNavbar />

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 font-bold">
              Citizen Complaints Archive
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Access and track the historical record of civic reports, organized by status and department for complete municipal transparency.
            </p>
          </div>

          <div className="w-full md:w-auto relative">
            <div className="relative w-full md:w-80">
              <input
                className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface transition-all shadow-sm font-body-md"
                placeholder="Search by ID, Category, or Location..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="search">
                search
              </span>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-3 mb-10 pb-4 border-b border-outline-variant/30">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-5 py-2 font-label-md text-label-md rounded-full shadow-sm transition-all ${
              filterTab === 'ALL'
                ? 'bg-primary-container text-on-primary-container font-bold'
                : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-low'
            }`}
          >
            All Records ({complaints.length})
          </button>

          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-5 py-2 font-label-md text-label-md rounded-full transition-all ${
              filterTab === 'ACTIVE'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-low'
            }`}
          >
            Active
          </button>

          <button
            onClick={() => setFilterTab('RESOLVED')}
            className={`px-5 py-2 font-label-md text-label-md rounded-full transition-all ${
              filterTab === 'RESOLVED'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-low'
            }`}
          >
            Resolved
          </button>

          <button
            onClick={() => setFilterTab('REOPENED')}
            className={`px-5 py-2 font-label-md text-label-md rounded-full transition-all ${
              filterTab === 'REOPENED'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-low'
            }`}
          >
            Reopened
          </button>
        </div>

        {error && (
          <div className="p-4 bg-error-container/30 text-error rounded-xl text-sm mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="font-label-md text-on-surface-variant mt-4">Fetching citizen archive...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-2xl p-8">
            <span className="material-symbols-outlined text-5xl text-outline mb-3">folder_off</span>
            <h3 className="font-headline-sm text-on-surface mb-2 font-bold">No Records Found</h3>
            <p className="text-on-surface-variant max-w-md mx-auto mb-6">
              {searchQuery
                ? `No complaint matches your query "${searchQuery}". Try different keywords.`
                : 'You have not submitted any complaints in this category yet.'}
            </p>
            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md shadow-sm"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              File a New Complaint
            </Link>
          </div>
        ) : (
          <div>
            {/* Bento Grid Layout for Complaints */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Featured / Recent Item */}
              {featuredItem && (
                <div
                  onClick={() => navigate(`/complaints/${featuredItem._id}`)}
                  className="lg:col-span-8 bg-surface rounded-xl border border-outline-variant/30 p-6 flex flex-col md:flex-row gap-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_30px_rgba(15,23,42,0.08)] transition-all cursor-pointer group overflow-hidden"
                >
                  <div className="w-full md:w-1/3 h-48 md:h-auto rounded-lg overflow-hidden bg-surface-container-low shrink-0 relative">
                    <img
                      src={
                        featuredItem.images && featuredItem.images.length > 0
                          ? getUploadUrl(featuredItem.images[0])
                          : potholeImg
                      }
                      alt={getCategoryDisplayName(featuredItem.category)}
                      className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="font-label-md text-label-md text-primary font-bold tracking-wider uppercase truncate">
                          #{featuredItem.complaintId}
                        </span>
                        <StatusBadge status={featuredItem.status} />
                      </div>

                      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3 font-bold group-hover:text-primary transition-colors truncate">
                        {getCategoryDisplayName(featuredItem.category)}
                      </h2>

                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-4 break-words">
                        {featuredItem.description}
                      </p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md text-sm min-w-0">
                          <span className="material-symbols-outlined text-[18px] text-outline shrink-0" data-icon="location_on">
                            location_on
                          </span>
                          <span className="truncate flex-1 min-w-0" title={featuredItem.address}>{featuredItem.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md text-sm min-w-0">
                          <span className="material-symbols-outlined text-[18px] text-outline shrink-0" data-icon="domain">
                            domain
                          </span>
                          <span className="truncate flex-1 min-w-0">{featuredItem.department}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-outline-variant/20 gap-2 min-w-0">
                      <div className="text-sm text-on-surface-variant truncate">
                        Reported: {formatDate(featuredItem.createdAt)}
                      </div>
                      <span className="text-primary font-label-md text-label-md hover:underline flex items-center gap-1 font-semibold shrink-0">
                        View Details{' '}
                        <span className="material-symbols-outlined text-[16px]" data-icon="arrow_forward">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Items */}
              {standardItems.map((item) => {
                const iconInfo = getCategoryIcon(item.category);
                return (
                  <div
                    key={item._id}
                    onClick={() => navigate(`/complaints/${item._id}`)}
                    className="lg:col-span-4 bg-surface rounded-xl border border-outline-variant/30 p-6 flex flex-col shadow-[0px_4px_20px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_30px_rgba(15,23,42,0.08)] transition-all cursor-pointer group hover:-translate-y-1 overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${iconInfo.colorClass}`}>
                        <span className="material-symbols-outlined">{iconInfo.icon}</span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="mb-4 flex-1 min-w-0">
                      <div className="font-label-sm text-label-sm text-outline mb-1 uppercase tracking-wider font-semibold truncate">
                        #{item.complaintId}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold group-hover:text-primary transition-colors truncate">
                        {getCategoryDisplayName(item.category)}
                      </h3>
                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 text-sm break-words">
                        {item.description}
                      </p>
                    </div>

                    <div className="space-y-1 pt-4 border-t border-outline-variant/20 mb-4 text-xs text-on-surface-variant">
                      <div className="flex justify-between gap-2 min-w-0">
                        <span className="text-outline shrink-0">Dept:</span>
                        <span className="font-medium text-on-surface truncate">{item.department}</span>
                      </div>
                      <div className="flex justify-between gap-2 min-w-0">
                        <span className="text-outline shrink-0">Date:</span>
                        <span className="truncate">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary-container group-hover:border-transparent transition-colors"
                    >
                      View Record
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                  aria-label="Previous Page"
                >
                  <span className="material-symbols-outlined" data-icon="chevron_left">
                    chevron_left
                  </span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg font-label-md text-label-md transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-on-primary font-bold'
                        : 'border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                  aria-label="Next Page"
                >
                  <span className="material-symbols-outlined" data-icon="chevron_right">
                    chevron_right
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default ComplaintsPage;
