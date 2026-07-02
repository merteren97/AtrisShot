"use client";

import { useEffect, useMemo, useState } from "react";
import { clearSession, hasProductAccess, login, restoreSession, type ShotSession } from "@/lib/auth-client";

const emptySession: ShotSession = {
  user: null,
  membership: { status: "unknown", plan: "Free" },
  offline: false,
};

export function useAuthSession() {
  const [session, setSession] = useState<ShotSession>(emptySession);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void restoreSession()
      .then(setSession)
      .finally(() => setChecking(false));
  }, []);

  const state = useMemo(() => {
    if (!session.user) return "signed-out";
    return hasProductAccess(session.membership, session.user) ? "authorized" : "signed-out";
  }, [session]);

  return {
    checking,
    session,
    state,
    login: async (email: string, password: string) => setSession(await login(email, password)),
    logout: async () => {
      await clearSession();
      setSession(emptySession);
    },
  };
}
