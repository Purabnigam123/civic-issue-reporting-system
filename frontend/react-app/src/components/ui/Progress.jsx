import React from 'react';

export const Progress = ({ value = 0, max = 100, className = '', colorClass = 'bg-blue-600', ...props }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className={`w-full bg-slate-100 rounded-full h-2.5 overflow-hidden ${className}`} {...props}>
      <div 
        className={`h-2.5 rounded-full transition-all duration-500 ease-in-out ${colorClass}`} 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};
