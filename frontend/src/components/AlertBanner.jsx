import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export const AlertBanner = ({ type = 'warning', title, message, action, className = '' }) => {
  const types = {
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      textTitle: 'text-amber-900',
      textBody: 'text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
    },
    danger: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      textTitle: 'text-rose-900',
      textBody: 'text-rose-800',
      icon: AlertCircle,
      iconColor: 'text-rose-600',
    },
    info: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      textTitle: 'text-sky-900',
      textBody: 'text-sky-800',
      icon: Info,
      iconColor: 'text-sky-600',
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      textTitle: 'text-emerald-900',
      textBody: 'text-emerald-800',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
  };

  const current = types[type] || types.info;
  const IconComponent = current.icon;

  return (
    <div className={`p-4 rounded-xl border ${current.bg} ${current.border} ${className}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${current.iconColor}`} />
        <div className="flex-1">
          {title && <h4 className={`text-sm font-bold ${current.textTitle} mb-0.5`}>{title}</h4>}
          {message && <p className={`text-xs ${current.textBody} leading-relaxed`}>{message}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
};
