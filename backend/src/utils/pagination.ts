export type Pagination = { page: number; limit: number; skip: number; take: number };

export function parsePagination(query: { page?: unknown; limit?: unknown }): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
