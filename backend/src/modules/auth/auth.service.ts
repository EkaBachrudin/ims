import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { verifyPassword } from "../../utils/password";
import { signAccessToken, type JwtPayload } from "../../middlewares/auth";
import type { LoginInput } from "./auth.schema";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramId: string | null;
};

type TokenPair = { accessToken: string; refreshToken: string };

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
  });
}

function expiryDate(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) {
    // Fallback: 7 hari
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(decoded.exp * 1000);
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramId: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    telegramId: user.telegramId,
  };
}

export async function login(input: LoginInput, ip?: string | null) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw Errors.unauthenticated("Email atau password salah");

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw Errors.unauthenticated("Email atau password salah");

  const tokens = await issueTokens({ sub: user.id, role: user.role });
  await audit(
    { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ipAddress: ip },
    prisma,
  );

  return { user: toAuthUser(user), ...tokens };
}

async function issueTokens(payload: JwtPayload): Promise<TokenPair> {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: payload.sub, expiresAt: expiryDate(refreshToken) },
  });

  return { accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw Errors.unauthenticated("Refresh token tidak valid");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw Errors.unauthenticated("Refresh token tidak valid");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user || !user.isActive) throw Errors.unauthenticated("User tidak aktif");

  // Rotasi: cabut token lama, terbitkan pasangan baru.
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
    });
    const newRefresh = signRefreshToken({ sub: user.id, role: user.role });
    await tx.refreshToken.create({
      data: { token: newRefresh, userId: user.id, expiresAt: expiryDate(newRefresh) },
    });
    return { accessToken, refreshToken: newRefresh };
  });

  return { user: toAuthUser(user), ...tokens };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revoked: false },
    data: { revoked: true },
  });
}
