import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { adminService } from '../../services/adminService';

const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAuditLogs({ limit: 60 });
      if (data && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex min-h-screen bg-background text-on-background font-body-md antialiased">
      <AdminSidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-outline-variant/30">
          <div>
            <div className="inline-flex items-center gap-2 bg-surface-container-highest text-on-primary-fixed-variant px-3 py-1 rounded-full font-label-sm text-label-sm mb-2">
              <span className="material-symbols-outlined text-primary text-sm">history</span>
              <span>Municipal Audit & Traceability</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              System Audit Trail
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Cryptographically logged, immutable history of administrative overrides, assignments, and SLA triggers
            </p>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="px-4 py-2 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface border border-outline-variant/30 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh Trail
          </button>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden civic-glow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant mt-3 font-semibold">Fetching audit records...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant text-sm">No audit records logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant font-bold uppercase">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Target Type</th>
                    <th className="py-3.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary-fixed text-on-primary-fixed-variant border border-primary/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface font-sans">
                        <span className="font-bold">{log.actor_name || 'System'}</span>{' '}
                        <span className="text-[10px] text-on-surface-variant">({log.actor_role})</span>
                      </td>
                      <td className="py-3.5 px-4 uppercase text-on-surface-variant text-[11px] font-sans font-semibold">
                        {log.target_type}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface font-sans text-xs">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminAuditLogsPage;
