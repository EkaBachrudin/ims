import { endOfDay, format, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";

export async function stockReport(query: {
  q?: string;
  categoryId?: number;
  warehouseId?: string;
}) {
  const products = await prisma.product.findMany({
    where: {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { sku: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      inventories: query.warehouseId
        ? { where: { warehouseId: query.warehouseId }, include: { warehouse: { select: { id: true, code: true, name: true } } } }
        : { include: { warehouse: { select: { id: true, code: true, name: true } } } },
    },
  });

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    stock: p.stock,
    minStock: p.minStock,
    category: p.category,
    lowStock: p.stock <= p.minStock,
    inventories: p.inventories,
  }));
}

export async function findStockByProductName(productName: string) {
  const product = await prisma.product.findFirst({
    where: { name: { contains: productName, mode: "insensitive" } },
    orderBy: { name: "asc" },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!product) return null;
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    stock: product.stock,
    minStock: product.minStock,
    category: product.category,
  };
}

export async function shipmentRecap(dateInput: string) {
  // Interpretasikan YYYY-MM-DD sebagai tanggal lokal (hindari pergeseran timezone).
  const parts = dateInput ? dateInput.split("-").map(Number) : [];
  const [y, m, d] = parts;
  const date =
    parts.length === 3 && y && m && d ? new Date(y, m - 1, d) : new Date();
  const from = startOfDay(date);
  const to = endOfDay(date);

  const rows = await prisma.stockTransaction.findMany({
    where: { type: "OUT", createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true, unit: true, sku: true } },
      partner: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  return {
    date: format(date, "yyyy-MM-dd"),
    shipments: rows.map((r) => ({
      partner: r.partner?.name ?? "-",
      product: r.product.name,
      sku: r.product.sku,
      qty: r.quantity,
      unit: r.product.unit,
      warehouse: r.warehouse.name,
      notes: r.notes,
    })),
  };
}

export async function lowStock() {
  const products = await prisma.product.findMany({
    orderBy: { stock: "asc" },
    include: { category: { select: { id: true, name: true } } },
  });
  return products
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock: p.stock,
      minStock: p.minStock,
      category: p.category,
    }));
}

export async function dashboard() {
  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(now);

  const [totalProducts, activePOs, todayInbound, todayOutbound, lowStockRows] = await Promise.all([
    prisma.product.count(),
    prisma.purchaseOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } }),
    prisma.stockTransaction.count({ where: { type: "IN", createdAt: { gte: from, lte: to } } }),
    prisma.stockTransaction.count({ where: { type: "OUT", createdAt: { gte: from, lte: to } } }),
    prisma.product.findMany({ orderBy: { stock: "asc" } }),
  ]);

  const recentTransactions = await prisma.stockTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return {
    totalProducts,
    activePOs,
    todayInbound,
    todayOutbound,
    lowStockCount: lowStockRows.filter((p) => p.stock <= p.minStock).length,
    recentTransactions,
  };
}
