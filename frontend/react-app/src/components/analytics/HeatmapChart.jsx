import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const HeatmapChart = ({ data = [], title = 'Activity Heatmap (Last 30 Days)' }) => {
  // Mocking a github-style contribution graph if data is empty or generic
  const renderGrid = () => {
    const days = 30;
    const grid = [];
    for (let i = 0; i < days; i++) {
      const val = data[i] || Math.floor(Math.random() * 5); // 0-4 intensity
      let colorClass = 'bg-slate-100';
      if (val === 1) colorClass = 'bg-blue-200';
      if (val === 2) colorClass = 'bg-blue-400';
      if (val === 3) colorClass = 'bg-blue-600';
      if (val >= 4) colorClass = 'bg-blue-800';

      grid.push(
        <div 
          key={i} 
          className={`w-4 h-4 rounded-sm ${colorClass}`}
          title={`Day ${i + 1}: ${val} activities`}
        />
      );
    }
    return grid;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mt-2">
          {renderGrid()}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-slate-100"></div>
            <div className="w-3 h-3 rounded-sm bg-blue-200"></div>
            <div className="w-3 h-3 rounded-sm bg-blue-400"></div>
            <div className="w-3 h-3 rounded-sm bg-blue-600"></div>
            <div className="w-3 h-3 rounded-sm bg-blue-800"></div>
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
};
