"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearSession,
  hasShotAccess,
  fetchShotAccess,
  rememberShotPolicy,
  login,
  refreshSession,
  restoreSession,
  type ShotSession,
} from "@/lib/auth-client";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

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
    if (!session.accessToken || session.offline) return;
    const token = session.accessToken;
    let disposed = false;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const appAccess = await fetchShotAccess(token);
        if (disposed) return;
        setSession(current => {
          if (current.accessToken !== token) return current;
          const next = { ...current, appAccess }; rememberShotPolicy(next); return next;
        });
        if (!appAccess.allowed && isNativeRuntime()) await nativeRuntime.revokeProductAccess();
        if (appAccess.allowed && !disposed) await fetchShotAccess(token, true);
      } catch { /* The existing refresh loop reconciles expired credentials. */ }
      finally { busy = false; }
    };
    void tick(); const timer = setInterval(tick, 60000);
    return () => { disposed = true; clearInterval(timer); };
  }, [session.accessToken, session.offline]);

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
    return hasShotAccess(session) ? "authorized" : "signed-out";
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
