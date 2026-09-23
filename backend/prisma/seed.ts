import { Prisma, PrismaClient } from "@prisma/client";
import type { PartnerType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";
const OPENING_BUFFER = 250;
const HISTORICAL_COUNT = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

// ----------------------------------------------------------------------
// Deterministic helpers (tanpa dependency tambahan)
// ----------------------------------------------------------------------

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ----------------------------------------------------------------------
// Katalog produk: 8 kategori x 15 = 120 produk
// ----------------------------------------------------------------------

type CategoryDef = {
  name: string;
  code: string;
  units: readonly string[];
  items: readonly string[];
  variants: readonly string[];
  generate: number;
};

const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    name: "Frozen Food",
    code: "FRZ",
    units: ["pack", "box", "pack"],
    items: [
      "Dimsum Ayam",
      "Dimsum Udang",
      "Nugget Ayam",
      "Sosis Sapi",
      "Kentang Goreng",
      "Bakso Sapi",
      "Otak-Otak",
      "Cireng Isi",
    ],
    variants: ["Kemasan 250g", "Kemasan 500g", "Kemasan 1kg"],
    generate: 12,
  },
  {
    name: "Minuman",
    code: "MNM",
    units: ["box", "botol", "dus"],
    items: [
      "Teh Kotak",
      "Air Mineral",
      "Kopi Sachet",
      "Susu UHT",
      "Minuman Soda",
      "Jus Buah",
      "Sirup Marjan",
      "Minuman Isotonik",
    ],
    variants: ["Dus 24", "Botol 350ml", "Botol 1 Liter"],
    generate: 14,
  },
  {
    name: "Bumbu",
    code: "BMB",
    units: ["botol", "pack", "sachet"],
    items: [
      "Kecap Manis",
      "Saus Sambal",
      "Bawang Putih Bubuk",
      "Merica Bubuk",
      "Kaldu Bubuk",
      "Garam Halus",
      "Ketumbar Bubuk",
      "Kunyit Bubuk",
    ],
    variants: ["Sachet 8g", "Botol 100ml", "Kemasan 500g"],
    generate: 15,
  },
  {
    name: "Snack & Makanan Ringan",
    code: "SNK",
    units: ["pack", "dus", "bal"],
    items: [
      "Keripik Singkong",
      "Keripik Kentang",
      "Kacang Atom",
      "Kacang Kulit",
      "Wafer Cokelat",
      "Biskuit Kelapa",
      "Permen Mint",
      "Kerupuk Udang",
    ],
    variants: ["Kemasan 50g", "Kemasan 100g", "Kemasan 250g"],
    generate: 15,
  },
  {
    name: "Makanan Instan",
    code: "INS",
    units: ["pack", "dus", "box"],
    items: [
      "Mi Instan Goreng",
      "Mi Instan Kuah",
      "Bihun Instan",
      "Kwetiau Instan",
      "Bubur Instan",
      "Nasi Goreng Instan",
      "Sereal Sarapan",
      "Pasta Instan",
    ],
    variants: ["Rasa Original", "Rasa Ayam Bawang", "Rasa Pedas"],
    generate: 15,
  },
  {
    name: "Minyak & Tepung",
    code: "MYK",
    units: ["pack", "sak", "jerigen"],
    items: [
      "Minyak Goreng Sawit",
      "Minyak Goreng Kelapa",
      "Tepung Terigu",
      "Tepung Beras",
      "Tepung Tapioka",
      "Tepung Bumbu",
      "Gula Pasir",
      "Margarin",
    ],
    variants: ["Kemasan 500g", "Kemasan 1kg", "Jerigen 5 Liter"],
    generate: 15,
  },
  {
    name: "Seafood",
    code: "SEA",
    units: ["kg", "pack", "box"],
    items: [
      "Ikan Kembung",
      "Ikan Nila",
      "Udang Vaname",
      "Cumi-Cumi",
      "Ikan Tuna",
      "Ikan Lele",
      "Kepiting",
      "Ikan Bandeng",
    ],
    variants: ["Segar 500g", "Beku 500g", "Beku 1kg"],
    generate: 15,
  },
  {
    name: "Sayuran & Buah",
    code: "SYR",
    units: ["ikat", "kg", "pack"],
    items: ["Brokoli", "Wortel", "Bayam", "Sawi Hijau", "Kangkung", "Tomat", "Jagung Manis", "Buncis"],
    variants: ["Ikat 250g", "Kemasan 500g", "Kemasan 1kg"],
    generate: 15,
  },
];

