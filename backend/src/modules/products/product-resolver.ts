import type { PrismaClient } from "@prisma/client";
import { prisma, type PrismaTx } from "../../lib/prisma";
import { Errors } from "../../lib/errors";

type Db = PrismaTx | PrismaClient;

export interface ResolvedProduct {
  id: string;
  name: string;
  sku: string;
}

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kilo: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  ml: "ml",
  mililiter: "ml",
  milliliter: "ml",
  mililiters: "ml",
};

/**
 * Normalisasi nama produk agar variasi penulisan manusia cocok dengan katalog:
 * - huruf kecil, tanpa diakritik
 * - satuan disamakan & spasi angka-satuan dihilangkan ("1 kilo" -> "1kg", "500 g" -> "500g")
 * - singkatan pengulangan Bahasa Indonesia ("cumi2" -> "cumicumi")
 * - tanda baca/strip menjadi pemisah ("Cumi-Cumi" -> "cumi cumi")
 */
export function normalizeName(value: string): string {
  let s = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  s = s.replace(/(\d+)\s*([a-z]+)/g, (match, num: string, unit: string) => {
    const alias = UNIT_ALIASES[unit];
    return alias ? `${num}${alias}` : match;
  });

  s = s.replace(/([a-z]+)2\b/g, "$1$1");
  s = s.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}

export function tokenize(value: string): string[] {
  const normalized = normalizeName(value);
  return normalized.length ? normalized.split(" ") : [];
}

function tokenMatches(queryToken: string, candidateToken: string): boolean {
  if (queryToken === candidateToken) return true;
  if (queryToken.length >= 4 && candidateToken.includes(queryToken)) return true;
  if (candidateToken.length >= 4 && queryToken.includes(candidateToken)) return true;
  return false;
}

async function loadProducts(db: Db): Promise<ResolvedProduct[]> {
  return db.product.findMany({
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
  });
}

function namesOf(products: ResolvedProduct[]): string {
  return products.map((p) => `"${p.name}"`).join(", ");
}

function suggestionsFor(queryTokens: string[], products: ResolvedProduct[]): ResolvedProduct[] {
  if (queryTokens.length === 0) return [];
  return products
    .map((product) => {
      const candidateTokens = tokenize(product.name);
      const score = queryTokens.reduce(
        (acc, qt) => acc + (candidateTokens.some((ct) => tokenMatches(qt, ct)) ? 1 : 0),
        0,
      );
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, 5)
    .map((entry) => entry.product);
}

export type ResolveResult =
  | { status: "ok"; product: ResolvedProduct }
  | { status: "ambiguous"; candidates: ResolvedProduct[] }
  | { status: "none"; suggestions: ResolvedProduct[] };

/** Temukan satu produk dari nama bebas (normalisasi + kecocokan token). */
export async function resolveProduct(name: string, db: Db = prisma): Promise<ResolveResult> {
  const products = await loadProducts(db);
  const normalizedQuery = normalizeName(name);
  const queryTokens = normalizedQuery.length ? normalizedQuery.split(" ") : [];

  const exact = products.filter((p) => normalizeName(p.name) === normalizedQuery);
  if (exact.length === 1) return { status: "ok", product: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };

  const matched = products.filter(
    (p) =>
      queryTokens.length > 0 &&
      queryTokens.every((qt) => tokenize(p.name).some((ct) => tokenMatches(qt, ct))),
  );
  if (matched.length === 1) return { status: "ok", product: matched[0] };
  if (matched.length > 1) return { status: "ambiguous", candidates: matched };

  return { status: "none", suggestions: suggestionsFor(queryTokens, products) };
}

/**
 * Seperti resolveProduct, tetapi memberikan error yang informatif bila nama ambigu
 * (beberapa kandidat) atau tidak ditemukan (menyertakan saran produk mirip).
 */
export async function resolveProductOrThrow(name: string, db: Db = prisma): Promise<ResolvedProduct> {
  const result = await resolveProduct(name, db);
  if (result.status === "ok") return result.product;
  if (result.status === "ambiguous") {
    throw Errors.unprocessable(
      `Produk "${name}" cocok dengan beberapa produk: ${namesOf(result.candidates)}. Mohon sebutkan nama yang lebih spesifik.`,
    );
  }
  const hint = result.suggestions.length ? ` Mungkin maksud: ${namesOf(result.suggestions)}.` : "";
  throw Errors.unprocessable(`Produk "${name}" tidak ditemukan.${hint}`);
}
