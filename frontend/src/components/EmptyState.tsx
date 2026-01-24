import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="card bg-white text-center py-12">
      <Icon size={48} className="mx-auto text-gray-400 mb-4" />
      <p className="text-gray-800 text-lg font-semibold">{title}</p>
      {message && <p className="text-gray-600 mt-2 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export default EmptyState;