type SeedProduct = {
  sku: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  description: string;
  category: string;
  lowStock: boolean;
  lowStockTarget: number;
};

const LEGACY_PRODUCTS: readonly SeedProduct[] = [
  {
    sku: "DMS-SDG-01",
    name: "Dimsum Ayam Ukuran Sedang",
    unit: "pack",
    stock: 120,
    minStock: 20,
    description: "Dimsum ayam ukuran sedang siap kukus.",
    category: "Frozen Food",
    lowStock: false,
    lowStockTarget: 0,
  },
  {
    sku: "DMS-BSR-01",
    name: "Dimsum Ayam Ukuran Besar",
    unit: "pack",
    stock: 60,
    minStock: 15,
    description: "Dimsum ayam ukuran besar siap kukus.",
    category: "Frozen Food",
    lowStock: false,
    lowStockTarget: 0,
  },
  {
    sku: "NUG-AYM-01",
    name: "Nugget Ayam",
    unit: "pack",
    stock: 80,
    minStock: 25,
    description: "Nugget ayam frozen siap goreng.",
    category: "Frozen Food",
    lowStock: false,
    lowStockTarget: 0,
  },
  {
    sku: "MIN-TEH-01",
    name: "Teh Kotak",
    unit: "box",
    stock: 40,
    minStock: 10,
    description: "Teh kotak siap saji.",
    category: "Minuman",
    lowStock: false,
    lowStockTarget: 0,
  },
];

function generateCategoryProducts(def: CategoryDef): SeedProduct[] {
  const result: SeedProduct[] = [];
  let index = 0;
  for (const item of def.items) {
    if (result.length >= def.generate) break;
    for (const variant of def.variants) {
      if (result.length >= def.generate) break;
      index += 1;
      const sku = `${def.code}-${String(index).padStart(3, "0")}`;
      const rng = createRng(hashString(sku));
      const unit = pick(rng, def.units);
      const minStock = 10 + Math.floor(rng() * 40);
      const stock = minStock + 20 + Math.floor(rng() * 220);
      const lowStock = rng() < 0.12;
      const lowStockTarget = Math.floor(rng() * minStock);
      result.push({
        sku,
        name: `${item} ${variant}`,
        unit,
        stock,
        minStock,
        description: `${item} ${variant} - kategori ${def.name}.`,
        category: def.name,
        lowStock,
        lowStockTarget,
      });
    }
  }
  return result;
}

function buildProducts(): SeedProduct[] {
  const generated = CATEGORY_DEFS.flatMap(generateCategoryProducts);
  return [...LEGACY_PRODUCTS, ...generated];
}

// ----------------------------------------------------------------------
// Partner: 15 supplier + 35 customer = 50
// ----------------------------------------------------------------------

type SeedPartner = {
  name: string;
  type: PartnerType;
  phone: string;
  email: string;
  address: string;
};

const SUPPLIER_TYPES = ["CV", "PT", "UD", "Supplier", "Distributor"] as const;
const CUSTOMER_TYPES = ["Toko", "Warung", "PT", "CV", "Kios", "Agen", "UD", "Grosir"] as const;
const BUSINESS_WORDS = [
  "Maju Jaya",
  "Sumber Rejeki",
  "Berkah Abadi",
  "Sentosa Makmur",
  "Sejahtera",
  "Barokah",
  "Aneka Pangan",
  "Nusantara",
  "Bumi Sehat",
  "Prima",
  "Karya Mandiri",
  "Cahaya",
  "Pelita",
  "Mekar",
  "Tunas",
  "Sinar",
  "Fajar",
  "Kencana",
  "Amanah",
  "Bahari",
] as const;
const REGIONS = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Semarang",
  "Medan",
  "Makassar",
  "Yogyakarta",
  "Denpasar",
  "Palembang",
  "Bekasi",
  "Tangerang",
  "Depok",
  "Bogor",
  "Malang",
  "Solo",
] as const;
const STREETS = [
  "Raya Industri",
  "Merdeka",
  "Sudirman",
  "Diponegoro",
  "Gatot Subroto",
  "Ahmad Yani",
  "Pahlawan",
  "Melati",
  "Kenanga",
  "Cempaka",
] as const;
const EMAIL_DOMAINS = ["mail.com", "gmail.com", "bisnis.id"] as const;

