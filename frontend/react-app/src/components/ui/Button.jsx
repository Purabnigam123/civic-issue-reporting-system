import React from 'react';

export const Button = React.forwardRef(({ 
  className = '', 
  variant = 'default', 
  size = 'default', 
  children, 
  ...props 
}, ref) => {
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    outline: 'border border-slate-200 bg-white hover:bg-slate-100 text-slate-900',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    ghost: 'hover:bg-slate-100 hover:text-slate-900 text-slate-700',
    link: 'text-blue-600 underline-offset-4 hover:underline'
  };

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10'
  };

  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
