import { prisma, type Db } from "../../infrastructure/prisma/client";

export function findUserByEmail(email: string, db: Db = prisma) {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(id: string, db: Db = prisma) {
  return db.user.findUnique({ where: { id } });
}

export function createRefreshToken(
  data: { token: string; userId: string; expiresAt: Date },
  db: Db = prisma,
) {
  return db.refreshToken.create({ data });
}

export function findRefreshToken(token: string, db: Db = prisma) {
  return db.refreshToken.findUnique({ where: { token } });
}

/** Rotasi atomik: cabut refresh token lama lalu terbitkan yang baru. */
export function rotateRefreshToken(params: {
  oldId: string;
  newToken: string;
  userId: string;
  expiresAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: params.oldId }, data: { revoked: true } });
    await tx.refreshToken.create({
      data: { token: params.newToken, userId: params.userId, expiresAt: params.expiresAt },
    });
  });
}

export function revokeRefreshToken(token: string, db: Db = prisma) {
  return db.refreshToken.updateMany({
    where: { token, revoked: false },
    data: { revoked: true },
  });
}
