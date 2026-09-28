import React from 'react';

export const Badge = ({ children, variant = 'default', className = '', ...props }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    outline: 'border border-slate-200 text-slate-800 bg-transparent'
  };

  const selectedVariant = variants[variant] || variants.default;

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedVariant} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
