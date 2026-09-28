import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const PredictiveHotspots = ({ hotspots = [], title = 'Predictive Hotspots' }) => {
  return (
    <Card className="border-rose-100 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
      <CardHeader className="border-b border-rose-100/50 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10M12 22h.01M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>
          </div>
          <CardTitle className="text-rose-900">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {hotspots.length > 0 ? (
            hotspots.map((hotspot, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl border border-rose-50 shadow-sm transition-all hover:shadow-md">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{hotspot.district}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{hotspot.category}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <Badge variant={hotspot.probability >= 0.8 ? 'danger' : hotspot.probability >= 0.5 ? 'warning' : 'primary'} className="mb-1">
                    {Math.round(hotspot.probability * 100)}% Probability
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                    ETA: {hotspot.predicted_timeframe}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <p>No hotspots predicted at this time.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
