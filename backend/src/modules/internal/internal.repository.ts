import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma } from "@prisma/client";

export function createConversationLog(
  data: Prisma.AiConversationLogUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.aiConversationLog.create({ data });
}
