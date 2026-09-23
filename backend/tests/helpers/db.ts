import request from "supertest";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/utils/password";
import { createApp } from "../../src/app";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
       "refresh_tokens",
       "ai_conversation_logs",
       "audit_logs",
       "stock_transactions",
       "delivery_note_items",
       "delivery_notes",
       "purchase_order_items",
       "purchase_orders",
       "inventories",
       "products",
       "categories",
       "partners",
       "warehouses",
       "users"
     RESTART IDENTITY CASCADE`,
  );
}

export type Baseline = Awaited<ReturnType<typeof seedBaseline>>;

export async function seedBaseline() {
  const passwordHash = await hashPassword("password123");

  const admin = await prisma.user.create({
    data: { email: "admin@test.id", name: "Admin", passwordHash, role: "ADMIN" },
  });
  const owner = await prisma.user.create({
    data: {
      email: "owner@test.id",
      name: "Owner",
      passwordHash,
      role: "OWNER",
      telegramId: "900001",
    },
  });
  const superAdmin = await prisma.user.create({
    data: { email: "super@test.id", name: "Super", passwordHash, role: "SUPER_ADMIN" },
  });

  const warehouse = await prisma.warehouse.create({
    data: { code: "GDG-T1", name: "Gudang Test" },
  });
  const category = await prisma.category.create({ data: { name: "Frozen" } });
  const product = await prisma.product.create({
    data: {
      sku: "TST-001",
      name: "Dimsum Test",
      unit: "pack",
      stock: 100,
      minStock: 10,
      categoryId: category.id,
    },
  });
  await prisma.inventory.create({
    data: { productId: product.id, warehouseId: warehouse.id, quantity: 100 },
  });
  const partner = await prisma.partner.create({ data: { name: "PT Test Jaya", type: "CUSTOMER" } });
  const supplier = await prisma.partner.create({ data: { name: "CV Test Sumber", type: "SUPPLIER" } });

  return { admin, owner, superAdmin, warehouse, category, product, partner, supplier, passwordHash };
}

export async function loginAs(email: string, password = "password123") {
  const app = createApp();
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.data as { accessToken: string; refreshToken: string };
}
