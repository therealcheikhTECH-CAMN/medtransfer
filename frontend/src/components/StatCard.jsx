import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue' }) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50 text-blue-700',
      border: 'border-blue-100',
      badge: 'text-[#1976D2]'
    },
    emerald: {
      bg: 'bg-emerald-50 text-emerald-700',
      border: 'border-emerald-100',
      badge: 'text-emerald-600'
    },
    amber: {
      bg: 'bg-amber-50 text-amber-700',
      border: 'border-amber-100',
      badge: 'text-amber-600'
    },
    rose: {
      bg: 'bg-rose-50 text-rose-700',
      border: 'border-rose-100',
      badge: 'text-rose-600'
    },
    purple: {
      bg: 'bg-purple-50 text-purple-700',
      border: 'border-purple-100',
      badge: 'text-purple-600'
    }
  };

  const style = colorMap[color] || colorMap.blue;

  return (
    <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow min-w-0">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate" title={title}>
            {title}
          </span>
          <span className="text-xl sm:text-2xl font-bold text-[#123B5D] block mt-1 truncate">
            {value !== undefined && value !== null ? value : '—'}
          </span>
          {subtitle && (
            <span className="text-[11px] sm:text-xs text-slate-500 mt-0.5 block truncate" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${style.bg} border ${style.border}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};
