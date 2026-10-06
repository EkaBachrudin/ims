import { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../infrastructure/prisma/client";

const listSelect = {
  id: true,
  filename: true,
  title: true,
  docType: true,
  version: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true } },
  _count: { select: { chunks: true } },
} satisfies Prisma.KnowledgeDocumentSelect;

export interface ListDocumentsFilter {
  docType?: string;
  q?: string;
  isActive?: boolean;
}

function buildWhere(filter: ListDocumentsFilter): Prisma.KnowledgeDocumentWhereInput {
  return {
    ...(filter.docType ? { docType: filter.docType } : {}),
    ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    ...(filter.q
      ? {
          OR: [
            { title: { contains: filter.q, mode: "insensitive" } },
            { filename: { contains: filter.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listDocuments(
  filter: ListDocumentsFilter,
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const where = buildWhere(filter);
  const [rows, total] = await Promise.all([
    db.knowledgeDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: listSelect,
    }),
    db.knowledgeDocument.count({ where }),
  ]);
  return { rows, total };
}

export function findById(id: string, db: Db = prisma) {
  return db.knowledgeDocument.findUnique({ where: { id } });
}

export function create(data: Prisma.KnowledgeDocumentCreateInput, db: Db = prisma) {
  return db.knowledgeDocument.create({ data, select: listSelect });
}

export function update(id: string, data: Prisma.KnowledgeDocumentUpdateInput, db: Db = prisma) {
  return db.knowledgeDocument.update({ where: { id }, data, select: listSelect });
}

export interface ChunkStats {
  totalChunks: number;
  totalDocuments: number;
  lastIngest: Date | null;
  byType: { docType: string | null; documents: number; chunks: number }[];
}

export async function chunkStats(db: Db = prisma): Promise<ChunkStats> {
  const [totals, byType] = await Promise.all([
    db.$queryRaw<{ chunks: number; documents: number; lastIngest: Date | null }[]>(Prisma.sql`
      SELECT count(*)::int AS chunks,
             count(DISTINCT "documentId")::int AS documents,
             max("createdAt") AS "lastIngest"
      FROM "document_chunks"
    `),
    db.$queryRaw<{ docType: string | null; documents: number; chunks: number }[]>(Prisma.sql`
      SELECT "docType",
             count(DISTINCT "documentId")::int AS documents,
             count(*)::int AS chunks
      FROM "document_chunks"
      GROUP BY "docType"
      ORDER BY "docType"
    `),
  ]);

  return {
    totalChunks: totals[0]?.chunks ?? 0,
    totalDocuments: totals[0]?.documents ?? 0,
    lastIngest: totals[0]?.lastIngest ?? null,
    byType,
  };
}

export interface ChunkRow {
  id: string;
  source: string;
  title: string | null;
  docType: string | null;
  documentId: string | null;
  content: string;
  createdAt: Date;
}

export async function listChunks(
  filter: { q?: string; docType?: string },
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const conditions: Prisma.Sql[] = [];
  if (filter.q) conditions.push(Prisma.sql`"content" ILIKE ${"%" + filter.q + "%"}`);
  if (filter.docType) conditions.push(Prisma.sql`"docType" = ${filter.docType}`);
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const [rows, count] = await Promise.all([
    db.$queryRaw<ChunkRow[]>(Prisma.sql`
      SELECT "id", "source", "title", "docType", "documentId", "content", "createdAt"
      FROM "document_chunks" ${where}
      ORDER BY "createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT count(*)::int AS count FROM "document_chunks" ${where}
    `),
  ]);

  return { rows, total: count[0]?.count ?? 0 };
}
