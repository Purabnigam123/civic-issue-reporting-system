import React, { useState, useEffect } from 'react';
import ZonalSidebar from '../../components/zonal/ZonalSidebar';
import { zonalService } from '../../services/zonalService';
import { Link } from 'react-router-dom';

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
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
                      7-Day Operational Activity Trend
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Complaints filed vs issues resolved in this district</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-primary">
                      <span className="w-3 h-3 rounded-sm bg-primary"></span> Filed
                    </span>
                    <span className="flex items-center gap-1.5 text-secondary">
                      <span className="w-3 h-3 rounded-sm bg-secondary"></span> Resolved
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 pt-6 pb-2 border-b border-outline-variant/20">
                  {analytics.trend.map((day, idx) => {
                    const filedPct = Math.round((day.complaints / maxTrend) * 100);
                    const resPct = Math.round((day.resolved / maxTrend) * 100);
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="flex items-end gap-1 sm:gap-1.5 w-full justify-center h-full">
                          {/* Filed Bar */}
                          <div
                            className="w-3 sm:w-5 bg-primary rounded-t-md transition-all group-hover:opacity-80 relative"
                            style={{ height: `${Math.max(filedPct, 4)}%` }}
                            title={`${day.complaints} complaints filed`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-container-high px-1 py-0.5 rounded text-[9px] font-bold text-primary">
                              {day.complaints}
                            </span>
                          </div>
                          {/* Resolved Bar */}
                          <div
                            className="w-3 sm:w-5 bg-secondary rounded-t-md transition-all group-hover:opacity-80 relative"
                            style={{ height: `${Math.max(resPct, 4)}%` }}
                            title={`${day.resolved} complaints resolved`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-container-high px-1 py-0.5 rounded text-[9px] font-bold text-secondary">
                              {day.resolved}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant truncate w-full text-center">
                          {day.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">engineering</span>
                    Field Worker Resolution Performance
                  </h3>
                  <Link to="/zonal/workers" className="text-xs text-primary font-bold hover:underline">
                    View All Workers →
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/20 text-on-surface-variant font-extrabold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Worker</th>
                        <th className="pb-3">Worker ID</th>
                        <th className="pb-3 text-center">Active</th>
                        <th className="pb-3 text-center">Resolved</th>
                        <th className="pb-3 text-center">Success Rate</th>
                        <th className="pb-3 text-right pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {analytics.workers.slice(0, 8).map((w) => (
                        <tr key={w.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3.5 pl-2 font-bold text-on-surface flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-[10px]">
                              {w.name?.charAt(0) || 'W'}
                            </div>
                            {w.name}
                          </td>
                          <td className="py-3.5 font-mono text-outline">{w.worker_id}</td>
                          <td className="py-3.5 text-center font-bold text-primary">{w.active}</td>
                          <td className="py-3.5 text-center font-bold text-secondary">{w.completed}</td>
                          <td className="py-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary-fixed/20 text-primary">
                              {w.rate}%
                            </span>
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              w.status === 'ACTIVE' ? 'bg-secondary/15 text-secondary' : 'bg-outline/20 text-outline'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default ZonalDashboardPage;
