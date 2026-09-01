"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearSession,
  hasProductAccess,
  login,
  refreshSession,
  restoreSession,
  type ShotSession,
} from "@/lib/auth-client";

const emptySession: ShotSession = {
  user: null,
  membership: { status: "unknown", plan: "Free" },
  offline: false,
};
const ACCESS_REFRESH_LEAD_MS = 60 * 1000;
const REFRESH_RETRY_DELAY_MS = 60 * 1000;

export function useAuthSession() {
  const [session, setSession] = useState<ShotSession>(emptySession);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void restoreSession()
      .then(setSession)
      .catch((error) => {
        if (error instanceof Error && error.name === "AuthStateChangedError") return;
        setSession(emptySession);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!session.user || !session.sessionExpiresAtMs) return;
    let disposed = false;
    let timer: number | undefined;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        void refreshSession()
          .then((next) => {
            if (!disposed) setSession(next);
          })
          .catch(() => {
            if (!disposed) schedule(REFRESH_RETRY_DELAY_MS);
          });
      }, delay);
    };
    const delay = session.offline || !session.accessTokenExpiresAtMs
      ? REFRESH_RETRY_DELAY_MS
      : Math.max(5_000, session.accessTokenExpiresAtMs - Date.now() - ACCESS_REFRESH_LEAD_MS);
    schedule(delay);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [session.accessTokenExpiresAtMs, session.offline, session.sessionExpiresAtMs, session.user?.id]);

  const state = useMemo(() => {
    if (!session.user) return "signed-out";
    return hasProductAccess(session.membership, session.user) ? "authorized" : "signed-out";
  }, [session]);

  return {
    checking,
    session,
    state,
    login: async (email: string, password: string, rememberSession = true) =>
      setSession(await login(email, password, rememberSession)),
    logout: async () => {
      await clearSession();
      setSession(emptySession);
    },
  };
}
