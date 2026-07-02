export type MembershipStatus = "active" | "inactive" | "expired" | "unknown";
export type MembershipPlan = "Free" | "Premium" | "Admin";

export interface AtrisMembership {
  status: MembershipStatus;
  plan: MembershipPlan;
  startsAt?: string;
  endsAt?: string | null;
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
  token: string;
  user: SessionUser;
  membership: AtrisMembership;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
  membership?: AtrisMembership;
}

export interface SessionResponse {
  user: SessionUser;
  membership?: AtrisMembership;
}

export interface PublicHealthResponse {
  status: "ok";
  service: "atris-shot-public";
}
