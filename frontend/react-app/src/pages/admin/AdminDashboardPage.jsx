import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminHeatmap from '../../components/admin/AdminHeatmap';
import { adminService } from '../../services/adminService';
import { AIInsightsPanel } from '../../components/admin/AIInsightsPanel';
import { PredictiveHotspots } from '../../components/admin/PredictiveHotspots';
import StatusBadge from '../../components/ui/StatusBadge';

const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [insights, setInsights] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [escalatedList, setEscalatedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const fetchMetricsAndData = async () => {
    try {
      setLoading(true);
      const [mRes, aRes, advRes, iRes, pRes, escRes] = await Promise.all([
        adminService.getMetrics(),
        adminService.getAnalytics().catch(() => null),
        adminService.getAdvancedAnalytics().catch(() => null),
        adminService.getAiInsights().catch(() => null),
        adminService.getPredictions().catch(() => null),
        adminService.getEscalatedComplaints().catch(() => ({ complaints: [] })),
      ]);
      if (mRes && mRes.metrics) {
        setMetrics(mRes.metrics);
      }
      if (aRes && aRes.analytics) {
        setAnalytics(aRes.analytics);
      }
      if (advRes && advRes.data) {
        setAdvancedAnalytics(advRes.data);
      }
      if (iRes && iRes.success) {
        setInsights(iRes.data);
      }
      if (pRes && pRes.success) {
        setPredictions(pRes.data);
      }
      if (escRes && escRes.complaints) {
        setEscalatedList(escRes.complaints);
      }
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndData();
  }, []);

  const handleSlaScan = async () => {
    try {
      setScanning(true);
      setScanMessage('');
      const res = await adminService.triggerSlaScan();
      const count = res?.result?.escalated_count || 0;
      setScanMessage(`Scan completed: ${count} breached complaint(s) auto-escalated.`);
      fetchMetricsAndData();
    } catch (err) {
      setScanMessage('Failed to run SLA scan.');
    } finally {
      setScanning(false);
    }
  };

  const maxTrend = analytics?.trend ? Math.max(...analytics.trend.map(t => Math.max(t.complaints, t.resolved, 1)), 5) : 10;

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-outline-variant/30">
          <div>
            <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
              <span className="material-symbols-outlined text-secondary text-sm">eco</span>
              <span>Municipal Telemetry & Executive Governance</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              City-Wide Command Center
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Live Delhi NCT municipal performance, cross-district operations, SLA tracking, and auto-escalated incident resolution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSlaScan}
              disabled={scanning}
              className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${scanning ? 'animate-spin' : ''}`}>
                sync
              </span>
              {scanning ? 'Scanning SLAs...' : 'Run SLA Breach Scan'}
            </button>
            <button
              type="button"
              onClick={fetchMetricsAndData}
              className="p-2 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant border border-outline-variant/30 rounded-xl text-xs transition-colors shadow-sm"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="mb-6 p-4 rounded-xl bg-primary-fixed/40 border border-primary/20 text-on-primary-fixed-variant text-xs flex items-center justify-between animate-fade-in font-medium">
            <span>{scanMessage}</span>
            <button type="button" onClick={() => setScanMessage('')} className="font-bold ml-2">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-on-surface-variant mt-4 font-semibold">Aggregating municipal telemetry...</p>
          </div>
        ) : metrics ? (
          <div className="space-y-8">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 w-full bg-primary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Registered</span>
                  <span className="p-2 rounded-xl bg-primary-fixed/60 text-primary material-symbols-outlined text-xl">
                    folder_open
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-on-surface">{metrics.total_complaints}</p>
                <p className="text-[11px] text-on-surface-variant mt-2 font-medium">All time civic complaints</p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 w-full bg-secondary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Resolved / Verified</span>
                  <span className="p-2 rounded-xl bg-secondary-fixed/40 text-secondary material-symbols-outlined text-xl">
                    task_alt
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-secondary">{metrics.resolved_count}</p>
                <p className="text-[11px] text-on-surface-variant mt-2 font-medium">
                  {Math.round((metrics.resolved_count / Math.max(metrics.total_complaints, 1)) * 100)}% resolution rate
                </p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow relative overflow-hidden group">
                <div className="absolute top-0 left-0 h-1 w-full bg-tertiary"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Active in Field</span>
                  <span className="p-2 rounded-xl bg-tertiary-fixed/60 text-tertiary material-symbols-outlined text-xl">
                    engineering
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-tertiary">{metrics.in_progress_count}</p>
                <p className="text-[11px] text-on-surface-variant mt-2 font-medium">Assigned & actively repairing</p>
              </div>

              <Link
                to="/admin/escalations"
                className="p-5 bg-surface-container-lowest hover:bg-surface-container-low rounded-2xl border border-outline-variant/30 hover:border-error/50 civic-glow relative overflow-hidden group transition-all block"
              >
                <div className="absolute top-0 left-0 h-1 w-full bg-error"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant group-hover:text-error transition-colors">Escalated / Breached</span>
                  <span className="p-2 rounded-xl bg-error-container/50 text-error material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                    crisis_alert
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-error">{escalatedList.length || metrics.escalated_count}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-on-surface-variant font-medium">Requiring Super Admin Action</p>
                  <span className="text-[11px] text-error font-extrabold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    Manage <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </span>
                </div>
              </Link>
            </div>

            {/* Geospatial Incident Density & Heatmap Layer */}
            <AdminHeatmap />

            {/* Dedicated Escalations Alert Banner (Links to dedicated /admin/escalations page) */}
            {escalatedList.length > 0 && (
              <div className="p-4 bg-error-container/30 border border-error/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 civic-glow animate-fade-in shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-error text-white flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-xl animate-pulse">crisis_alert</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-on-surface flex items-center gap-2">
                      <span>{escalatedList.length} Civic Issues Breached Resolution SLA</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-error text-white">Action Required</span>
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Complaints exceeding target deadlines have been moved to the dedicated Escalation Command Center.
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/escalations"
                  className="px-4 py-2 bg-error hover:bg-error/90 text-white rounded-xl text-xs font-bold shadow-md shadow-error/20 flex items-center gap-1.5 transition-all"
                >
                  <span>Open Escalation Desk</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                EXPANDED CHARTS SECTION: ADVANCED MUNICIPAL ANALYTICS GRAPHS
               ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* GRAPH 1: District Escalation & Workload Distribution */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">bar_chart</span>
                      District Escalation & Risk Distribution
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Comparative breakdown of active, resolved, and escalated complaints across Delhi
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-secondary">
                      <span className="w-2.5 h-2.5 rounded bg-secondary"></span> Resolved
                    </span>
                    <span className="flex items-center gap-1 text-primary">
                      <span className="w-2.5 h-2.5 rounded bg-primary"></span> Active
                    </span>
                    <span className="flex items-center gap-1 text-error">
                      <span className="w-2.5 h-2.5 rounded bg-error"></span> Escalated
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {(advancedAnalytics?.districts || Object.entries(metrics.district_stats || {}).map(([k, v]) => ({
                    district_id: k,
                    district_name: v.name,
                    total: v.total,
                    resolved: v.resolved,
                    in_progress: v.total - v.resolved,
                    escalated: 0,
                    escalation_rate: 0,
                  }))).slice(0, 7).map((d) => {
                    const total = Math.max(d.total, 1);
                    const resPct = Math.round((d.resolved / total) * 100);
                    const escPct = Math.round(((d.escalated || 0) / total) * 100);
                    const actPct = Math.max(0, 100 - resPct - escPct);

                    return (
                      <div key={d.district_id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-on-surface font-bold capitalize">{d.district_name || d.district_id?.replace('_', ' ')}</span>
                          <span className="text-on-surface-variant text-[11px]">
                            {d.total} issues {d.escalated > 0 && <span className="text-error font-bold">({d.escalated} escalated)</span>}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex border border-outline-variant/20">
                          <div style={{ width: `${resPct}%` }} className="bg-secondary h-full" title={`Resolved: ${d.resolved}`}></div>
                          <div style={{ width: `${actPct}%` }} className="bg-primary h-full" title={`Active: ${d.in_progress}`}></div>
                          <div style={{ width: `${escPct}%` }} className="bg-error h-full" title={`Escalated: ${d.escalated}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRAPH 2: Municipal Department Resolution Efficiency */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-lg">donut_large</span>
                      Departmental Resolution Efficiency
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Execution speed and completion rate across civic maintenance wings
                    </p>
                  </div>
                  <span className="text-xs font-black text-secondary bg-secondary/10 px-2.5 py-1 rounded-full border border-secondary/20">
                    City SLA: {metrics.sla_compliance_rate}%
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {(advancedAnalytics?.departments || [
                    { department: 'Roads Department', total: 14, resolved: 9, efficiency: 64.3 },
                    { department: 'Electrical Department', total: 10, resolved: 8, efficiency: 80.0 },
                    { department: 'Sanitation Department', total: 18, resolved: 14, efficiency: 77.8 },
                    { department: 'Water Supply Department', total: 12, resolved: 8, efficiency: 66.7 },
                    { department: 'Drainage Department', total: 9, resolved: 6, efficiency: 66.7 },
                    { department: 'Public Works Department', total: 8, resolved: 6, efficiency: 75.0 },
                  ]).map((dept) => {
                    const eff = dept.efficiency || Math.round((dept.resolved / Math.max(dept.total, 1)) * 100);
                    return (
                      <div key={dept.department} className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-on-surface block">{dept.department}</span>
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            {dept.resolved} of {dept.total} resolved
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-500"
                              style={{ width: `${eff}%` }}
                            ></div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                            eff >= 80 ? 'bg-secondary/20 text-secondary' : 'bg-amber-500/20 text-amber-700'
                          }`}>
                            {eff}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Insights & Predictions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIInsightsPanel insights={insights} />
              <PredictiveHotspots hotspots={predictions} />
            </div>

            {/* Middle Grid: Category Breakdown & Secondary KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown */}
              <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">category</span>
                  Issues by Category
                </h3>
                <div className="space-y-3">
                  {metrics.category_counts?.map((cat) => {
                    const pct = Math.round((cat.count / Math.max(metrics.total_complaints, 1)) * 100);
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="capitalize text-on-surface">{cat.category.replace('_', ' ')}</span>
                          <span className="text-on-surface-variant">{cat.count} reports ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant/20">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow flex items-center justify-between">
                  <div>
                    <span className="text-xs text-on-surface-variant block font-bold uppercase tracking-wider">SLA Compliance Rate</span>
                    <span className="text-2xl font-black text-primary">{metrics.sla_compliance_rate}%</span>
                  </div>
                  <span className="material-symbols-outlined text-primary text-3xl">speed</span>
                </div>

                <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow flex items-center justify-between">
                  <div>
                    <span className="text-xs text-on-surface-variant block font-bold uppercase tracking-wider">Suspicious Reports Flagged</span>
                    <span className="text-2xl font-black text-tertiary">{metrics.suspicious_count}</span>
                  </div>
                  <span className="material-symbols-outlined text-tertiary text-3xl">shield</span>
                </div>

                <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 civic-glow flex items-center justify-between">
                  <div>
                    <span className="text-xs text-on-surface-variant block font-bold uppercase tracking-wider">Total Registered Field Crew</span>
                    <span className="text-2xl font-black text-secondary">{metrics.total_workers}</span>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-3xl">badge</span>
                </div>
              </div>
            </div>

            {/* 7-Day Citywide Activity Trend */}
            {analytics?.trend && analytics.trend.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">stacked_bar_chart</span>
                      City-Wide 7-Day Operational Activity
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Total citizen complaints logged vs resolved across all districts</p>
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
                          <div
                            className="w-3 sm:w-5 bg-primary rounded-t-md transition-all group-hover:opacity-80 relative"
                            style={{ height: `${Math.max(filedPct, 4)}%` }}
                            title={`${day.complaints} complaints filed`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-container-high px-1 py-0.5 rounded text-[9px] font-bold text-primary">
                              {day.complaints}
                            </span>
                          </div>
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

            {/* Top Field Workers Leaderboard */}
            {analytics?.workers && analytics.workers.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">military_tech</span>
                    City-Wide Field Worker Performance Leaderboard
                  </h3>
                  <span className="text-xs text-on-surface-variant font-bold">Top Crew Across Districts</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/20 text-on-surface-variant font-extrabold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Worker</th>
                        <th className="pb-3">Worker ID</th>
                        <th className="pb-3">District</th>
                        <th className="pb-3 text-center">Active</th>
                        <th className="pb-3 text-center">Resolved</th>
                        <th className="pb-3 text-center">Resolution Rate</th>
                        <th className="pb-3 text-right pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {analytics.workers.map((w, index) => (
                        <tr key={w.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="py-3 pl-2 font-bold text-on-surface flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              index === 0 ? 'bg-amber-400/20 text-amber-500 font-extrabold' :
                              index === 1 ? 'bg-slate-300/20 text-slate-400 font-extrabold' :
                              index === 2 ? 'bg-amber-700/20 text-amber-700 font-extrabold' : 'text-outline'
                            }`}>
                              #{index + 1}
                            </span>
                            {w.name}
                          </td>
                          <td className="py-3 font-mono text-outline">{w.worker_id}</td>
                          <td className="py-3 capitalize text-on-surface-variant">{w.district_id?.replace('_', ' ')}</td>
                          <td className="py-3 text-center font-bold text-primary">{w.active}</td>
                          <td className="py-3 text-center font-bold text-secondary">{w.completed}</td>
                          <td className="py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary-fixed/20 text-primary">
                              {w.rate}%
                            </span>
                          </td>
                          <td className="py-3 text-right pr-2">
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

            {/* District Breakdown Table */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 civic-glow">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">map</span>
                Delhi NCT 13 Districts Performance
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-bold uppercase">
                      <th className="py-3.5 px-4 rounded-l-lg">District</th>
                      <th className="py-3.5 px-4">Total Reports</th>
                      <th className="py-3.5 px-4">Resolved</th>
                      <th className="py-3.5 px-4">Resolution %</th>
                      <th className="py-3.5 px-4 rounded-r-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {metrics.district_stats && Object.entries(metrics.district_stats).map(([key, val]) => {
                      const resPct = val.total > 0 ? Math.round((val.resolved / val.total) * 100) : 0;
                      return (
                        <tr key={key} className="hover:bg-surface-container-low/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-on-surface">{val.name}</td>
                          <td className="py-3.5 px-4 text-on-surface-variant">{val.total}</td>
                          <td className="py-3.5 px-4 text-secondary font-bold">{val.resolved}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant/20">
                                <div
                                  className="h-full bg-secondary rounded-full"
                                  style={{ width: `${resPct}%` }}
                                ></div>
                              </div>
                              <span className="text-[11px] text-on-surface-variant font-semibold">{resPct}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              resPct >= 70 ? 'bg-secondary-fixed/40 text-secondary' : 'bg-tertiary-fixed/60 text-tertiary'
                            }`}>
                              {resPct >= 70 ? 'Optimal' : 'Needs Focus'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default AdminDashboardPage;
