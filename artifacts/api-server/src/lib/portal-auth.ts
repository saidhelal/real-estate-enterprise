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

export const PORTAL_ACCESS_COOKIE = "portal_access";
export const PORTAL_REFRESH_COOKIE = "portal_refresh";

export const PORTAL_ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const PORTAL_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const PORTAL_MAX_FAILED_ATTEMPTS = 5;
export const PORTAL_LOCKOUT_MINUTES = 15;

// Distinct token audience so an ERP token can never authenticate the portal
// and vice versa.
const PORTAL_AUDIENCE = "portal";

export interface PortalAuthUser {
  id: string;
  customerId: string;
  companyId: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signPortalAccessToken(customerUserId: string): string {
  return jwt.sign({}, JWT_SECRET, {
    subject: customerUserId,
    audience: PORTAL_AUDIENCE,
    expiresIn: PORTAL_ACCESS_TTL_SECONDS,
  });
}

export function verifyPortalAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { audience: PORTAL_AUDIENCE });
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

export function generateOtpCode(): string {
  // 6-digit numeric code.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

const baseCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
};

export function setPortalAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie(PORTAL_ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    maxAge: PORTAL_ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(PORTAL_REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    maxAge: PORTAL_REFRESH_TTL_SECONDS * 1000,
  });
}

export function setPortalAccessCookie(res: Response, accessToken: string): void {
  res.cookie(PORTAL_ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    maxAge: PORTAL_ACCESS_TTL_SECONDS * 1000,
  });
}

export function clearPortalAuthCookies(res: Response): void {
  res.clearCookie(PORTAL_ACCESS_COOKIE, baseCookie);
  res.clearCookie(PORTAL_REFRESH_COOKIE, baseCookie);
}
