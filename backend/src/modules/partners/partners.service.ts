import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import type { z } from "zod";
import type { createPartnerSchema, listPartnerSchema, updatePartnerSchema } from "./partners.schema";

export async function listPartners(query: z.infer<typeof listPartnerSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.partner.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.partner.count({ where }),
  ]);

  return { rows, meta: buildMeta(page, limit, total) };
}

export async function createPartner(
  input: z.infer<typeof createPartnerSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const partner = await prisma.partner.create({
    data: {
      name: input.name,
      type: input.type,
      phone: input.phone ?? null,
      email: input.email ? input.email : null,
      address: input.address ?? null,
    },
  });
  await audit(
    { actorId, action: "CREATE", entity: "Partner", entityId: partner.id, after: partner, ipAddress: ip },
    prisma,
  );
  return partner;
}

export async function updatePartner(
  id: string,
  input: z.infer<typeof updatePartnerSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.partner.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Partner");
  const partner = await prisma.partner.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email ? input.email : null } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
  });
  await audit(
    { actorId, action: "UPDATE", entity: "Partner", entityId: id, before, after: partner, ipAddress: ip },
    prisma,
  );
  return partner;
}

export async function deletePartner(id: string, actorId?: string | null, ip?: string | null) {
  const before = await prisma.partner.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Partner");

  const [po, dn, txns] = await Promise.all([
    prisma.purchaseOrder.count({ where: { partnerId: id } }),
    prisma.deliveryNote.count({ where: { partnerId: id } }),
    prisma.stockTransaction.count({ where: { partnerId: id } }),
  ]);
  if (po + dn + txns > 0) throw Errors.conflict("Partner masih direferensikan data lain");

  await prisma.partner.delete({ where: { id } });
  await audit(
    { actorId, action: "DELETE", entity: "Partner", entityId: id, before, ipAddress: ip },
    prisma,
  );
}
