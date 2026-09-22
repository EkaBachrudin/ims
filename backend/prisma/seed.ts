import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@umkm.id" },
    update: {},
    create: {
      email: "superadmin@umkm.id",
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@umkm.id" },
    update: {},
    create: {
      email: "admin@umkm.id",
      name: "Admin Gudang",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@umkm.id" },
    update: {},
    create: {
      email: "owner@umkm.id",
      name: "Owner",
      passwordHash,
      role: "OWNER",
      telegramId: "123456789",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "GDG-01" },
    update: {},
    create: { code: "GDG-01", name: "Gudang Utama", address: "Jl. Raya Industri No. 1" },
  });

  const categories = ["Frozen Food", "Minuman", "Bumbu"];
  const categoryMap: Record<string, number> = {};
  for (const name of categories) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    categoryMap[name] = c.id;
  }

  const products = [
    {
      sku: "DMS-SDG-01",
      name: "Dimsum Ayam Ukuran Sedang",
      unit: "pack",
      stock: 120,
      minStock: 20,
      category: "Frozen Food",
    },
    {
      sku: "DMS-BSR-01",
      name: "Dimsum Ayam Ukuran Besar",
      unit: "pack",
      stock: 60,
      minStock: 15,
      category: "Frozen Food",
    },
    {
      sku: "NUG-AYM-01",
      name: "Nugget Ayam",
      unit: "pack",
      stock: 80,
      minStock: 25,
      category: "Frozen Food",
    },
    {
      sku: "MIN-TEH-01",
      name: "Teh Kotak",
      unit: "box",
      stock: 40,
      minStock: 10,
      category: "Minuman",
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        stock: p.stock,
        minStock: p.minStock,
        categoryId: categoryMap[p.category],
      },
    });

    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      update: { quantity: p.stock },
      create: { productId: product.id, warehouseId: warehouse.id, quantity: p.stock },
    });
  }

  const partners = [
    { name: "PT Maju Jaya", type: "CUSTOMER" as const },
    { name: "Toko Berkah", type: "CUSTOMER" as const },
    { name: "CV Sumber Frozen", type: "SUPPLIER" as const },
  ];

  for (const partner of partners) {
    const existing = await prisma.partner.findFirst({ where: { name: partner.name } });
    if (!existing) {
      await prisma.partner.create({ data: partner });
    }
  }

  console.log("Seed selesai.");
  console.log(`  superadmin: ${superAdmin.email} / password123`);
  console.log(`  admin:      ${admin.email} / password123`);
  console.log("  owner:      owner@umkm.id / password123 (telegramId 123456789)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
