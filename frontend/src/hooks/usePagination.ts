import { useState } from 'react';

export function usePagination(initialPage = 0, totalPages = 1) {
  const [page, setPage] = useState(initialPage);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const next = () => setPage((p) => (p < totalPages - 1 ? p + 1 : p));
  const prev = () => setPage((p) => (p > 0 ? p - 1 : p));
  const goTo = (target: number) => setPage(() => Math.min(Math.max(target, 0), totalPages - 1));

  return { page, setPage: goTo, canPrev, canNext, next, prev };
}

export default usePagination;
