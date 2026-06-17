import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, instructorProfiles } from '../../db/schema.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { env } from '../../env.js';

export const authRouter = Router();

const publicUser = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatar: u.avatar,
  headline: u.headline,
  bio: u.bio,
  links: u.links,
  roles: u.roles,
  locale: u.locale,
  isVerified: u.isVerified,
  status: u.status,
});

function issueTokens(res: import('express').Response, u: typeof users.$inferSelect) {
  const payload = { sub: u.id, roles: u.roles, email: u.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return { accessToken, refreshToken };
}

authRouter.post(
  '/register',
  validate({
    body: z.object({
      name: z.string().min(2).max(160),
      email: z.string().email(),
      password: z.string().min(6).max(100),
      asInstructor: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { name, email, password, asInstructor } = req.body as {
      name: string;
      email: string;
      password: string;
      asInstructor?: boolean;
    };

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const roles = asInstructor ? ['student', 'instructor'] : ['student'];
    const [created] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        roles,
      })
      .returning();

    if (asInstructor) {
      await db.insert(instructorProfiles).values({
        userId: created.id,
        revenueSharePct: 100 - env.platformFeePct,
      });
    }

    const { accessToken } = issueTokens(res, created);
    res.status(201).json({ user: publicUser(created), accessToken });
  })
);

authRouter.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
    if (!user) throw new ApiError(401, 'Invalid email or password');
    if (user.status !== 'active') throw new ApiError(403, `Account ${user.status}`);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const { accessToken } = issueTokens(res, user);
    res.json({ user: publicUser(user), accessToken });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) throw new ApiError(401, 'No refresh token');
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new ApiError(401, 'Invalid refresh token');
    }
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user) throw new ApiError(401, 'User no longer exists');
    const { accessToken } = issueTokens(res, user);
    res.json({ user: publicUser(user), accessToken });
  })
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken');
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.user!.sub) });
    if (!user) throw new ApiError(404, 'User not found');
    res.json({ user: publicUser(user) });
  })
);

// Upgrade a student account to also be an instructor (become-an-instructor flow)
authRouter.post(
  '/become-instructor',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.user!.sub) });
    if (!user) throw new ApiError(404, 'User not found');
    if (user.roles.includes('instructor')) {
      return res.json({ user: publicUser(user) });
    }
    const roles = [...user.roles, 'instructor'];
    const [updated] = await db
      .update(users)
      .set({ roles, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    await db
      .insert(instructorProfiles)
      .values({ userId: user.id, revenueSharePct: 100 - env.platformFeePct })
      .onConflictDoNothing();
    const { accessToken } = issueTokens(res, updated);
    res.json({ user: publicUser(updated), accessToken });
  })
);
