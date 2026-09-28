import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`p-6 pb-4 border-b border-slate-100 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-semibold text-slate-800 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);
