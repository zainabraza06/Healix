import React from 'react';

interface PaginationProps {
  currentPage: number; // zero-based index
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition"
      >
        Previous
      </button>
      <span className="text-gray-700 font-semibold">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        onClick={() => canNext && onPageChange(currentPage + 1)}
        disabled={!canNext}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition"
      >
        Next
      </button>
    </div>
  );
}

export default Pagination;