function makePartner(type: PartnerType, index: number, used: Set<string>): SeedPartner {
  const prefixes = type === "SUPPLIER" ? SUPPLIER_TYPES : CUSTOMER_TYPES;
  const prefix = prefixes[index % prefixes.length];
  const word = BUSINESS_WORDS[(index * 3 + prefix.length) % BUSINESS_WORDS.length];
  let name = `${prefix} ${word}`;
  let attempt = 1;
  while (used.has(name)) {
    name = `${prefix} ${word} ${REGIONS[attempt % REGIONS.length]}`;
    attempt += 1;
  }
  used.add(name);

  const seed = hashString(`${type}-${name}`);
  const region = REGIONS[seed % REGIONS.length];
  const street = STREETS[(seed >>> 3) % STREETS.length];
  const number = 1 + (seed % 150);
  const phone = `08${String(12 + (seed % 70)).padStart(2, "0")}-${String(1000 + (seed % 9000)).padStart(4, "0")}-${String(
    1000 + ((seed >>> 5) % 9000),
  ).padStart(4, "0")}`;
  const email = `${slugify(name)}@${EMAIL_DOMAINS[seed % EMAIL_DOMAINS.length]}`;

  return {
    name,
    type,
    phone,
    email,
    address: `Jl. ${street} No. ${number}, ${region}`,
  };
}

const LEGACY_PARTNERS: readonly SeedPartner[] = [
  {
    name: "PT Maju Jaya",
    type: "CUSTOMER",
    phone: "0812-1000-2001",
    email: "ptmajujaya@mail.com",
    address: "Jl. Merdeka No. 10, Jakarta",
  },
  {
    name: "Toko Berkah",
    type: "CUSTOMER",
    phone: "0813-1000-2002",
    email: "tokoberkah@mail.com",
    address: "Jl. Melati No. 21, Bandung",
  },
  {
    name: "CV Sumber Frozen",
    type: "SUPPLIER",
    phone: "0812-1000-3001",
    email: "sumberfrozen@mail.com",
    address: "Jl. Raya Industri No. 7, Surabaya",
  },
];

function buildPartners(): SeedPartner[] {
  const used = new Set<string>();
  const partners: SeedPartner[] = [];

  for (const p of LEGACY_PARTNERS) {
    used.add(p.name);
    partners.push(p);
  }

  const targetSupplier = 15;
  const targetCustomer = 35;
  let index = 0;

  while (partners.filter((p) => p.type === "SUPPLIER").length < targetSupplier) {
    partners.push(makePartner("SUPPLIER", index, used));
    index += 1;
  }
  while (partners.filter((p) => p.type === "CUSTOMER").length < targetCustomer) {
    partners.push(makePartner("CUSTOMER", index, used));
    index += 1;
  }

  return partners;
}

// ----------------------------------------------------------------------
// applyStock versi seed: sama dengan service, tapi bisa set createdAt historis
// ----------------------------------------------------------------------

type Db = Prisma.TransactionClient;

type StockInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
  createdById: string;
  partnerId?: string | null;
  purchaseOrderId?: string | null;
  deliveryNoteId?: string | null;
  notes?: string | null;
  referenceNo?: string | null;
};

