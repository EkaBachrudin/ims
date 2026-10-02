import type { UnitOfWork } from "../../application/ports/unitOfWork";
import { prisma, type Db } from "./client";

/**
 * Jalankan sekumpulan operasi repository dalam satu transaksi atomik.
 * ``fn`` menerima klien transaksi (`Db`) yang wajib diteruskan ke method repository.
 */
export function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export const prismaUnitOfWork: UnitOfWork = {
  run: (fn) => prisma.$transaction(fn),
};
