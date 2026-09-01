export type MembershipStatus = "active" | "inactive" | "expired" | "unknown";
export type MembershipPlan = "Free" | "Premium" | "Admin";

export interface AtrisMembership {
  status: MembershipStatus;
  plan: MembershipPlan;
  startsAt?: string;
  endsAt?: string | null;
}

export interface AtrisEntitlement extends AtrisMembership {
  product: string;
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  locale?: string;
}

export interface AtrisSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: SessionUser;
  membership: AtrisMembership;
  sessionExpiresAt: string;
  desktopSessionId: string;
  sessionGeneration: number;
}

export interface DesktopDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
}

export interface DesktopLoginRequest extends DesktopDevice {
  email: string;
  password: string;
}

export interface DesktopAuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  sessionExpiresAt: string;
  desktopSessionId: string;
  sessionGeneration: number;
  user: SessionUser;
  membership: AtrisMembership;
  entitlement?: AtrisEntitlement;
}

export type DesktopLoginResponse = DesktopAuthResponse;
export type DesktopRefreshResponse = DesktopAuthResponse;

export interface DesktopSessionResponse {
  user: SessionUser;
  membership: AtrisMembership;
  entitlement?: AtrisEntitlement;
  desktopSessionId: string;
  sessionGeneration: number;
}

export type DesktopMeResponse = DesktopSessionResponse;

export interface DesktopRefreshRequest {
  refreshToken: string;
}

export interface DesktopLogoutRequest {
  refreshToken: string;
}

export type LoginRequest = DesktopLoginRequest;
export type LoginResponse = DesktopAuthResponse;
export type SessionResponse = DesktopSessionResponse;
export type RefreshRequest = DesktopRefreshRequest;
export type LogoutRequest = DesktopLogoutRequest;

export type DesktopLogoutResponse = void;
export type LogoutResponse = DesktopLogoutResponse;

export interface PublicHealthResponse {
  status: "ok";
  service: "atris-shot-public";
}
