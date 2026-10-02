import type { Db } from "../../infrastructure/prisma/client";

/** Port transaksi atomik lintas repository. */
export interface UnitOfWork {
  run<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
