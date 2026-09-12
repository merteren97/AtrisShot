import type {
  AtrisMembership,
  DesktopAuthResponse,
  DesktopLoginRequest,
  DesktopLogoutRequest,
  DesktopRefreshRequest,
  SessionUser,
} from "@atris-shot/api-contracts";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

const HUB_URL = (process.env.NEXT_PUBLIC_ATRIS_HUB_URL || "https://atrishub.com").replace(/\/$/, "");
const LOGIN_PATH = "/api/desktop/v1/auth/login";
const REFRESH_PATH = "/api/desktop/v1/auth/refresh";
const LOGOUT_PATH = "/api/desktop/v1/auth/logout";
const SESSION_META_KEY = "atrisshot-session-meta";
const DEVICE_ID_KEY = "atrisshot-device-id";
const MAX_OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{12,128}$/;
const DESKTOP_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFRESH_TOKEN_PATTERN =
  /^abrt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{40,64}$/i;

class NetworkUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkUnavailableError";
  }
}

class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

class CredentialRejectedError extends RequestError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "CredentialRejectedError";
  }
}

class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

class AuthStateChangedError extends Error {
  constructor() {
    super("The desktop authentication state changed while the request was in flight.");
    this.name = "AuthStateChangedError";
  }
}

export interface ShotSession {
  appAccess?: { appId: string; allowed: boolean; mode: string; announcement: string };
  /** The access token is intentionally exposed only in this in-memory session object. */
  accessToken?: string;
  accessTokenExpiresAtMs?: number;
  user: SessionUser | null;
  membership: AtrisMembership;
  validatedAtMs?: number;
  sessionExpiresAtMs?: number;
  desktopSessionId?: string;
  sessionGeneration?: number;
  offline: boolean;
}

const signedOut = (): ShotSession => ({
  user: null,
  membership: { status: "unknown", plan: "Free" },
  offline: false,
});

const membershipStatuses = new Set<AtrisMembership["status"]>([
  "active",
  "inactive",
  "expired",
  "unknown",
]);
const membershipPlans = new Set<AtrisMembership["plan"]>(["Free", "Premium", "Admin"]);
const userRoles = new Set<SessionUser["role"]>(["USER", "MODERATOR", "ADMIN"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown, maxLength = 4096): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength && value.trim() === value;

const isMembership = (value: unknown): value is AtrisMembership =>
  isRecord(value) &&
  membershipStatuses.has(value.status as AtrisMembership["status"]) &&
  membershipPlans.has(value.plan as AtrisMembership["plan"]) &&
  (value.startsAt === undefined || typeof value.startsAt === "string") &&
  (value.endsAt === undefined || value.endsAt === null || typeof value.endsAt === "string");

const isSessionUser = (value: unknown): value is SessionUser =>
  isRecord(value) &&
  isNonEmptyString(value.id, 256) &&
  isNonEmptyString(value.username, 256) &&
  isNonEmptyString(value.email, 320) &&
  userRoles.has(value.role as SessionUser["role"]) &&
  (value.name === undefined || value.name === null || typeof value.name === "string") &&
  (value.avatarUrl === undefined || value.avatarUrl === null || typeof value.avatarUrl === "string") &&
  (value.locale === undefined || typeof value.locale === "string");

const normalizeMembership = (membership?: AtrisMembership): AtrisMembership =>
  membership && isMembership(membership) ? membership : { status: "inactive", plan: "Free" };

const hasProductAccess = (membership: AtrisMembership, user: SessionUser | null) => {
  if (!user) return false;
  // Free accounts do not need an active membership; paid/admin plans do.
  return membership.plan === "Free" || membership.status === "active";
};

const readMetadata = (): ShotSession => {
  if (typeof window === "undefined") return signedOut();
  try {
    const value = localStorage.getItem(SESSION_META_KEY);
    if (!value) return signedOut();
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return signedOut();

    const session: ShotSession = {
      user: isSessionUser(parsed.user) ? parsed.user : null,
      membership: normalizeMembership(isMembership(parsed.membership) ? parsed.membership : undefined),
      offline: parsed.offline === true,
    };
    if (isRecord(parsed.appAccess) && parsed.appAccess.appId === "shot" && typeof parsed.appAccess.allowed === "boolean" && typeof parsed.appAccess.mode === "string" && typeof parsed.appAccess.announcement === "string") session.appAccess = parsed.appAccess as NonNullable<ShotSession["appAccess"]>;
    if (typeof parsed.validatedAtMs === "number" && Number.isFinite(parsed.validatedAtMs)) {
      session.validatedAtMs = parsed.validatedAtMs;
    }
    if (typeof parsed.sessionExpiresAtMs === "number" && Number.isFinite(parsed.sessionExpiresAtMs)) {
      session.sessionExpiresAtMs = parsed.sessionExpiresAtMs;
    }
    if (typeof parsed.desktopSessionId === "string" && DESKTOP_SESSION_ID_PATTERN.test(parsed.desktopSessionId)) {
      session.desktopSessionId = parsed.desktopSessionId;
    }
    if (Number.isSafeInteger(parsed.sessionGeneration) && Number(parsed.sessionGeneration) >= 1) {
      session.sessionGeneration = Number(parsed.sessionGeneration);
    }
    return session;
  } catch {
    return signedOut();
  }
};

const persistMetadata = (session: ShotSession) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SESSION_META_KEY,
      JSON.stringify({
        user: session.user,
        membership: session.membership,
        appAccess: session.appAccess,
        validatedAtMs: session.validatedAtMs,
        sessionExpiresAtMs: session.sessionExpiresAtMs,
        desktopSessionId: session.desktopSessionId,
        sessionGeneration: session.sessionGeneration,
        offline: session.offline,
      }),
    );
  } catch {
    // A cache write must not turn a valid online session into a failed login.
  }
};