async function applyStockSeed(
  db: Db,
  type: "IN" | "OUT" | "ADJUSTMENT",
  input: StockInput,
  createdAt: Date,
) {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, stock: true },
  });
  if (!product) throw new Error(`Product ${input.productId} tidak ditemukan`);

  const delta = type === "OUT" ? -input.quantity : input.quantity;

  if (type === "OUT") {
    if (product.stock < input.quantity) throw new Error("Stok tidak cukup (product)");
    const inventory = await db.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });
    if (!inventory || inventory.quantity < input.quantity) {
      throw new Error("Stok tidak cukup (inventory)");
    }
  }

  const txn = await db.stockTransaction.create({
    data: {
      type,
      quantity: input.quantity,
      notes: input.notes ?? null,
      referenceNo: input.referenceNo ?? null,
      productId: input.productId,
      warehouseId: input.warehouseId,
      partnerId: input.partnerId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      deliveryNoteId: input.deliveryNoteId ?? null,
      createdById: input.createdById,
      createdAt,
    },
  });

  await db.product.update({
    where: { id: input.productId },
    data: { stock: { increment: delta } },
  });

  await db.inventory.upsert({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    create: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
    },
    update: { quantity: { increment: delta } },
  });

  return txn;
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

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

  // --- Kategori ---------------------------------------------------------
  const categoryMap = new Map<string, number>();
  for (const def of CATEGORY_DEFS) {
    const category = await prisma.category.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name },
    });
    categoryMap.set(def.name, category.id);
  }

  // --- Produk (120) -----------------------------------------------------
  const seedProducts = buildProducts();
  if (seedProducts.length !== 120) {
    throw new Error(`Jumlah produk harus 120, saat ini ${seedProducts.length}`);
  }

  const products: { id: string; sku: string; name: string; seed: SeedProduct }[] = [];
  for (const p of seedProducts) {
    const categoryId = categoryMap.get(p.category);
    if (!categoryId) throw new Error(`Kategori ${p.category} tidak ditemukan`);

    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        description: p.description,
        categoryId,
      },
      create: {
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        stock: p.stock,
        minStock: p.minStock,
        description: p.description,
        categoryId,
      },
    });

    products.push({ id: product.id, sku: p.sku, name: p.name, seed: p });
  }

  // Bersihkan kategori bawaan seed lama yang sudah tidak dipakai (tanpa produk).
  await prisma.category.deleteMany({
    where: {
      name: { notIn: CATEGORY_DEFS.map((d) => d.name) },
      products: { none: {} },
    },
  });

  // --- Partner (50) -----------------------------------------------------
  const seedPartners = buildPartners();
  const partners: { id: string; name: string; type: PartnerType }[] = [];
  for (const p of seedPartners) {
    const existing = await prisma.partner.findFirst({ where: { name: p.name } });
    const partner =
      existing ??
      (await prisma.partner.create({
        data: {
          name: p.name,
          type: p.type,
          phone: p.phone,
          email: p.email,
          address: p.address,
        },
      }));
    partners.push({ id: partner.id, name: partner.name, type: partner.type });
  }

  const suppliers = partners.filter((p) => p.type === "SUPPLIER");
  const customers = partners.filter((p) => p.type === "CUSTOMER");
  const actorId = admin.id;

  // --- Reset data transaksional agar seed bisa diulang ------------------
  await prisma.stockTransaction.deleteMany();
  await prisma.deliveryNoteItem.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.updateMany({ data: { stock: 0 } });

  const stockMap = new Map<string, number>();
  const rng = createRng(hashString("seed-transactions-2026"));

  // --- Stok awal --------------------------------------------------------
  for (const product of products) {
    const qty = product.seed.stock + OPENING_BUFFER;
    await applyStockSeed(
      prisma,
      "IN",
      {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        createdById: actorId,
        notes: "Stok awal",
        referenceNo: "OPENING",
      },
      daysAgo(90),
    );
    stockMap.set(product.id, qty);
  }

  // --- Transaksi historis 90 hari --------------------------------------
  for (let i = 0; i < HISTORICAL_COUNT; i += 1) {
    const product = products[Math.floor(rng() * products.length)];
    const day = 90 - Math.floor((i / HISTORICAL_COUNT) * 85);
    const roll = rng();

    if (roll < 0.55) {
      const qty = 5 + Math.floor(rng() * 76);
      const supplier = pick(rng, suppliers);
      await applyStockSeed(
        prisma,
        "IN",
        {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: qty,
          createdById: actorId,
          partnerId: supplier.id,
          notes: `Pembelian dari ${supplier.name}`,
        },
        daysAgo(day),
      );
      stockMap.set(product.id, (stockMap.get(product.id) ?? 0) + qty);
    } else if (roll < 0.95) {
      const available = stockMap.get(product.id) ?? 0;
      const qty = 1 + Math.floor(rng() * 30);
      if (available >= qty) {
        const customer = pick(rng, customers);
        await applyStockSeed(
          prisma,
          "OUT",
          {
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: qty,
            createdById: actorId,
            partnerId: customer.id,
            notes: `Penjualan ke ${customer.name}`,
          },
          daysAgo(day),
        );
        stockMap.set(product.id, available - qty);
      }
    } else {
      const qty = 1 + Math.floor(rng() * 10);
      await applyStockSeed(
        prisma,
        "ADJUSTMENT",
        {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: qty,
          createdById: actorId,
          notes: "Koreksi stok opname",
        },
        daysAgo(day),
      );
      stockMap.set(product.id, (stockMap.get(product.id) ?? 0) + qty);
    }
  }

  // --- Purchase Order (20) ---------------------------------------------
  const PO_STATUS_PLAN = [
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "CONFIRMED",
    "CONFIRMED",
    "CONFIRMED",
    "CONFIRMED",
    "CONFIRMED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "CANCELLED",
    "CANCELLED",
    "CANCELLED",
  ] as const;

  const poPool: { id: string; items: { productId: string; quantity: number }[] }[] = [];
  const poCounters = new Map<string, number>();

  for (let i = 0; i < PO_STATUS_PLAN.length; i += 1) {
    const status = PO_STATUS_PLAN[i];
    const supplier = suppliers[i % suppliers.length];
    const created = daysAgo(45 - i * 2);
    const poMonth = created.toISOString().slice(0, 7).replace("-", "");
    const poSeq = (poCounters.get(poMonth) ?? 0) + 1;
    poCounters.set(poMonth, poSeq);
    const poNumber = `PO-${poMonth}-${String(poSeq).padStart(3, "0")}`;

    const itemCount = 1 + Math.floor(rng() * 3);
    const chosen = new Set<number>();
    while (chosen.size < itemCount) chosen.add(Math.floor(rng() * products.length));
    const items = [...chosen].map((idx) => {
      const product = products[idx];
      const quantity = 10 + Math.floor(rng() * 51);
      return {
        productId: product.id,
        quantity,
        unitPrice: new Prisma.Decimal(2000 + Math.floor(rng() * 48000)),
      };
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        status,
        source: "WEB",
        targetDate: new Date(created.getTime() + 7 * DAY_MS),
        notes: `Pemesanan ke ${supplier.name}`,
        partnerId: supplier.id,
        warehouseId: warehouse.id,
        createdById: actorId,
        items: { create: items },
      },
    });

    if (status === "COMPLETED") {
      for (const item of items) {
        await applyStockSeed(
          prisma,
          "IN",
          {
            productId: item.productId,
            warehouseId: warehouse.id,
            quantity: item.quantity,
            createdById: actorId,
            partnerId: supplier.id,
            purchaseOrderId: po.id,
            referenceNo: poNumber,
            notes: `Penerimaan PO ${poNumber}`,
          },
          new Date(created.getTime() + 3 * DAY_MS),
        );
        stockMap.set(item.productId, (stockMap.get(item.productId) ?? 0) + item.quantity);
      }
    }

    if (status === "CONFIRMED" || status === "COMPLETED") {
      poPool.push({ id: po.id, items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })) });
    }
  }

  // --- Surat Jalan (15) -------------------------------------------------
  const DN_STATUS_PLAN = [
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "DRAFT",
    "SHIPPED",
    "SHIPPED",
    "SHIPPED",
    "SHIPPED",
    "SHIPPED",
    "DELIVERED",
    "DELIVERED",
    "DELIVERED",
    "CANCELLED",
    "CANCELLED",
    "CANCELLED",
  ] as const;

  const dnCounters = new Map<string, number>();

  for (let i = 0; i < DN_STATUS_PLAN.length; i += 1) {
    const status = DN_STATUS_PLAN[i];
    const customer = customers[i % customers.length];
    const shipDate = daysAgo(30 - i);
    const dnMonth = shipDate.toISOString().slice(0, 7).replace("-", "");
    const dnSeq = (dnCounters.get(dnMonth) ?? 0) + 1;
    dnCounters.set(dnMonth, dnSeq);
    const dnNumber = `SJ-${dnMonth}-${String(dnSeq).padStart(3, "0")}`;

    let poId: string | null = null;
    let items: { productId: string; quantity: number }[];

    if (i % 2 === 0 && poPool.length > 0) {
      const po = poPool[Math.floor(rng() * poPool.length)];
      poId = po.id;
      items = po.items.map((it) => ({ productId: it.productId, quantity: it.quantity }));
    } else {
      const itemCount = 1 + Math.floor(rng() * 3);
      const chosen = new Set<number>();
      while (chosen.size < itemCount) chosen.add(Math.floor(rng() * products.length));
      items = [...chosen].map((idx) => ({
        productId: products[idx].id,
        quantity: 5 + Math.floor(rng() * 21),
      }));
    }

    const dn = await prisma.deliveryNote.create({
      data: {
        dnNumber,
        status,
        shipDate,
        notes: `Pengiriman ke ${customer.name}`,
        poId,
        partnerId: customer.id,
        warehouseId: warehouse.id,
        createdById: actorId,
        items: { create: items },
      },
    });

    if (status === "SHIPPED" || status === "DELIVERED") {
      for (const item of items) {
        const available = stockMap.get(item.productId) ?? 0;
        if (available < item.quantity) continue;
        await applyStockSeed(
          prisma,
          "OUT",
          {
            productId: item.productId,
            warehouseId: warehouse.id,
            quantity: item.quantity,
            createdById: actorId,
            partnerId: customer.id,
            deliveryNoteId: dn.id,
            referenceNo: dnNumber,
            notes: `Pengiriman ${dnNumber}`,
          },
          shipDate,
        );
        stockMap.set(item.productId, available - item.quantity);
      }
    }
  }

  // --- Buat sebagian produk berada di bawah minStock --------------------
  for (const product of products) {
    if (!product.seed.lowStock) continue;
    const available = stockMap.get(product.id) ?? 0;
    const desired = product.seed.lowStockTarget;
    if (available <= desired) continue;
    const qty = available - desired;
    const customer = pick(rng, customers);
    await applyStockSeed(
      prisma,
      "OUT",
      {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        createdById: actorId,
        partnerId: customer.id,
        notes: `Penjualan grosir ke ${customer.name}`,
        referenceNo: "LOWSTOCK",
      },
      daysAgo(3),
    );
    stockMap.set(product.id, desired);
  }

  const [productCount, partnerCount, supplierCount, customerCount, poCount, dnCount, txnCount, inventoryCount] =
    await Promise.all([
      prisma.product.count(),
      prisma.partner.count(),
      prisma.partner.count({ where: { type: "SUPPLIER" } }),
      prisma.partner.count({ where: { type: "CUSTOMER" } }),
      prisma.purchaseOrder.count(),
      prisma.deliveryNote.count(),
      prisma.stockTransaction.count(),
      prisma.inventory.count(),
    ]);

  console.log("Seed selesai.");
  console.log(`  superadmin: ${superAdmin.email} / ${PASSWORD}`);
  console.log(`  admin:      ${admin.email} / ${PASSWORD}`);
  console.log("  owner:      owner@umkm.id / password123 (telegramId 123456789)");
  console.log("Ringkasan data:");
  console.log(`  produk:      ${productCount}`);
  console.log(`  partner:     ${partnerCount} (supplier ${supplierCount}, customer ${customerCount})`);
  console.log(`  purchase PO: ${poCount}`);
  console.log(`  surat jalan: ${dnCount}`);
  console.log(`  transaksi:   ${txnCount}`);
  console.log(`  inventory:   ${inventoryCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
