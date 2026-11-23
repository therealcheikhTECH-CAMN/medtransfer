import React from 'react';
import { getStatusBadgeStyle } from '../utils/formatters';

export const Badge = ({ children, status, className = '' }) => {
  const baseStyle = getStatusBadgeStyle(status || children);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${baseStyle} ${className}`}>
      {children}
    </span>
  );
};
