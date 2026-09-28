import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const AIInsightsPanel = ({ insights = [], title = 'AI Insights & Recommendations' }) => {
  return (
    <Card className="border-indigo-100 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
      <CardHeader className="border-b border-indigo-100/50 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <CardTitle className="text-indigo-900">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div key={idx} className="flex gap-4 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm transition-all hover:shadow-md">
                <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
                  insight.type === 'warning' ? 'bg-amber-500' :
                  insight.type === 'critical' ? 'bg-red-500' :
                  'bg-indigo-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-900">{insight.title}</h4>
                    <Badge variant={insight.type === 'critical' ? 'danger' : insight.type === 'warning' ? 'warning' : 'primary'}>
                      {insight.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              No AI insights currently generated.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
