import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';

export const WorkerLeaderboard = ({ data = [], title = 'Top Performers' }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length > 0 ? (
            data.map((worker, index) => (
              <div key={worker.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-slate-200 text-slate-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  <Avatar fallback={worker.name.charAt(0).toUpperCase()} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{worker.name}</p>
                    <p className="text-xs text-slate-500">{worker.district}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{worker.resolvedCount}</p>
                  <p className="text-xs text-slate-500">Resolved</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No top performers data available.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
