import type { UserRole, Locale, SharingScope } from "./shared";

/** A registered user (teacher or admin). */
export interface User {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  schoolId: string | null;
  role: UserRole;
  language: Locale;
  /** Monthly token quota. Default 1,000,000. */
  quota: number;
  /** Tokens consumed this month. */
  quotaUsed: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public user profile (no password hash). */
export interface UserProfile {
  _id: string;
  email: string;
  name: string;
  schoolId: string | null;
  role: UserRole;
  language: Locale;
  quota: number;
  quotaUsed: number;
  active: boolean;
}

/** User registration payload. */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/** Login credentials. */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Login response. */
export interface LoginResponse {
  user: UserProfile;
  token: string;
}

/** A school/department boundary for default sharing and admin reporting. */
export interface School {
  _id: string;
  name: string;
  /** Short code for the school (e.g., "cs", "math"). */
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
