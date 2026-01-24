'use client';

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function Spinner({ size = 'md', message }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeMap[size]}`}
        aria-label="Loading"
      />
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}

export default Spinner;
