import React from 'react';

export const Avatar = ({ src, fallback, className = '', ...props }) => {
  return (
    <div 
      className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`} 
      {...props}
    >
      {src ? (
        <img src={src} alt="Avatar" className="aspect-square h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-slate-700 font-medium text-sm">
          {fallback || '?'}
        </div>
      )}
    </div>
  );
};
