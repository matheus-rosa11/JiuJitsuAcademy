"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export interface SessionUser {
  userId: string;
  email: string;
  role: "Admin" | "Student";
  studentId: string | null;
  name: string;
}

const SessionContext = createContext<{ user: SessionUser | null; loading: boolean; refresh: () => void }>({
  user: null,
  loading: true,
  refresh: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ ready: boolean; user: SessionUser | null }>({ ready: false, user: null });

  useEffect(() => {
    let cancelled = false;
    api<SessionUser>("/auth/me")
      .then((user) => !cancelled && setState({ ready: true, user }))
      .catch(() => !cancelled && setState({ ready: true, user: null }));
    return () => {
      cancelled = true;
    };
  }, [version]);

  function refresh() {
    setState((current) => ({ ready: false, user: current.user }));
    setVersion((current) => current + 1);
  }

  return (
    <SessionContext.Provider value={{ user: state.user, loading: !state.ready, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
