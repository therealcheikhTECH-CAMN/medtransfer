import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ title = "Aucune donnée disponible", message, icon: Icon = Inbox, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
      <div className="p-4 mb-3 rounded-full bg-slate-50 text-slate-400">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-sm font-semibold text-[#123B5D] mb-1">{title}</h4>
      {message && <p className="text-xs text-slate-500 max-w-sm mb-4">{message}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
