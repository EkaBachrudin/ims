import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import * as repo from "./warehouses.repository";
import type { z } from "zod";
import type { createWarehouseSchema, listWarehouseSchema, updateWarehouseSchema } from "./warehouses.schema";

export async function listWarehouses(query: z.infer<typeof listWarehouseSchema>["query"]) {
  return repo.listWarehouses(query.q);
}

export async function getWarehouse(id: string) {
  const warehouse = await repo.findById(id);
  if (!warehouse) throw Errors.notFound("Warehouse");
  return warehouse;
}

export async function createWarehouse(
  input: z.infer<typeof createWarehouseSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const warehouse = await repo.create({
    code: input.code,
    name: input.name,
    address: input.address ?? null,
    isActive: input.isActive ?? true,
  });
  await container.audit.record(
    {
      actorId,
      action: "CREATE",
      entity: "Warehouse",
      entityId: warehouse.id,
      after: warehouse,
      ipAddress: ip,
    },
  );
  return warehouse;
}

export async function updateWarehouse(
  id: string,
  input: z.infer<typeof updateWarehouseSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Warehouse");
  const warehouse = await repo.update(id, input);
  await container.audit.record(
    {
      actorId,
      action: "UPDATE",
      entity: "Warehouse",
      entityId: id,
      before,
      after: warehouse,
      ipAddress: ip,
    },
  );
  return warehouse;
}

export async function deleteWarehouse(id: string, actorId?: string | null, ip?: string | null) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Warehouse");

  const refs = await repo.countReferences(id);
  if (refs > 0) throw Errors.conflict("Gudang masih direferensikan data lain");

  await repo.remove(id);
  await container.audit.record(
    { actorId, action: "DELETE", entity: "Warehouse", entityId: id, before, ipAddress: ip },
  );
}
