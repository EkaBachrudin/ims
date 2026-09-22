import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import type { z } from "zod";
import type { createWarehouseSchema, listWarehouseSchema, updateWarehouseSchema } from "./warehouses.schema";

export async function listWarehouses(query: z.infer<typeof listWarehouseSchema>["query"]) {
  return prisma.warehouse.findMany({
    where: query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { code: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { code: "asc" },
  });
}

export async function createWarehouse(
  input: z.infer<typeof createWarehouseSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const warehouse = await prisma.warehouse.create({
    data: {
      code: input.code,
      name: input.name,
      address: input.address ?? null,
      isActive: input.isActive ?? true,
    },
  });
  await audit(
    {
      actorId,
      action: "CREATE",
      entity: "Warehouse",
      entityId: warehouse.id,
      after: warehouse,
      ipAddress: ip,
    },
    prisma,
  );
  return warehouse;
}

export async function updateWarehouse(
  id: string,
  input: z.infer<typeof updateWarehouseSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.warehouse.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Warehouse");
  const warehouse = await prisma.warehouse.update({ where: { id }, data: input });
  await audit(
    {
      actorId,
      action: "UPDATE",
      entity: "Warehouse",
      entityId: id,
      before,
      after: warehouse,
      ipAddress: ip,
    },
    prisma,
  );
  return warehouse;
}

export async function deleteWarehouse(id: string, actorId?: string | null, ip?: string | null) {
  const before = await prisma.warehouse.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Warehouse");

  const [inv, txns, po, dn] = await Promise.all([
    prisma.inventory.count({ where: { warehouseId: id } }),
    prisma.stockTransaction.count({ where: { warehouseId: id } }),
    prisma.purchaseOrder.count({ where: { warehouseId: id } }),
    prisma.deliveryNote.count({ where: { warehouseId: id } }),
  ]);
  if (inv + txns + po + dn > 0) throw Errors.conflict("Gudang masih direferensikan data lain");

  await prisma.warehouse.delete({ where: { id } });
  await audit(
    { actorId, action: "DELETE", entity: "Warehouse", entityId: id, before, ipAddress: ip },
    prisma,
  );
}
