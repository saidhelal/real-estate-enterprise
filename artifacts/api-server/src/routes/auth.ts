import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, loginHistoryTable } from "@workspace/db";
import {
  LoginBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  setAuthCookies,
  setAccessCookie,
  clearAuthCookies,
  clearTestingCookie,
  signOwnerToken,
  verifyOwnerToken,
  setOwnerCookie,
  clearOwnerCookie,
  OWNER_COOKIE,
  OWNER_TTL_SECONDS,
} from "../lib/auth";
import { loadAuthUser } from "../lib/access";
import { recordAudit } from "../lib/audit";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

async function recordLogin(
  userId: string | null,
  userName: string,
  success: boolean,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  await db.insert(loginHistoryTable).values({
    userId,
    userName,
    success,
    ipAddress: ip,
    userAgent,
  });
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const ip = req.ip ?? null;
  const userAgent = req.get("user-agent") ?? null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.username, username), eq(usersTable.isDeleted, false)));

  if (!user) {
    await recordLogin(null, username, false, ip, userAgent);
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (user.status === "inactive" || !user.isActive) {
    await recordLogin(user.id, username, false, ip, userAgent);
    res.status(401).json({ error: "Account is inactive. Contact an administrator." });
    return;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordLogin(user.id, username, false, ip, userAgent);
    res.status(401).json({ error: "Account is locked. Try again later." });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failedAttempts = user.failedAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
    await db
      .update(usersTable)
      .set({
        failedAttempts,
        status: shouldLock ? "locked" : user.status,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      })
      .where(eq(usersTable.id, user.id));
    await recordLogin(user.id, username, false, ip, userAgent);
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Success: reset counters and stamp last login.
  await db
    .update(usersTable)
    .set({
      failedAttempts: 0,
      status: "active",
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  const refreshRaw = generateRefreshToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash: hashToken(refreshRaw),
    ipAddress: ip,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  });

  const accessToken = signAccessToken(user.id);
  setAuthCookies(res, accessToken, refreshRaw);
  await recordLogin(user.id, username, true, ip, userAgent);

  const authUser = await loadAuthUser(user.id);
  if (authUser) {
    req.authUser = authUser;
    await recordAudit(req, { action: "login", entity: "auth", entityId: user.id });
  }
  res.json({ accessToken, user: authUser });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  const tokenHash = hashToken(raw);
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.tokenHash, tokenHash));

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  // Refuse to mint new tokens for accounts that have since been deleted,
  // deactivated, or locked; revoke the session so it cannot be reused.
  const [sessionUser] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, session.userId), eq(usersTable.isDeleted, false)));
  const lockedNow = !!sessionUser?.lockedUntil && sessionUser.lockedUntil.getTime() > Date.now();
  if (!sessionUser || !sessionUser.isActive || sessionUser.status === "inactive" || lockedNow) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));
    clearAuthCookies(res);
    res.status(401).json({ error: "Account is not active." });
    return;
  }

  // Rotate the refresh token.
  const newRaw = generateRefreshToken();
  await db
    .update(sessionsTable)
    .set({
      tokenHash: hashToken(newRaw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    })
    .where(eq(sessionsTable.id, session.id));

  const accessToken = signAccessToken(session.userId);
  setAuthCookies(res, accessToken, newRaw);
  res.json({ accessToken });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.tokenHash, hashToken(raw)));
    if (session) {
      await db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(eq(sessionsTable.id, session.id));
      const authUser = await loadAuthUser(session.userId);
      if (authUser) {
        req.authUser = authUser;
        await recordAudit(req, { action: "logout", entity: "auth", entityId: session.userId });
      }
    }
  }
  clearAuthCookies(res);
  // Testing Mode is per-session: ending the session must also exit Testing Mode
  // so a later login in the same browser never silently lands in the demo sandbox.
  clearTestingCookie(res);
  // Owner Mode is a per-session step-up; never let it survive a logout.
  clearOwnerCookie(res);
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json(req.authUser);
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const policyError = validatePasswordPolicy(parsed.data.newPassword);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }

  const userId = req.authUser!.id;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
    })
    .where(eq(usersTable.id, userId));

  await recordAudit(req, { action: "change-password", entity: "users", entityId: userId });

  res.json({ success: true });
});

// --- Owner Mode (step-up authentication) -----------------------------------
// Owner Mode never grants access by clicking a button: the caller must re-enter
// the credentials of an owner-tier account (permissions include "*"). On
// success a short-lived, separate JWT cookie is set; its expiry is the
// inactivity timeout. Every enter/exit is audited.

router.get("/auth/owner-mode", requireAuth, (req, res): void => {
  const token = req.cookies?.[OWNER_COOKIE];
  const userId = token ? verifyOwnerToken(token) : null;
  // Owner Mode is bound to the current session's identity.
  const active = userId !== null && userId === req.authUser!.id;
  res.json({ active });
});

router.post("/auth/owner-mode/verify", requireAuth, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const ip = req.ip ?? null;
  const userAgent = req.get("user-agent") ?? null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.username, username), eq(usersTable.isDeleted, false)));

  // The step-up must confirm the *current* user's own owner-tier credentials —
  // it is a re-authentication, not a way to assume another account.
  const sameUser = !!user && user.id === req.authUser!.id;
  const activeUser = !!user && user.isActive && user.status !== "inactive";
  const ok = activeUser && sameUser && (await verifyPassword(password, user!.passwordHash));

  if (!ok) {
    await recordLogin(user?.id ?? null, username, false, ip, userAgent);
    res.status(401).json({ error: "Owner verification failed." });
    return;
  }

  const authUser = await loadAuthUser(user!.id);
  const isOwnerTier = !!authUser && authUser.permissions.includes("*");
  if (!isOwnerTier) {
    res.status(403).json({ error: "This account is not an owner-tier account." });
    return;
  }

  setOwnerCookie(res, signOwnerToken(user!.id));
  await recordAudit(req, {
    action: "owner-mode.enter",
    entity: "auth",
    entityId: user!.id,
  });
  res.json({ active: true, expiresInSeconds: OWNER_TTL_SECONDS });
});

router.post("/auth/owner-mode/exit", requireAuth, async (req, res): Promise<void> => {
  clearOwnerCookie(res);
  await recordAudit(req, {
    action: "owner-mode.exit",
    entity: "auth",
    entityId: req.authUser!.id,
  });
  res.json({ active: false });
});

export default router;