const removeMetadata = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_META_KEY);
  } catch {
    // Local storage is only a cache and may be unavailable in restricted webviews.
  }
};

let runtimeDeviceId: string | null = null;

const createDeviceId = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return `shot-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `shot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
};

const getDeviceId = () => {
  if (runtimeDeviceId) return runtimeDeviceId;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      if (stored && DEVICE_ID_PATTERN.test(stored)) {
        runtimeDeviceId = stored;
        return stored;
      }
    } catch {
      // Generate an in-memory identity when local storage is unavailable.
    }
  }

  const generated = createDeviceId();
  const resolvedDeviceId = DEVICE_ID_PATTERN.test(generated) ? generated : `shot-${Date.now().toString(36)}-device`;
  runtimeDeviceId = resolvedDeviceId;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DEVICE_ID_KEY, resolvedDeviceId);
    } catch {
      // The runtime identity remains stable for this process if persistence is unavailable.
    }
  }
  return resolvedDeviceId;
};

const getDevicePlatform = () => {
  const platform = typeof navigator !== "undefined" ? navigator.platform : "unknown";
  const normalized = platform.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 32);
  return normalized.length >= 2 ? normalized : "unknown";
};

const isRefreshToken = (value: unknown): value is string =>
  typeof value === "string" && REFRESH_TOKEN_PATTERN.test(value);

const parseExpiry = (value: unknown, field: string) => {
  if (!isNonEmptyString(value, 128)) throw new InvalidResponseError(`Desktop auth response has an invalid ${field}.`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new InvalidResponseError(`Desktop auth response has an expired ${field}.`);
  }
  return timestamp;
};

