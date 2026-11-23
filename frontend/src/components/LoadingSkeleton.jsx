import React from 'react';

export const LoadingSkeleton = ({ lines = 4, type = 'card' }) => {
  if (type === 'table') {
    return (
      <div className="w-full bg-white rounded-xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
        <div className="h-8 bg-slate-100 rounded w-full mb-4" />
        {[...Array(lines)].map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200/80 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/3" />
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <div key={i} className="h-4 bg-slate-100 rounded w-full" />
        ))}
      </div>
    </div>
  );
};
