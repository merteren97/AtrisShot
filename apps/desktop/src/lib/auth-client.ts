import type {
  AtrisMembership,
  LoginResponse,
  SessionResponse,
  SessionUser,
} from "@atris-shot/api-contracts";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

const HUB_URL = (process.env.NEXT_PUBLIC_ATRIS_HUB_URL || "https://atrishub.com").replace(/\/$/, "");
const SESSION_META_KEY = "atrisshot-session-meta";
const MAX_OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;

class NetworkUnavailableError extends Error {}

export interface ShotSession {
  token?: string;
  user: SessionUser | null;
  membership: AtrisMembership;
  validatedAtMs?: number;
  offline: boolean;
}

const signedOut = (): ShotSession => ({
  user: null,
  membership: { status: "unknown", plan: "Free" },
  offline: false,
});

const hasProductAccess = (_membership: AtrisMembership, user: SessionUser | null) => Boolean(user);

const readMetadata = (): ShotSession => {
  if (typeof window === "undefined") return signedOut();
  try {
    const value = localStorage.getItem(SESSION_META_KEY);
    return value ? ({ ...signedOut(), ...JSON.parse(value) } as ShotSession) : signedOut();
  } catch {
    return signedOut();
  }
};

const persistMetadata = (session: ShotSession) => {
  localStorage.setItem(
    SESSION_META_KEY,
    JSON.stringify({
      user: session.user,
      membership: session.membership,
      validatedAtMs: session.validatedAtMs,
      offline: session.offline,
    }),
  );
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${HUB_URL}${path}`, init);
  } catch {
    throw new NetworkUnavailableError("AtrisHub is unreachable.");
  }
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `AtrisHub request failed (${response.status}).`);
  return data;
};

const normalizeMembership = (membership?: AtrisMembership): AtrisMembership =>
  membership || { status: "inactive", plan: "Free" };

export async function login(email: string, password: string, rememberSession = true): Promise<ShotSession> {
  const data = await request<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const membership = normalizeMembership(data.membership);
  const validatedAtMs = Date.now();
  const session: ShotSession = {
    token: data.token,
    user: data.user,
    membership,
    validatedAtMs,
    offline: false,
  };
  if (isNativeRuntime()) {
    if (rememberSession) await nativeRuntime.storeSessionToken(data.token);
    else await nativeRuntime.deleteSessionToken();
    if (hasProductAccess(membership, data.user)) {
      await nativeRuntime.authorizeProductAccess(validatedAtMs, false);
    } else {
      await nativeRuntime.revokeProductAccess();
    }
  }
  persistMetadata(session);
  return session;
}

export async function restoreSession(): Promise<ShotSession> {
  const cached = readMetadata();
  const token = isNativeRuntime() ? await nativeRuntime.readSessionToken() : undefined;
  if (!token || !cached.user) {
    if (!token && cached.user) localStorage.removeItem(SESSION_META_KEY);
    return signedOut();
  }
  try {
    const data = await request<SessionResponse>("/api/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const membership = normalizeMembership(data.membership);
    const validatedAtMs = Date.now();
    const session = {
      token,
      user: data.user,
      membership,
      validatedAtMs,
      offline: false,
    };
    if (hasProductAccess(membership, data.user)) {
      await nativeRuntime.authorizeProductAccess(validatedAtMs, false);
    } else {
      await nativeRuntime.revokeProductAccess();
    }
    persistMetadata(session);
    return session;
  } catch (error) {
    if (!(error instanceof NetworkUnavailableError)) {
      await clearSession();
      return signedOut();
    }
    const withinGrace =
      hasProductAccess(cached.membership, cached.user) &&
      cached.validatedAtMs !== undefined &&
      Date.now() - cached.validatedAtMs <= MAX_OFFLINE_GRACE_MS;
    if (withinGrace) {
      await nativeRuntime.authorizeProductAccess(cached.validatedAtMs!, true);
      const session = { ...cached, token, offline: true };
      persistMetadata(session);
      return session;
    }
    await nativeRuntime.revokeProductAccess();
    return signedOut();
  }
}

export async function clearSession() {
  localStorage.removeItem(SESSION_META_KEY);
  if (isNativeRuntime()) {
    await Promise.allSettled([
      nativeRuntime.deleteSessionToken(),
      nativeRuntime.revokeProductAccess(),
    ]);
  }
}

export { hasProductAccess };