const validateDesktopAuthResponse = (value: unknown): DesktopAuthResponse => {
  if (!isRecord(value)) {
    throw new InvalidResponseError("AtrisHub returned an invalid desktop authentication response.");
  }
  const {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    sessionExpiresAt,
    desktopSessionId,
    sessionGeneration,
    user,
    membership,
  } = value;
  if (
    !isNonEmptyString(accessToken) ||
    !isNonEmptyString(refreshToken, 512) ||
    !isRefreshToken(refreshToken) ||
    !isNonEmptyString(accessTokenExpiresAt, 128) ||
    !isNonEmptyString(sessionExpiresAt, 128) ||
    !DESKTOP_SESSION_ID_PATTERN.test(String(desktopSessionId || "")) ||
    !Number.isSafeInteger(sessionGeneration) ||
    Number(sessionGeneration) < 1 ||
    !isSessionUser(user) ||
    !isMembership(membership)
  ) {
    throw new InvalidResponseError("AtrisHub returned an invalid desktop authentication response.");
  }
  const refreshSessionId = refreshToken.slice("abrt_".length, refreshToken.indexOf("."));
  if (refreshSessionId !== desktopSessionId) {
    throw new InvalidResponseError("AtrisHub returned mismatched desktop session credentials.");
  }

  const accessExpiryMs = parseExpiry(accessTokenExpiresAt, "accessTokenExpiresAt");
  const sessionExpiryMs = parseExpiry(sessionExpiresAt, "sessionExpiresAt");
  if (sessionExpiryMs < accessExpiryMs) {
    throw new InvalidResponseError("Desktop auth response has an invalid session expiry.");
  }
  return value as unknown as DesktopAuthResponse;
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    response = await fetch(`${HUB_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new NetworkUnavailableError("AtrisHub request timed out.");
    }
    throw new NetworkUnavailableError("AtrisHub is unreachable.");
  }

  try {
    if (response.status === 204) return undefined as T;

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) throw new NetworkUnavailableError("AtrisHub request timed out.");
      data = undefined;
    }

    if (!response.ok) {
      const message = isRecord(data) && typeof data.error === "string"
        ? data.error
        : `AtrisHub request failed (${response.status}).`;
      if (response.status === 401 || response.status === 403) {
        throw new CredentialRejectedError(response.status, message);
      }
      throw new RequestError(response.status, message);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
};

let memoryAccessToken: string | null = null;
let memoryAccessTokenExpiresAtMs = 0;
let memoryRefreshToken: string | null = null;
let refreshTokenIsPersistent = false;
let refreshInFlight: Promise<ShotSession> | null = null;
let restoreInFlight: Promise<ShotSession> | null = null;
let authGeneration = 0;

export async function fetchShotAccess(token: string, activity = false) {
  const result = await request<{ access: NonNullable<ShotSession["appAccess"]> }>(`/api/apps/shot/${activity ? "activity" : "access"}`, { method: activity ? "POST" : "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!result.access || result.access.appId !== "shot" || typeof result.access.allowed !== "boolean" || !["FREE", "PREVIEW", "PREMIUM"].includes(result.access.mode)) throw new InvalidResponseError("Invalid application access response.");
  return result.access;
}
export function rememberShotPolicy(session: ShotSession) { persistMetadata(session); }
export const hasShotAccess = (session: ShotSession) => session.appAccess?.allowed !== false && (session.offline ? hasProductAccess(session.membership, session.user) : session.appAccess?.allowed === true);

const clearMemoryAccessToken = () => {
  memoryAccessToken = null;
  memoryAccessTokenExpiresAtMs = 0;
};

const loadRefreshToken = async () => {
  if (memoryRefreshToken) return memoryRefreshToken;
  if (!isNativeRuntime()) return null;

  const stored = await nativeRuntime.readRefreshToken();
  // A concurrent refresh may have rotated the credential while the native read was pending.
  if (memoryRefreshToken) return memoryRefreshToken;
  if (stored === null) return null;
  memoryRefreshToken = stored;
  refreshTokenIsPersistent = true;
  return stored;
};

const refreshWithSingleFlight = (
  refreshToken: string,
  persistRefreshToken: boolean,
  expectedGeneration: number,
): Promise<ShotSession> => {
  if (refreshInFlight) return refreshInFlight;
  const body: DesktopRefreshRequest = { refreshToken };
  const operation = request<unknown>(REFRESH_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(validateDesktopAuthResponse)
    .then((data) => applyAuthResponse(data, persistRefreshToken, expectedGeneration));
  const shared = operation.finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = shared;
  return shared;
};

async function applyAuthResponse(
  data: DesktopAuthResponse,
  persistRefreshToken: boolean,
  expectedGeneration: number,
): Promise<ShotSession> {
  const response = validateDesktopAuthResponse(data);
  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();

  const now = Date.now();
  const accessTokenExpiresAtMs = parseExpiry(response.accessTokenExpiresAt, "accessTokenExpiresAt");
  const sessionExpiresAtMs = parseExpiry(response.sessionExpiresAt, "sessionExpiresAt");
  memoryAccessToken = response.accessToken;
  memoryAccessTokenExpiresAtMs = accessTokenExpiresAtMs;
  memoryRefreshToken = response.refreshToken;
  refreshTokenIsPersistent = persistRefreshToken;

  if (isNativeRuntime()) {
    if (persistRefreshToken) await nativeRuntime.storeRefreshToken(response.refreshToken);
    else await nativeRuntime.deleteRefreshToken();
  }
  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();

  const appAccess = await fetchShotAccess(response.accessToken);
  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();
  const session: ShotSession = {
    appAccess,
    accessToken: response.accessToken,
    accessTokenExpiresAtMs,
    user: response.user,
    membership: normalizeMembership(response.membership),
    validatedAtMs: now,
    sessionExpiresAtMs,
    desktopSessionId: response.desktopSessionId,
    sessionGeneration: response.sessionGeneration,
    offline: false,
  };
  if (isNativeRuntime()) {
    if (appAccess.allowed) {
      await nativeRuntime.authorizeProductAccess(now, false, sessionExpiresAtMs);
    } else {
      await nativeRuntime.revokeProductAccess();
    }
  }
  persistMetadata(session);
  return session;
}

const clearLocalSession = async (expectedGeneration?: number) => {
  if (expectedGeneration !== undefined && expectedGeneration !== authGeneration) return;
  clearMemoryAccessToken();
  memoryRefreshToken = null;
  refreshTokenIsPersistent = false;
  removeMetadata();
  if (isNativeRuntime()) {
    if (expectedGeneration !== undefined && expectedGeneration !== authGeneration) return;
    await Promise.allSettled([
      nativeRuntime.deleteRefreshToken(),
      nativeRuntime.revokeProductAccess(),
    ]);
  }
};

const restoreOffline = async (cached: ShotSession, expectedGeneration: number): Promise<ShotSession> => {
  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();
  const now = Date.now();
  const validatedAtMs = cached.validatedAtMs;
  const sessionExpiresAtMs = cached.sessionExpiresAtMs;
  const graceUntilMs =
    validatedAtMs === undefined || sessionExpiresAtMs === undefined
      ? 0
      : Math.min(validatedAtMs + MAX_OFFLINE_GRACE_MS, sessionExpiresAtMs);
  const withinGrace =
    cached.appAccess?.allowed !== false && hasProductAccess(cached.membership, cached.user) &&
    validatedAtMs !== undefined &&
    sessionExpiresAtMs !== undefined &&
    validatedAtMs <= now + MAX_CLOCK_SKEW_MS &&
    sessionExpiresAtMs > now &&
    graceUntilMs > now;

  if (!withinGrace) {
    clearMemoryAccessToken();
    if (isNativeRuntime()) await nativeRuntime.revokeProductAccess();
    return signedOut();
  }

  if (isNativeRuntime()) {
    // The native command only accepts a validation timestamp, so move the anchor back
    // when the desktop session expires before the normal 24-hour offline window.
    const offlineValidatedAtMs = graceUntilMs - MAX_OFFLINE_GRACE_MS;
    try {
      await nativeRuntime.authorizeProductAccess(offlineValidatedAtMs, true, sessionExpiresAtMs);
    } catch {
      clearMemoryAccessToken();
      return signedOut();
    }
  }
  if (expectedGeneration !== authGeneration) {
    if (isNativeRuntime()) await nativeRuntime.revokeProductAccess();
    throw new AuthStateChangedError();
  }

  const session: ShotSession = {
    ...cached,
    accessToken: memoryAccessTokenExpiresAtMs > now ? memoryAccessToken || undefined : undefined,
    accessTokenExpiresAtMs: memoryAccessTokenExpiresAtMs > now ? memoryAccessTokenExpiresAtMs : undefined,
    offline: true,
  };
  persistMetadata(session);
  return session;
};

const restoreSessionInternal = async (): Promise<ShotSession> => {
  const expectedGeneration = authGeneration;
  const cached = readMetadata();
  let refreshToken: string | null;
  try {
    refreshToken = await loadRefreshToken();
  } catch {
    // A native storage failure is not proof that the credential is invalid.
    return restoreOffline(cached, expectedGeneration);
  }

  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();
  if (!refreshToken) {
    await clearLocalSession(expectedGeneration);
    return signedOut();
  }
  if (!isRefreshToken(refreshToken)) {
    await clearLocalSession(expectedGeneration);
    return signedOut();
  }

  try {
    return await refreshWithSingleFlight(refreshToken, refreshTokenIsPersistent, expectedGeneration);
  } catch (error) {
    if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();
    if (error instanceof AuthStateChangedError) throw error;
    if (error instanceof CredentialRejectedError) {
      await clearLocalSession(expectedGeneration);
      return signedOut();
    }
    clearMemoryAccessToken();
    // Network, timeout, and server/response failures retain the refresh credential for a later retry.
    return restoreOffline(cached, expectedGeneration);
  }
};

export async function login(
  email: string,
  password: string,
  rememberSession = true,
): Promise<ShotSession> {
  const expectedGeneration = ++authGeneration;
  try {
    const body: DesktopLoginRequest = {
      email,
      password,
      deviceId: getDeviceId(),
      deviceName: "AtrisShot Desktop",
      platform: getDevicePlatform(),
    };
    const data = validateDesktopAuthResponse(
      await request<unknown>(LOGIN_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return await applyAuthResponse(data, rememberSession && isNativeRuntime(), expectedGeneration);
  } catch (error) {
    // A desktop credential is provisional until the current Hub application
    // policy has been checked. Remove any token staged by applyAuthResponse
    // when the policy/response validation fails during a fresh login.
    if (expectedGeneration === authGeneration) await clearLocalSession(expectedGeneration);
    throw error;
  }
}

export function restoreSession(): Promise<ShotSession> {
  if (restoreInFlight) return restoreInFlight;
  const operation = restoreSessionInternal();
  const shared = operation.finally(() => {
    restoreInFlight = null;
  });
  restoreInFlight = shared;
  return shared;
}

export async function refreshSession(): Promise<ShotSession> {
  const expectedGeneration = authGeneration;
  const refreshToken = await loadRefreshToken();
  if (expectedGeneration !== authGeneration) throw new AuthStateChangedError();
  if (!refreshToken) {
    await clearLocalSession(expectedGeneration);
    return signedOut();
  }
  if (!isRefreshToken(refreshToken)) {
    await clearLocalSession(expectedGeneration);
    return signedOut();
  }

  try {
    return await refreshWithSingleFlight(refreshToken, refreshTokenIsPersistent, expectedGeneration);
  } catch (error) {
    if (expectedGeneration !== authGeneration || error instanceof AuthStateChangedError) throw error;
    if (error instanceof CredentialRejectedError) {
      await clearLocalSession(expectedGeneration);
      return signedOut();
    }
    throw error;
  }
}

export async function clearSession() {
  const logoutGeneration = ++authGeneration;
  const pendingRefresh = refreshInFlight;
  if (pendingRefresh) await pendingRefresh.catch(() => undefined);
  let refreshToken = memoryRefreshToken;
  if (!refreshToken && isNativeRuntime()) {
    try {
      const stored = await nativeRuntime.readRefreshToken();
      refreshToken = memoryRefreshToken || stored;
    } catch {
      refreshToken = null;
    }
  }

  if (isRefreshToken(refreshToken)) {
    try {
      const body: DesktopLogoutRequest = { refreshToken };
      await request<void>(LOGOUT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Logout is best effort; local credentials must still be removed.
    }
  }
  if (authGeneration === logoutGeneration) await clearLocalSession(logoutGeneration);
}

export { hasProductAccess };
