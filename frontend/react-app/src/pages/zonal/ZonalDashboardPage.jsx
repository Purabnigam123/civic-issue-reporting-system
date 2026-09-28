import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';
import { Link } from 'react-router-dom';
import { WorkerLeaderboard } from '../../components/analytics/WorkerLeaderboard';
import { ResolutionTrendChart } from '../../components/analytics/ResolutionTrendChart';

const ZonalDashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [districtName, setDistrictName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mRes, aRes] = await Promise.all([
        zonalService.getMetrics(),
        zonalService.getAnalytics().catch(() => null),
      ]);
      if (mRes && mRes.metrics) {
        setMetrics(mRes.metrics);
        setDistrictName(mRes.district_name || mRes.district_id);
      }
      if (aRes && aRes.analytics) {
        setAnalytics(aRes.analytics);
      }
    } catch (err) {
      console.error('Failed to load zonal metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const maxTrend = analytics?.trend ? Math.max(...analytics.trend.map(t => Math.max(t.complaints, t.resolved, 1)), 5) : 10;

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <ZonalSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen space-y-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
                {districtName ? `${districtName} Operations` : 'Zonal Command'}
              </h1>
            </div>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1 font-medium">
              Field crew coordination, task allocation, and municipal resolution tracking
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant hover:text-primary rounded-xl text-xs font-semibold transition-all border border-outline-variant/30 shadow-sm flex items-center gap-1.5"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-on-surface-variant mt-4">Loading zone telemetry...</p>
          </div>
        ) : metrics ? (
          <div className="space-y-8">
            {/* Zone KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-tertiary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Needs Assignment</span>
                  <span className="p-2 rounded-xl bg-tertiary-container/30 text-tertiary material-symbols-outlined text-xl">
                    pending_actions
                  </span>
                </div>
                <p className="text-3xl font-black text-tertiary">{metrics.pending_assignment}</p>
                <Link to="/zonal/complaints" className="text-[11px] text-tertiary hover:underline mt-2 inline-block font-bold">
                  Assign to workers →
                </Link>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-primary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">In Progress</span>
                  <span className="p-2 rounded-xl bg-primary-fixed/50 text-primary material-symbols-outlined text-xl">
                    handyman
                  </span>
                </div>
                <p className="text-3xl font-black text-primary">{metrics.in_progress + metrics.assigned}</p>
                <p className="text-[11px] text-outline mt-2 font-medium">Active maintenance tasks</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-secondary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Resolved Work</span>
                  <span className="p-2 rounded-xl bg-secondary-container/40 text-secondary material-symbols-outlined text-xl">
                    check_circle
                  </span>
                </div>
                <p className="text-3xl font-black text-secondary">{metrics.resolved}</p>
                <p className="text-[11px] text-outline mt-2 font-medium">Successfully closed issues</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 w-full bg-primary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Field Crew</span>
                  <span className="p-2 rounded-xl bg-primary-fixed/50 text-primary material-symbols-outlined text-xl">
                    group
                  </span>
                </div>
                <p className="text-3xl font-black text-on-surface">{metrics.active_workers}</p>
                <Link to="/zonal/workers" className="text-[11px] text-primary hover:underline mt-2 inline-block font-bold">
                  Manage crew team →
                </Link>
              </div>
            </div>

            {/* 7-Day Operational Activity Trend */}
            {analytics?.trend && analytics.trend.length > 0 && (
              <ResolutionTrendChart 
                data={analytics.trend.map(t => ({ date: t.date, reported: t.complaints, resolved: t.resolved }))} 
                title="7-Day Operational Activity Trend"
              />
            )}

            {/* Category breakdown in zone */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">category</span>
                Issue Category Breakdown for this Zone
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.category_counts?.map((cat) => {
                  const pct = Math.round((cat.count / Math.max(metrics.total_complaints, 1)) * 100);
                  return (
                    <div key={cat.category} className="p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="capitalize text-on-surface">{cat.category.replace('_', ' ')}</span>
                        <span className="text-primary">{cat.count} reports ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Worker Performance Leaderboard */}
            {analytics?.workers && analytics.workers.length > 0 && (
              <WorkerLeaderboard 
                data={analytics.workers.slice(0, 8).map(w => ({
                  id: w.id,
                  name: w.name,
                  district: w.worker_id,
                  resolvedCount: w.completed
                }))} 
                title="Top Zone Field Workers" 
              />
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default ZonalDashboardPage;
