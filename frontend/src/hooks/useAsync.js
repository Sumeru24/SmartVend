import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "../services/client";

export function useAsync(asyncFn, { immediate = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(apiErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!immediate) return;
    execute().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, execute, refresh: execute };
}
