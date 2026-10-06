import type { Prisma } from "@prisma/client";
import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import { buildMeta, parsePagination } from "../../lib/pagination";
import * as repo from "./knowledge.repository";
import type { z } from "zod";
import type {
  createDocumentSchema,
  listChunkSchema,
  listDocumentSchema,
  updateDocumentSchema,
} from "./knowledge.schema";

export interface UploadedFile {
  filename: string;
  content: string;
}

export async function listDocuments(query: z.infer<typeof listDocumentSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listDocuments(
    { docType: query.docType, q: query.q, isActive: query.isActive },
    { skip, take },
  );
  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getDocument(id: string) {
  const doc = await repo.findById(id);
  if (!doc) throw Errors.notFound("KnowledgeDocument");
  return doc;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

export async function createDocument(
  input: z.infer<typeof createDocumentSchema>["body"],
  actorId: string | null | undefined,
  ip: string | null,
  file?: UploadedFile,
) {
  const content = file?.content ?? input.content;
  if (!content) throw Errors.validation("Konten dokumen wajib diisi");
  const filename = file?.filename ?? input.filename ?? "document.md";

  const doc = await repo.create({
    filename,
    title: input.title,
    docType: input.docType,
    content,
    metadata: toJson(input.metadata),
    uploadedBy: actorId ? { connect: { id: actorId } } : undefined,
  });

  await container.audit.record({
    actorId,
    action: "CREATE",
    entity: "KnowledgeDocument",
    entityId: doc.id,
    after: doc,
    ipAddress: ip,
  });
  return doc;
}

export async function updateDocument(
  id: string,
  input: z.infer<typeof updateDocumentSchema>["body"],
  actorId: string | null | undefined,
  ip: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("KnowledgeDocument");

  const contentChanged = input.content !== undefined && input.content !== before.content;

  const doc = await repo.update(id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.docType !== undefined ? { docType: input.docType } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.filename !== undefined ? { filename: input.filename } : {}),
    ...(input.metadata !== undefined ? { metadata: toJson(input.metadata) } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(contentChanged ? { version: { increment: 1 } } : {}),
  });

  await container.audit.record({
    actorId,
    action: "UPDATE",
    entity: "KnowledgeDocument",
    entityId: id,
    before,
    after: doc,
    ipAddress: ip,
  });
  return doc;
}

export async function deleteDocument(
  id: string,
  actorId: string | null | undefined,
  ip: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("KnowledgeDocument");

  const doc = await repo.update(id, { isActive: false });
  await container.audit.record({
    actorId,
    action: "DELETE",
    entity: "KnowledgeDocument",
    entityId: id,
    before,
    after: doc,
    ipAddress: ip,
  });
}

export function getStats() {
  return repo.chunkStats();
}

export async function listChunks(query: z.infer<typeof listChunkSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listChunks({ q: query.q, docType: query.docType }, { skip, take });
  return { rows, meta: buildMeta(page, limit, total) };
}

export async function triggerIngest(
  filter: { documentId?: string; docType?: string },
  actorId: string | null | undefined,
  ip: string | null,
) {
  const state = await container.indexer.triggerIngest(filter);
  await container.audit.record({
    actorId,
    action: "INGEST",
    entity: "KnowledgeBase",
    entityId: filter.documentId ?? filter.docType ?? null,
    after: filter,
    ipAddress: ip,
  });
  return state;
}

export function getIngestStatus() {
  return container.indexer.getStatus();
}
