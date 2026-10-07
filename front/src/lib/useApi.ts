"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Minimal data-fetching hook. Keeps the previous data while refetching (no flicker when filters change).
 * Pass null to skip the request.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
  const key = `${path}#${version}`;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => !cancelled && setState((prev) => ({ key, data: prev?.data, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state?.data,
    error: state?.key === key ? state.error : undefined,
    loading: path !== null && state?.key !== key,
    reload,
  };
}
