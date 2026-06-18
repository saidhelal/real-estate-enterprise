import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET must be set for authentication.");
}
const JWT_SECRET: string = SECRET;

const isProduction = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE = "erp_access";
export const REFRESH_COOKIE = "erp_refresh";

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export interface UserScopes {
  branchIds: string[];
  departmentIds: string[];
  projectIds: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  scopes: UserScopes;
  /** The company this user belongs to (null for unassigned). Used to bound
   *  cross-company visibility of `public`-classified documents. */
  companyId: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Enforce the password policy: minimum 8 characters with at least one
 * uppercase letter, one lowercase letter, and one digit.
 * Returns an error message when invalid, or null when the password passes.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return null;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, JWT_SECRET, { subject: userId, expiresIn: ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload.sub) return String(payload.sub);
    return null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const baseCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}
