import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import { verifyPassword } from "../../lib/password";
import {
  decodeExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from "../../infrastructure/auth/tokens";
import * as repo from "./auth.repository";
import type { LoginInput } from "./auth.schema";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramId: string | null;
};

type TokenPair = { accessToken: string; refreshToken: string };

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

async function issueTokens(payload: JwtPayload): Promise<TokenPair> {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await repo.createRefreshToken({
    token: refreshToken,
    userId: payload.sub,
    expiresAt: decodeExpiry(refreshToken),
  });

  return { accessToken, refreshToken };
}

export async function login(input: LoginInput, ip?: string | null) {
  const user = await repo.findUserByEmail(input.email);
  if (!user || !user.isActive) throw Errors.unauthenticated("Email atau password salah");

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw Errors.unauthenticated("Email atau password salah");

  const tokens = await issueTokens({ sub: user.id, role: user.role });
  await container.audit.record(
    { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ipAddress: ip },
  );

  return { user: toAuthUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let decoded: JwtPayload;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw Errors.unauthenticated("Refresh token tidak valid");
  }

  const stored = await repo.findRefreshToken(refreshToken);
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw Errors.unauthenticated("Refresh token tidak valid");
  }

  const user = await repo.findUserById(decoded.sub);
  if (!user || !user.isActive) throw Errors.unauthenticated("User tidak aktif");

  // Rotasi: cabut token lama, terbitkan pasangan baru.
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const newRefresh = signRefreshToken({ sub: user.id, role: user.role });
  await repo.rotateRefreshToken({
    oldId: stored.id,
    newToken: newRefresh,
    userId: user.id,
    expiresAt: decodeExpiry(newRefresh),
  });

  return { user: toAuthUser(user), accessToken, refreshToken: newRefresh };
}

export async function logout(refreshToken: string): Promise<void> {
  await repo.revokeRefreshToken(refreshToken);
}
