import { useEffect, useState, useCallback } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
  deps?: any[];
}

export function useApi<T>(fn: () => Promise<T>, options: UseApiOptions<T> = {}) {
  const { immediate = true, onSuccess, onError, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<unknown>(null);

  const execute = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      setError(err);
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, execute]);

  return { data, isLoading, error, refetch: execute };
}

export default useApi;
