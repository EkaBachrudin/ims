import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import { buildMeta, parsePagination } from "../../lib/pagination";
import * as repo from "./partners.repository";
import type { z } from "zod";
import type { createPartnerSchema, listPartnerSchema, updatePartnerSchema } from "./partners.schema";

export async function listPartners(query: z.infer<typeof listPartnerSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listPartners({ q: query.q, type: query.type, skip, take });
  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getPartner(id: string) {
  const partner = await repo.findById(id);
  if (!partner) throw Errors.notFound("Partner");
  return partner;
}

export async function createPartner(
  input: z.infer<typeof createPartnerSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const partner = await repo.create({
    name: input.name,
    type: input.type,
    phone: input.phone ?? null,
    email: input.email ? input.email : null,
    address: input.address ?? null,
  });
  await container.audit.record(
    { actorId, action: "CREATE", entity: "Partner", entityId: partner.id, after: partner, ipAddress: ip },
  );
  return partner;
}

export async function updatePartner(
  id: string,
  input: z.infer<typeof updatePartnerSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Partner");
  const partner = await repo.update(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.email !== undefined ? { email: input.email ? input.email : null } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
  });
  await container.audit.record(
    { actorId, action: "UPDATE", entity: "Partner", entityId: id, before, after: partner, ipAddress: ip },
  );
  return partner;
}

export async function deletePartner(id: string, actorId?: string | null, ip?: string | null) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Partner");

  const refs = await repo.countReferences(id);
  if (refs > 0) throw Errors.conflict("Partner masih direferensikan data lain");

  await repo.remove(id);
  await container.audit.record(
    { actorId, action: "DELETE", entity: "Partner", entityId: id, before, ipAddress: ip },
  );
}
