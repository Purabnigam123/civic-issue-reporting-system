import React, { useState } from 'react';

export const Tabs = ({ defaultValue, onValueChange, children, className = '', ...props }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (onValueChange) onValueChange(value);
  };

  return (
    <div className={className} {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          activeTab,
          onTabChange: handleTabChange,
        });
      })}
    </div>
  );
};

export const TabsList = ({ children, className = '', activeTab, onTabChange, ...props }) => {
  return (
    <div 
      className={`inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 ${className}`} 
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          isActive: child.props.value === activeTab,
          onClick: () => onTabChange(child.props.value),
        });
      })}
    </div>
  );
};

export const TabsTrigger = ({ value, isActive, onClick, children, className = '', ...props }) => {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive 
          ? 'bg-white text-slate-900 shadow-sm' 
          : 'hover:bg-slate-200/50 hover:text-slate-900'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, activeTab, children, className = '', ...props }) => {
  if (value !== activeTab) return null;
  
  return (
    <div
      role="tabpanel"
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
