import React from 'react';

const StatusBadge = ({ status }) => {
  const normalized = (status || '').toUpperCase();

  switch (normalized) {
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-fixed text-on-primary-fixed rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Submitted
        </span>
      );
    case 'UNDER_REVIEW':
    case 'UNDER REVIEW':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest text-on-primary-fixed-variant rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Under Review
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          Assigned
        </span>
      );
    case 'IN_PROGRESS':
    case 'IN PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-container text-on-primary-container rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container animate-pulse"></span>
          In Progress
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary-container/30 text-secondary rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          Resolved
        </span>
      );
    case 'RESOLUTION_SUBMITTED':
    case 'PENDING_VERIFICATION':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          Pending Verification
        </span>
      );
    case 'ESCALATED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-error-container text-on-error-container border border-error/40 rounded-full font-label-sm text-label-sm animate-pulse font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
          Escalated
        </span>
      );
    case 'REOPENED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-error-container text-error rounded-full font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
          Reopened
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-full font-label-sm text-label-sm border border-outline-variant/50">
          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
          {status}
        </span>
      );
  }
};

export default StatusBadge;
