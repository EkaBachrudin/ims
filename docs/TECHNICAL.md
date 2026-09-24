# Technical Design Document (Build Guide)

**Project:** Otomatisasi Warehouse Management System (WMS) dan Tata Kelola Dokumen Berbasis Web dengan Integrasi Asisten AI (RAG) pada Platform Pesan Instan

**Document Type:** Technical Design Document / Developer Build Guide
**Version:** 1.0.0
**Status:** Draft
**Author:** Project Owner
**Date:** 2026-09-22

**Related Documents:** [BRD](./BRD.md) · [FSD](./FSD.md) · [ERD](./ERD.md)

> **Scope dokumen:** panduan teknis implementasi untuk **pengembangan lokal (local development)**. Snippet bersifat acuan implementasi, bukan full scaffolding. Deployment & CI/CD dibahas terpisah pada dokumen lain.

---

## 1. Document Control

### 1.1 Revision History

| Version | Date       | Author        | Description                                  |
| :------ | :--------- | :------------ | :------------------------------------------- |
| 1.0.0   | 2026-09-22 | Project Owner | Initial technical build guide from BRD/FSD/ERD|

### 1.2 Convention Reference

| Aspect        | Standard                                                        |
| :------------ | :-------------------------------------------------------------- |
| Language      | TypeScript (strict) pada semua service                          |
| Package mgr   | `npm` (workspaces opsional)                                     |
| API style     | REST, JSON, envelope `{ success, data, error }`                 |
| Env           | `.env` per service, tidak di-commit (`.env.example` disediakan) |
| DB access     | Prisma ORM (hanya Backend; AI Agent via HTTP API)               |
| Diagrams      | Mermaid                                                          |

---

## 2. Architecture Overview

### 2.1 Component Diagram (Local)

```mermaid
flowchart TB
    subgraph Host["Developer Machine (localhost)"]
        FE[frontend :5173<br/>Vite + React]
        BE[backend :3000<br/>Express + TS + Prisma]
        AI[ai-agent :8080<br/>LangChain + Telegraf]
        DB[(db :5432<br/>PostgreSQL + pgvector)]
    end
    TG([Telegram Bot API])
    LLM([OpenAI / Gemini API])

    FE -->|REST| BE
    AI <-->|REST / Function Calling| BE
    AI <-->|Long Polling local| TG
    AI <-->|HTTPS| LLM
    BE -->|Prisma read/write| DB
    AI -.->|"pgvector read-only (RAG)"| DB
```

> **Pemisahan akses DB:** Backend memegang akses **read/write** penuh (satu-satunya penulis data bisnis). AI Agent hanya diberi akses **read-only** ke tabel vector `document_chunks` untuk retrieval knowledge/SOP. Data bisnis (stok, PO, transaksi) tetap diakses AI Agent melalui Backend REST API.

### 2.2 Service Matrix

| Service    | Port lokal | Teknologi                         | Tanggung jawab                                     |
| :--------- | :--------- | :-------------------------------- | :------------------------------------------------- |
| `frontend` | 5173       | Vite, React, TS, Tailwind, TanStack Query | Dashboard WMS admin                         |
| `backend`  | 3000       | Express, TS, Prisma, Zod          | REST API, logika bisnis, auth, scheduler stok       |
| `ai-agent` | 8080       | Node, TS, LangChain.js, Telegraf  | Webhook/chat, intent, function calling ke backend, RAG retrieval (pgvector, read-only) |
| `db`       | 5432       | PostgreSQL + pgvector             | Data relasional + vector store knowledge/SOP        |

### 2.3 Architectural Rules

1. **Single source of truth** = Backend REST API + PostgreSQL. Frontend **tidak** mengakses DB langsung; AI Agent hanya **read-only** ke `document_chunks` (knowledge base RAG).
2. **AI Agent = orchestrator**, bukan query engine. Semua read/write **data bisnis** lewat endpoint backend (FSD BR-RULE-007). Akses DB langsung dibatasi hanya untuk retrieval vector (tanpa menulis).
3. **Stok hanya berubah lewat transaksi** (`StockTransaction`), di dalam DB transaction atomic (BR-RULE-001).
4. **Backend stateless** (JWT) agar mudah di-scale dan diuji.
5. **Prinsip least privilege:** user DB untuk AI Agent diberikan `GRANT SELECT` hanya pada `document_chunks`. Ingestion dokumen dijalankan sebagai proses offline terpisah (lihat §9.7).
6. **AI Agent tidak memiliki akses tulis data bisnis**; pembuatan PO tetap melalui `POST /po/draft` di backend.

---

## 3. Repository Layout

```text
inventory-rag/
├── docs/                     # BRD, FSD, ERD, TECHNICAL
├── docker-compose.yml        # orkestrasi 4 service
├── .env.example              # contoh env root (untuk compose)
├── package.json              # opsional: workspace root scripts
├── backend/
├── frontend/
└── ai-agent/
```

### 3.1 Backend

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── config/               # env loader, constants
│   ├── lib/
│   │   ├── prisma.ts         # PrismaClient singleton
│   │   └── errors.ts         # AppError
│   ├── middlewares/
│   │   ├── auth.ts           # verify JWT
│   │   ├── rbac.ts           # requireRole(...)
│   │   ├── validate.ts       # Zod validator
│   │   └── errorHandler.ts   # global error handler
│   ├── modules/              # per domain: route + controller + service
│   │   ├── auth/
│   │   ├── users/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── partners/
│   │   ├── warehouses/
│   │   ├── transactions/
│   │   ├── purchase-orders/
│   │   ├── delivery-notes/
│   │   └── reports/
│   ├── utils/                # numbering, pagination, datetime
│   ├── app.ts                # express app assembly
│   └── server.ts             # listen()
├── .env
├── tsconfig.json
└── package.json
```

### 3.2 Frontend

```text
frontend/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx     # QueryClientProvider, AuthProvider
│   ├── api/
│   │   ├── client.ts         # axios instance + interceptors
│   │   └── endpoints.ts      # typed API functions
│   ├── hooks/
│   │   ├── queryKeys.ts      # query key factory
│   │   └── mutations.ts
│   ├── features/             # products/, partners/, po/, transactions/, ...
│   │   └── <feature>/
│   │       ├── components/
│   │       ├── hooks.ts      # useQuery/useMutation per fitur
│   │       └── pages.tsx
│   ├── components/ui/        # Table, Button, Modal, Input
│   ├── lib/                  # utils, formatters
│   ├── types/                # shared types
│   └── main.tsx
├── .env
├── tailwind.config.ts
└── vite.config.ts
```

### 3.3 AI Agent

```text
ai-agent/
├── src/
│   ├── config/env.ts
│   ├── db.ts                 # pg/Prisma client READ-ONLY (document_chunks)
│   ├── services/
│   │   └── backendClient.ts  # HTTP client ke backend
│   ├── rag/
│   │   ├── embeddings.ts     # OpenAI embeddings helper
│   │   ├── retriever.ts      # query top-K ke document_chunks
│   │   └── ingest.ts         # (offline) chunk + embed + upsert dokumen SOP
│   ├── agent/
│   │   ├── tools.ts          # LangChain tools (baca data + tulis draft PO + knowledge)
│   │   ├── prompt.ts         # system prompt
│   │   └── agent.ts          # createToolCallingAgent + executor
│   ├── bot/
│   │   ├── telegram.ts       # Telegraf setup + handlers
│   │   └── auth.ts           # mapping chatId -> user
│   ├── logger.ts             # log ke AiConversationLog (via BE)
│   └── index.ts
├── docs/knowledge/           # sumber dokumen SOP (markdown/txt) untuk ingest
├── .env
└── package.json
```

---

## 4. Prerequisites & Tooling

| Tool           | Version (min) | Notes                                       |
| :------------- | :------------ | :------------------------------------------ |
| Node.js        | 20 LTS        | Gunakan `nvm`. Sudah termasuk `npm`.        |
| npm            | 10+           | Bawaan Node.js 20 LTS.                      |
| Docker         | 24+           | + Docker Compose v2.                        |
| Git            | 2.40+         |                                             |
| OpenSSL        | —             | Untuk generate `JWT_SECRET`.                |

**Rekomendasi ekstensi editor:** ESLint, Prettier, Prisma, Tailwind CSS IntelliSense, Mermaid Preview.

---

## 5. Environment Configuration

Buat `.env` pada masing-masing service. **Jangan commit** `.env`; commit `.env.example`.

### 5.1 Root (untuk `docker-compose.yml`)

```dotenv
# .env.example (root)
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=wms_db

# Dipakai saat menjalankan seluruh stack via docker compose
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...
INTERNAL_API_KEY=change_me_internal
```

### 5.2 Backend

```dotenv
# backend/.env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/wms_db
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=http://localhost:5173
INTERNAL_API_KEY=change_me_internal   # dipakai AI Agent utk endpoint /po/draft & /reports
```

### 5.3 Frontend

```dotenv
# frontend/.env.example
VITE_API_BASE_URL=http://localhost:3000/api
```

### 5.4 AI Agent

```dotenv
# ai-agent/.env.example
# --------------------------------------------
# General
# --------------------------------------------
NODE_ENV=development
PORT=8080

# --------------------------------------------
# Backend API (business data via HTTP)
# --------------------------------------------
BACKEND_API_URL=http://localhost:3000/api
INTERNAL_API_KEY=change_me_internal

# --------------------------------------------
# Telegram Bot
# --------------------------------------------
TELEGRAM_BOT_TOKEN=123456:ABC...

# --------------------------------------------
# OpenAI (LLM + embeddings)
# --------------------------------------------
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
LLM_TEMPERATURE=0

# --------------------------------------------
# RAG / agent tuning
# --------------------------------------------
AGENT_TOP_K=12
MAX_HISTORY_TURNS=20
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# --------------------------------------------
# Database (read-only untuk RAG vector store; dishare dgn backend)
# DB_HOST di-override ke "db" oleh docker compose.
# --------------------------------------------
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wms_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### 5.5 Catatan Environment

| Variabel                | Service | Fungsi                                                                 |
| :---------------------- | :------ | :--------------------------------------------------------------------- |
| `EMBEDDING_DIMENSIONS`  | ai-agent | Harus sama dengan `vector(1536)` pada `DocumentChunk` (ERD §3.15).    |
| `AGENT_TOP_K`           | ai-agent | Jumlah chunk teratas yang diambil saat retrieval RAG.                  |
| `MAX_HISTORY_TURNS`     | ai-agent | Batas giliran riwayat percakapan yang dikirim ke LLM.                    |
| `CHUNK_SIZE`/`CHUNK_OVERLAP` | ai-agent | Ukuran & tumpang tindih potongan saat ingest dokumen.              |
| `DB_*`                  | ai-agent | Koneksi **read-only** runtime ke `document_chunks`; di compose `DB_HOST=db`. |
| `INTERNAL_API_KEY`      | backend/ai-agent | Menyamakan key untuk endpoint internal (`/po/draft`, `/reports/*`, `/internal/*`). |

> **Keamanan:** gunakan user DB terpisah untuk AI Agent dengan hak **`GRANT SELECT`** hanya pada tabel `document_chunks`. Jangan gunakan user superuser. `DATABASE_URL` backend (read/write) tidak dibagikan ke AI Agent.
>
> **Host koneksi:** `DATABASE_URL` backend mensyaratkan host `localhost` karena Backend dijalankan di host; jika seluruh service jalan via Docker Compose, host menjadi `db:5432` (lihat `docker-compose.yml` di §6.1).

---

## 6. Local Setup Quickstart

```bash
# 1. Clone & masuk
git clone <repo-url> inventory-rag && cd inventory-rag

# 2. Siapkan env
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-agent/.env.example ai-agent/.env

# 3. Nyalakan database (pgvector)
docker compose up -d db

# 4. Backend: install, migrate, seed, jalankan
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev         # http://localhost:3000

# 5. Frontend (terminal baru)
cd frontend
npm install
npm run dev         # http://localhost:5173

# 6. AI Agent (terminal baru)
cd ai-agent
npm install
npm run rag:ingest   # opsional: embed dokumen SOP ke document_chunks
npm run dev          # bot long-polling di http://localhost:8080
```

**Alternatif:** `docker compose up --build` untuk menjalankan semuanya sekaligus (kecuali Anda butuh hot-reload yang lebih cepat di host).

### 6.1 `docker-compose.yml` (Local)

```yaml
version: '3.8'

services:
  db:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  ai-agent:
    build: ./ai-agent
    environment:
      - NODE_ENV=development
      - PORT=8080
      - BACKEND_API_URL=http://backend:3000/api
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
      - OPENAI_EMBEDDING_MODEL=${OPENAI_EMBEDDING_MODEL:-text-embedding-3-small}
      - EMBEDDING_DIMENSIONS=${EMBEDDING_DIMENSIONS:-1536}
      - LLM_TEMPERATURE=0
      - AGENT_TOP_K=12
      - MAX_HISTORY_TURNS=20
      - CHUNK_SIZE=1000
      - CHUNK_OVERLAP=200
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=${POSTGRES_DB}
      - DB_USER=${POSTGRES_USER}
      - DB_PASSWORD=${POSTGRES_PASSWORD}
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
      backend:
        condition: service_started

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:3000/api
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## 7. Backend Technical Specification

### 7.1 Layered Architecture

```mermaid
flowchart LR
    R[Route] --> V[validate Zod] --> MW[auth / rbac] --> C[Controller] --> S[Service] --> P[Prisma] --> DB[(PostgreSQL)]
    S --> A[Audit helper]
```

- **Route**: hanya memetakan path + middleware + controller.
- **Controller**: parsing request, memanggil service, membentuk response. Tidak ada logika bisnis.
- **Service**: logika bisnis, validasi aturan, akses Prisma. **Satu-satunya tempat** Prisma dipakai.
- **Utils/helper**: numbering, pagination, audit.

### 7.2 Core Files

**`src/lib/prisma.ts`** — singleton (hindari koneksi ganda saat hot-reload):

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**`src/lib/errors.ts`** — error terstruktur:

```ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const Errors = {
  validation: () => new AppError("VALIDATION_ERROR", 400, "Invalid input"),
  unauthenticated: () => new AppError("UNAUTHENTICATED", 401, "Missing or invalid token"),
  forbidden: () => new AppError("FORBIDDEN", 403, "Insufficient role"),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", 404, `${what} not found`),
  insufficientStock: () => new AppError("INSUFFICIENT_STOCK", 409, "Outbound exceeds available stock"),
  invalidState: (msg = "Illegal state transition") => new AppError("INVALID_STATE", 409, msg),
};
```

**`src/middlewares/validate.ts`** — validasi request dengan Zod:

```ts
import type { RequestHandler } from "express";
import { ZodSchema } from "zod";
import { Errors } from "../lib/errors";

export const validate =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) return next(Errors.validation());
    Object.assign(req, result.data);
    next();
  };
```

**`src/middlewares/auth.ts` & `rbac.ts`:**

```ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Errors } from "../lib/errors";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Errors.unauthenticated());
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET!) as {
      sub: string;
      role: string;
    };
    (req as any).user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(Errors.unauthenticated());
  }
};

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) return next(Errors.forbidden());
    next();
  };

// Internal auth untuk AI Agent (endpoint /po/draft & /reports/*)
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) return next(Errors.forbidden());
  next();
};
```

**`src/middlewares/errorHandler.ts`:**

```ts
import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
  res.status(status).json({ success: false, error: { code, message: err.message } });
};
```

**`src/app.ts`:**

```ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/errorHandler";
import { router } from "./routes";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") }));
  app.use(express.json());
  app.use("/api", router);
  app.use(errorHandler);
  return app;
}
```

### 7.3 Atomic Stock Update (Core Logic)

Semua perubahan stok **wajib** melalui DB transaction. Contoh service transaksi:

```ts
import { TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

type RecordInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  partnerId?: string;
  createdById: string;
};

async function applyStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  type: TransactionType,
  input: RecordInput,
) {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, stock: true },
  });
  if (!product) throw Errors.notFound("Product");

  if (type === "OUT" && product.stock < input.quantity) throw Errors.insufficientStock();

  const delta = type === "OUT" ? -input.quantity : input.quantity;

  const txn = await tx.stockTransaction.create({
    data: { type, ...input },
  });

  await tx.product.update({
    where: { id: input.productId },
    data: { stock: { increment: delta } },
  });

  await tx.inventory.upsert({
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
    create: { productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity },
    update: { quantity: { increment: delta } },
  });

  return txn;
}

export const recordTransaction = (type: "IN" | "OUT", input: RecordInput) =>
  prisma.$transaction((tx) => applyStock(tx, type, input));
```

> **Catatan race condition:** Pendekatan di atas aman untuk skala UMKM/capstone. Untuk trafik tinggi, pertimbangkan `SELECT ... FOR UPDATE` atau kolom versi optimistik.

### 7.4 PO Number Generation

```ts
import { format } from "date-fns";

export async function generatePoNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  date: Date = new Date(),
) {
  const yyyymm = format(date, "yyyyMM");
  const prefix = `PO-${yyyymm}-`;
  const count = await tx.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
```

Validasi transisi status PO (`DRAFT → CONFIRMED → COMPLETED`, `→ CANCELLED`):

```ts
const allowed: Record<string, string[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertPoTransition(from: string, to: string) {
  if (!allowed[from]?.includes(to)) throw Errors.invalidState(`Cannot change PO ${from} -> ${to}`);
}
```

### 7.5 Audit Log Helper

```ts
import { prisma } from "./prisma";

export async function audit(params: {
  actorId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "VOID";
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({ data: params as any });
}
```

### 7.6 API Response Conventions

```ts
// success
res.status(201).json({ success: true, data });
// list + pagination
res.json({ success: true, data: rows, meta: { page, limit, total } });
// error (dilempar AppError, ditangani errorHandler)
```

### 7.7 Prisma Workflow

```bash
npx prisma generate                 # regenerate client setelah ubah schema
npx prisma migrate dev --name <msg> # buat & terapkan migration (dev)
npx prisma migrate reset            # reset DB + re-apply + seed
npx prisma studio                   # GUI inspeksi data
npx prisma db seed                  # jalankan seed.ts
```

### 7.8 Seed Example (`prisma/seed.ts`)

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const warehouse = await prisma.warehouse.create({
    data: { code: "GDG-01", name: "Gudang Utama" },
  });

  const frozen = await prisma.category.create({ data: { name: "Frozen Food" } });

  const product = await prisma.product.create({
    data: { sku: "DMS-SDG-01", name: "Dimsum Ayam Ukuran Sedang", unit: "pack", stock: 0, categoryId: frozen.id },
  });

  await prisma.inventory.create({ data: { productId: product.id, warehouseId: warehouse.id, quantity: 120 } });
  await prisma.product.update({ where: { id: product.id }, data: { stock: 120 } });

  await prisma.partner.createMany({
    data: [
      { name: "PT Maju Jaya", type: "CUSTOMER" },
      { name: "CV Sumber Frozen", type: "SUPPLIER" },
    ],
  });

  await prisma.user.create({
    data: {
      email: "admin@umkm.id",
      name: "Admin Gudang",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "owner@umkm.id",
      name: "Owner",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "OWNER",
      telegramId: "123456789",
    },
  });
}

main().finally(() => prisma.$disconnect());
```

---

## 8. Frontend Technical Specification

### 8.1 Providers

```tsx
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### 8.2 API Client + Token Refresh Interceptor

```ts
// src/api/client.ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh });
        localStorage.setItem("access_token", data.data.accessToken);
        error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(error.config);
      }
    }
    return Promise.reject(error);
  },
);
```

### 8.3 Query Key Factory

```ts
// src/hooks/queryKeys.ts
export const qk = {
  products: {
    all: ["products"] as const,
    list: (filters: unknown) => ["products", "list", filters] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  partners: { all: ["partners"] as const, list: (f: unknown) => ["partners", "list", f] as const },
  transactions: { list: (f: unknown) => ["transactions", "list", f] as const },
  purchaseOrders: {
    all: ["purchase-orders"] as const,
    list: (f: unknown) => ["purchase-orders", "list", f] as const,
    detail: (id: string) => ["purchase-orders", "detail", id] as const,
  },
  reports: { stock: (f: unknown) => ["reports", "stock", f] as const },
};
```

### 8.4 Query & Mutation Pattern (Invalidation)

```tsx
// src/features/transactions/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/api/client";

export function useProducts() {
  return useQuery({
    queryKey: qk.products.list({}),
    queryFn: async () => (await api.get("/products")).data.data,
  });
}

export function useCreateInbound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { productId: string; warehouseId: string; quantity: number }) =>
      (await api.post("/transactions/inbound", payload)).data.data,
    onSuccess: () => {
      // stok & tabel transaksi otomatis ter-refresh (FSD AC-13)
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: qk.reports.stock({}) });
    },
  });
}
```

**Aturan caching:**

| Data                | `staleTime` | Invalidasi setelah mutasi            |
| :------------------ | :---------- | :----------------------------------- |
| Master data         | 60s         | create/update/delete entitas terkait |
| Transaksi/stok      | 15s         | inbound/outbound/void                |
| PO list/detail      | 15s         | create/confirm/cancel + penerimaan    |
| Reports             | 30s         | transaksi/PO/DN berubah              |

### 8.5 Protected Routes

```tsx
// src/app/router.tsx (ringkas)
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}
```

---

## 9. AI Agent Technical Specification

AI Agent memiliki **dua sumber data**: (1) **data bisnis** melalui Backend REST API (function calling), dan (2) **knowledge/SOP** melalui retrieval vector **read-only** dari `document_chunks`. Riwayat percakapan dibatasi `MAX_HISTORY_TURNS` agar konteks LLM tetap efisien.

### 9.1 Backend Client

```ts
// src/services/backendClient.ts
import axios from "axios";

export const backend = axios.create({
  baseURL: process.env.BACKEND_API_URL, // http://localhost:3000/api
  headers: { "x-internal-key": process.env.INTERNAL_API_KEY },
});
```

### 9.2 Tools (LangChain + Zod → Backend HTTP)

```ts
// src/agent/tools.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { backend } from "../services/backendClient";
import { searchKnowledge } from "../rag/retriever";

export const checkStockTool = tool(
  async ({ productName }) => {
    const { data } = await backend.get(`/reports/stock/${encodeURIComponent(productName)}`);
    const p = data.data;
    if (!p) return `Sistem tidak menemukan barang bernama mirip "${productName}".`;
    return `Info database: ${p.name} (SKU: ${p.sku}) stok ${p.stock} ${p.unit}.`;
  },
  {
    name: "cek_stok_barang",
    description: "Gunakan untuk mengetahui sisa stok barang di gudang.",
    schema: z.object({ productName: z.string().describe("Nama barang, mis. 'dimsum'") }),
  },
);

export const shipmentRecapTool = tool(
  async ({ date }) => {
    const { data } = await backend.get(`/reports/shipments`, { params: { date } });
    const rows = data.data as { partner: string; product: string; qty: number }[];
    if (!rows.length) return `Tidak ada pengiriman tercatat pada ${date}.`;
    return rows.map((r) => `- ${r.partner}: ${r.qty}x ${r.product}`).join("\n");
  },
  {
    name: "rekap_pengiriman",
    description: "Merekap pengiriman harian. Gunakan saat user menanyakan kirim ke mana pada tanggal tertentu.",
    schema: z.object({ date: z.string().describe("Tanggal format YYYY-MM-DD") }),
  },
);

// Tool knowledge/RAG: menjawab pertanyaan SOP/kebijakan dari document_chunks.
export const searchSopTool = tool(
  async ({ query }) => {
    const chunks = await searchKnowledge(query, Number(process.env.AGENT_TOP_K ?? 12));
    if (!chunks.length) return "Tidak ada SOP/panduan yang relevan di knowledge base.";
    return chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.content}`).join("\n\n");
  },
  {
    name: "cari_sop",
    description: "Mencari SOP, kebijakan, atau panduan internal. Gunakan untuk pertanyaan prosedural yang bukan data stok/pengiriman.",
    schema: z.object({ query: z.string().describe("Pertanyaan/kata kunci pengguna") }),
  },
);

export const createPoDraftTool = tool(
  async ({ partnerName, items }) => {
    try {
      const { data } = await backend.post("/po/draft", { partnerName, items, source: "AI_CHAT" });
      const po = data.data;
      return `Draft PO ${po.poNumber} untuk ${po.partner.name} berhasil dibuat (status DRAFT). Silakan konfirmasi di aplikasi web.`;
    } catch (e: any) {
      return `Gagal membuat PO: ${e.response?.data?.error?.message ?? "kesalahan sistem"}.`;
    }
  },
  {
    name: "buat_draft_po",
    description: "Membuat draft Purchase Order (PO) baru untuk supplier. Status selalu DRAFT.",
    schema: z.object({
      partnerName: z.string().describe("Nama supplier, mis. 'CV Sumber Frozen'"),
      items: z
        .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
        .min(1)
        .describe("Daftar barang yang dipesan"),
    }),
  },
);
```

> Perhatikan: parameter `items` berbentuk array — berbeda dari rancangan awal (single item) — agar mendukung multi-item PO sekaligus konsisten dengan `PurchaseOrderItem` di ERD.

**Set lengkap tool baca data (pasca-MVP):** selain `cek_stok_barang`, `rekap_pengiriman`, `buat_draft_po`, `buat_draft_surat_jalan`, dan `cari_sop`, tersedia `cari_produk`, `list_kategori`, `list_partner`, `list_gudang`, `stok_per_gudang`, `list_transaksi`, `list_po`, `detail_po`, `list_surat_jalan`, `stok_tipis`, dan `ringkasan_dashboard`. Tool tulis hanya `buat_draft_po` (`POST /po/draft`, SUPPLIER) dan `buat_draft_surat_jalan` (`POST /delivery-notes/draft`, CUSTOMER), keduanya membuat DRAFT. Semua memanggil endpoint backend dengan `x-internal-key` (lihat FSD §9.6/§9.7 & §10.2). Data transaksional **tidak** di-embed; hanya SOP + glossary skema (`docs/knowledge/`) yang di-RAG.

### 9.3 System Prompt

```ts
// src/agent/prompt.ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

export const agentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah Asisten Gudang (WMS Virtual) untuk UMKM di Indonesia.
- Jawab dengan Bahasa Indonesia yang profesional dan ramah.
- JANGAN PERNAH mengarang data stok, pengiriman, atau partner. Selalu gunakan tools.
- Jika data tidak ditemukan, minta klarifikasi; jangan mengarang nilai.
- Untuk pertanyaan SOP/kebijakan/prosedur, gunakan tool `cari_sop` dan jawab HANYA berdasarkan konteks yang dikembalikan. Sebutkan sumbernya bila ada.
- Saat membuat PO, status selalu DRAFT dan ingatkan user untuk konfirmasi di web.
- Jangan membocorkan ID internal, SQL, atau API key.
- Jika pertanyaan di luar cakupan (stok, pengiriman, PO, SOP), tolak dengan sopan dan sebutkan kemampuanmu.`,
  ],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);
```

### 9.4 Agent Assembly

```ts
// src/agent/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { agentPrompt } from "./prompt";
import { checkStockTool, shipmentRecapTool, createPoDraftTool, searchSopTool } from "./tools";

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  temperature: Number(process.env.LLM_TEMPERATURE ?? 0),
});

const tools = [checkStockTool, shipmentRecapTool, createPoDraftTool, searchSopTool];

export const agentExecutor = new AgentExecutor({
  agent: createToolCallingAgent({ llm, tools, prompt: agentPrompt }),
  tools,
  maxIterations: 5,
});
```

### 9.5 Bot + Auth Mapping + Logging

```ts
// src/bot/telegram.ts
import { Telegraf } from "telegraf";
import { agentExecutor } from "../agent/agent";
import { backend } from "../services/backendClient";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.start((ctx) => ctx.reply("Halo Bos! Ketik mis. 'Cek stok dimsum' atau 'Buat PO untuk CV Sumber Frozen'"));

bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  ctx.sendChatAction("typing");

  const started = Date.now();
  try {
    const response = await agentExecutor.invoke({ input: ctx.message.text });
    const latencyMs = Date.now() - started;
    await ctx.reply(response.output);
    await backend.post("/internal/ai-log", {
      platform: "TELEGRAM",
      chatId,
      messageIn: ctx.message.text,
      messageOut: response.output,
      latencyMs,
    });
  } catch (err) {
    await ctx.reply("Maaf, sistem sedang mengalami gangguan. Coba lagi nanti.");
    await backend.post("/internal/ai-log", {
      platform: "TELEGRAM",
      chatId,
      messageIn: ctx.message.text,
      latencyMs: Date.now() - started,
    });
  }
});

// Long polling cocok untuk local development (tanpa HTTPS/webhook publik).
bot.launch();
console.log("Asisten WMS bot running (local long-polling)...");
```

> **Alternatif webhook untuk produksi:** gunakan `bot.launch({ webhook: { domain, port } })` atau `@telegraf/… webhookCallback` yang di-mount pada Express. Untuk local dev, long-polling lebih sederhana.

### 9.6 Authorization via Chat Mapping

Backend memetakan `telegramId`/`whatsappNumber` ke `User`. Pada endpoint `/internal/ai-log` & `/po/draft`, backend memvalidasi:

```ts
// contoh service backend
const user = await prisma.user.findUnique({ where: { telegramId: chatId } });
if (!user || !user.isActive) throw Errors.forbidden();
```

User tak terdaftar → pesan diabaikan/ditolak.

### 9.7 RAG Pipeline (Vector Store Read-Only)

AI Agent menggunakan dua jalur data: **(1)** data bisnis via Backend API (function calling), dan **(2)** knowledge/SOP via retrieval vector **read-only** dari tabel `document_chunks`.

```mermaid
flowchart LR
    subgraph Offline["Ingestion (offline, admin)"]
        DOC[Dokumen SOP/FAQ<br/>docs/knowledge/*.md] --> ING[rag/ingest.ts]
        ING --> CH[chunk<br/>CHUNK_SIZE / CHUNK_OVERLAP]
        CH --> EMB[embed<br/>OPENAI_EMBEDDING_MODEL]
        EMB --> VDB[(document_chunks<br/>pgvector)]
    end
    subgraph Runtime["Runtime (read-only)"]
        Q[Pesan user] --> RET[rag/retriever.ts]
        RET -->|top-K AGENT_TOP_K| VDB
        RET --> CTX[Konteks SOP]
        CTX --> AG[AgentExecutor]
    end
```

**`src/db.ts`** — koneksi read-only (gunakan user DB ber-`SELECT` saja):

```ts
// src/db.ts
import { Pool } from "pg";

export const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
});
```

**`src/rag/embeddings.ts`:**

```ts
import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  apiKey: process.env.OPENAI_API_KEY,
});
```

**`src/rag/ingest.ts`** — chunk + embed + upsert (dijalankan manual, boleh pakai kredensial write):

```ts
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { readFile } from "node:fs/promises";
import { db } from "../db";
import { embeddings } from "./embeddings";

export async function ingestFile(source: string, path: string) {
  const raw = await readFile(path, "utf8");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.CHUNK_SIZE ?? 1000),
    chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 200),
  });
  const chunks = await splitter.createDocuments([raw], [{ source }]);
  const vectors = await embeddings.embedDocuments(chunks.map((c) => c.pageContent));

  for (let i = 0; i < chunks.length; i++) {
    await db.query(
      `INSERT INTO document_chunks (id, source, content, embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, now())`,
      [source, chunks[i].pageContent, JSON.stringify(vectors[i])],
    );
  }
  return chunks.length;
}
```

**`src/rag/retriever.ts`** — retrieval top-K (read-only):

```ts
import { db } from "../db";
import { embeddings } from "./embeddings";

export async function searchKnowledge(query: string, topK = 12) {
  const [vector] = await embeddings.embedDocuments([query]);
  const { rows } = await db.query(
    `SELECT source, content, 1 - (embedding <=> $1::vector) AS score
     FROM document_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(vector), topK],
  );
  return rows as { source: string; content: string; score: number }[];
}
```

| Parameter                   | Nilai default | Efek                                                                 |
| :-------------------------- | :------------ | :------------------------------------------------------------------- |
| `OPENAI_EMBEDDING_MODEL`    | `text-embedding-3-small` | Model embedding; harus konsisten antara ingest & retrieval. |
| `EMBEDDING_DIMENSIONS`      | `1536`        | Harus sama dengan `vector(1536)` di skema (ERD §3.15).               |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `200` | Granularitas potongan; makin kecil makin presisi, makin banyak chunk. |
| `AGENT_TOP_K`               | `12`          | Jumlah chunk konteks yang diambil per query.                          |

```bash
# Jalankan ingestion dokumen SOP
npm run rag:ingest   # membaca ai-agent/docs/knowledge/*.md
```

> **Penting:** AI Agent di runtime **hanya membaca** `document_chunks`. Proses ingest dapat memakai kredensial write terpisah; jangan memberi hak tulis ke proses runtime (least privilege).

### 9.8 Guardrails Recap

| Guardrail          | Implementasi                                                       |
| :----------------- | :----------------------------------------------------------------- |
| No raw SQL (bisnis)| Data bisnis via HTTP API backend, bukan Prisma langsung.            |
| DB read-only (RAG) | Runtime hanya `SELECT` pada `document_chunks`; tanpa hak tulis.     |
| Grounding RAG      | Jawab SOP hanya dari konteks hasil retrieval; sebut sumber bila ada. |
| Anti-halusinasi    | `temperature=0`, data hanya dari tool, tolak bila tak ada data.     |
| Authz              | Mapping `chatId → User`; tolak user non-aktif.                      |
| Rate limiting      | Batasi pesan/user/menit (mis. `telegraf-ratelimit` atau counter).   |
| Audit              | Log tiap pesan + tool call ke `AiConversationLog`.                  |
| Error handling     | Tangkap error LLM/HTTP → balas pesan ramah.                         |
| Scope              | Baca: seluruh data operasional (stok, transaksi, PO, surat jalan, partner, gudang, laporan). Tulis: hanya draft PO & draft Surat Jalan; out-of-scope ditolak sopan. |

---

## 10. Key End-to-End Flows

### 10.1 Inbound / Outbound Stock Update

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    Admin->>FE: Submit form transaksi
    FE->>BE: POST /transactions/{inbound|outbound}
    BE->>BE: validate (Zod) + auth
    BE->>DB: $transaction: cek stok, insert txn, update product.stock + inventory
    alt stok cukup
        DB-->>BE: OK
        BE-->>FE: 201 {transaction}
        FE->>FE: invalidateQueries → tabel stok refresh
    else stok kurang (OUT)
        DB-->>BE: rollback
        BE-->>FE: 409 INSUFFICIENT_STOCK
        FE->>Admin: tampilkan error
    end
```

### 10.2 Create PO Draft via Chat

```mermaid
sequenceDiagram
    actor Owner
    participant TG as Telegram
    participant AI as AI Agent
    participant BE as Backend
    participant DB as PostgreSQL
    participant FE as Web Dashboard

    Owner->>TG: "Besok siapkan PO untuk CV Sumber Frozen, 50 pack Dimsum"
    TG->>AI: update
    AI->>AI: intent → buat_draft_po
    AI->>BE: POST /po/draft (x-internal-key)
    BE->>DB: find partner + products → create PO(DRAFT) + items
    DB-->>BE: OK {poNumber}
    BE-->>AI: 201
    AI-->>TG: "Draft PO PO-... dibuat. Cek web untuk konfirmasi."
    FE->>BE: GET /po?status=DRAFT
    BE-->>FE: draft list (muncul di antrean admin)
```

### 10.3 Check Stock via Chat

```mermaid
sequenceDiagram
    actor Owner
    participant AI as AI Agent
    participant BE as Backend
    participant DB as PostgreSQL

    Owner->>AI: "Ada berapa sisa stok dimsum ukuran sedang?"
    AI->>BE: GET /reports/stock/dimsum%20ukuran%20sedang
    BE->>DB: product.findFirst({ name contains, insensitive })
    DB-->>BE: product
    BE-->>AI: { name, sku, stock, unit }
    AI-->>Owner: "Stok Dimsum Ayam Ukuran Sedang: 120 pack."
```

### 10.4 Answer SOP via RAG (Read-Only)

```mermaid
sequenceDiagram
    actor Owner
    participant AI as AI Agent
    participant RAG as retriever.ts
    participant PG as document_chunks (pgvector)

    Owner->>AI: "Apa SOP penerimaan barang retur?"
    AI->>AI: intent → cari_sop
    AI->>RAG: searchKnowledge(query, AGENT_TOP_K)
    RAG->>PG: SELECT ... ORDER BY embedding <=> query LIMIT top_k (read-only)
    PG-->>RAG: chunks + score
    RAG-->>AI: konteks SOP
    AI-->>Owner: jawaban berdasarkan konteks + sumber
```

### 10.5 Delivery Note Detail, Edit & Print (Web)

- Halaman detail `/delivery-notes/:id` menampilkan header, item, dan **transaksi OUT terkait** (`GET /transactions?deliveryNoteId=`).
- Edit detail (partner/gudang/tanggal/catatan/item) hanya saat status `DRAFT` via `PUT /delivery-notes/:id`; perubahan item mengganti seluruh item DN dan dicatat ke audit log.
- Cetak memakai **browser print** (`window.print()` + `@media print`) yang menyembunyikan chrome aplikasi dan hanya menampilkan area dokumen; tanpa dependency PDF.

---

## 11. Testing Strategy

| Level        | Tooling                    | Cakupan                                                                 |
| :----------- | :------------------------- | :---------------------------------------------------------------------- |
| Unit         | Vitest                     | Service stok (delta, insufficient), numbering, state transition, utils. |
| Integration  | Vitest + Supertest         | Endpoint auth/RBAC, transaksi, PO lifecycle (pakai test DB).            |
| Frontend     | Vitest + Testing Library   | Hook TanStack Query, form validation, komponen kritis.                  |
| AI Agent     | Vitest (mock LLM & HTTP)   | Pemilihan tool & parsing parameter; guardrail out-of-scope.             |
| E2E          | Playwright (opsional)      | Login → input transaksi → PO → cek dashboard.                           |

**Prinsip:** skenario `AC-01`…`AC-14` di [FSD](./FSD.md) dipetakan ke test otomatis.

```bash
# contoh perintah
npm test           # unit + integration
npm run test:e2e   # e2e (opsional)
npm run lint
npm run typecheck
```

---

## 12. Local Development Workflow

### 12.1 Scripts per Service

```json
// backend/package.json (excerpt)
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "prisma": "prisma",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

```json
// ai-agent/package.json (excerpt)
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "rag:ingest": "tsx src/rag/ingest.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

### 12.2 Daily Loop

```bash
docker compose up -d db      # hanya DB
cd backend && npm run dev    # terminal 1 (http://localhost:3000)
cd frontend && npm run dev   # terminal 2 (http://localhost:5173)
cd ai-agent && npm run dev   # terminal 3 (http://localhost:8080)
```

### 12.3 Reset & Reseed

```bash
# hapus data dan ulangi migration + seed
cd backend && npm run db:reset
```

### 12.4 Ingest Knowledge Base (RAG)

```bash
# taruh dokumen SOP di ai-agent/docs/knowledge/*.md, lalu:
cd ai-agent && npm run rag:ingest
```

Verifikasi isi tabel:

```sql
SELECT source, count(*) FROM document_chunks GROUP BY source;
```

### 12.5 Menguji Bot Lokal

1. Buat bot lewat **@BotFather** → dapat `TELEGRAM_BOT_TOKEN`.
2. Set token di `ai-agent/.env`, jalankan `npm run dev`.
3. Kirim pesan ke bot di Telegram. Untuk mode webhook, gunakan tunnel (mis. `cloudflared`/`ngrok`) dan set `domain`.

---

## 13. Coding Standards & Conventions

### 13.1 Naming

| Item          | Convention            | Example                       |
| :------------ | :-------------------- | :---------------------------- |
| File (modul)  | kebab-case            | `purchase-orders.service.ts`  |
| Variabel/fn   | camelCase             | `generatePoNumber`            |
| Tipe/Class    | PascalCase            | `StockTransactionInput`       |
| Konstanta     | UPPER_SNAKE_CASE      | `JWT_ACCESS_TTL`              |
| Tabel DB      | snake_case plural     | `purchase_order_items`        |
| Endpoint      | kebab-case plural     | `/delivery-notes`             |

### 13.2 TypeScript & Lint

- `strict: true`, hindari `any` (kecuali sangat terpaksa & diberi komentar).
- ESLint + Prettier dengan config seragam di ketiga service.
- Jalankan `npm run lint && npm run typecheck` sebelum commit.

### 13.3 Git Commit (Conventional Commits)

```text
<type>(<scope>): <subject>

feat(transactions): add atomic outbound stock update
fix(auth): correct refresh token rotation
docs(technical): add local setup guide
chore(prisma): update schema for inventory
```

Type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

### 13.4 Definition of Done (per fitur)

- [ ] Endpoint + validasi Zod + RBAC sesuai matriks FSD §5.
- [ ] Perubahan data penting tercatat di audit log (bila relevan).
- [ ] Query key & invalidasi TanStack Query sudah benar.
- [ ] Unit/integration test lulus; `lint` & `typecheck` bersih.
- [ ] Skenario acceptance terkait (FSD §14) terbukti.

---

## 14. Troubleshooting / FAQ

| Masalah                                            | Penyebab umum                              | Solusi                                                            |
| :------------------------------------------------- | :----------------------------------------- | :---------------------------------------------------------------- |
| `PrismaClientInitializationError`                  | DB belum siap / URL salah                  | `docker compose up -d db`, cek `DATABASE_URL`.                    |
| `@prisma/client did not initialize`                | Belum `prisma generate`                    | `npx prisma generate`.                                            |
| Error ekstensi `vector` saat migrate               | Pakai image Postgres biasa                 | Gunakan `ankane/pgvector` (lihat compose).                        |
| Port 3000/5173/8080/5432 sudah dipakai             | Service lain berjalan                      | Hentikan proses atau ubah port.                                   |
| Bot tidak merespons                                | Token salah / bot belum di-`launch`        | Cek `TELEGRAM_BOT_TOKEN`, lihat log ai-agent.                     |
| `401` berulang di frontend                         | Access token expired, refresh gagal        | Cek interceptor & `JWT_REFRESH_SECRET`.                           |
| `403 FORBIDDEN` pada AI `POST /po/draft`           | `INTERNAL_API_KEY` tidak cocok             | Samakan key di backend & ai-agent.                                |
| Jawaban AI mengarang                               | Temperature > 0 / tools tak dipanggil      | Set `LLM_TEMPERATURE=0`, periksa deskripsi tool.                  |
| Jawaban SOP tidak relevan / kosong                 | `document_chunks` belum di-ingest          | Jalankan `npm run rag:ingest`, cek `AGENT_TOP_K`.                 |
| Error `expected 1536 dimensions`                   | Dimensi embedding tak cocok dengan kolom   | Samakan `EMBEDDING_DIMENSIONS` dgn `vector(1536)`; re-ingest.     |
| AI `permission denied for table document_chunks`   | User DB read-only kurang `GRANT SELECT`    | Beri `GRANT SELECT` pada `document_chunks` (lihat §2.3 rule 5).   |
| Outbound selalu ditolak                            | Stok belum di-seed / salah gudang          | Cek `Inventory` per `warehouseId`; jalankan seed.                 |
| Perubahan schema tidak terpakai                    | Client belum di-regenerate                 | `npx prisma generate` lalu restart `dev`.                         |

---

## 15. Roadmap → Technical Tasks

Pemetaan timeline 5 minggu (FSD) menjadi task teknis.

| Minggu | Fase                              | Task teknis kunci                                                                                                   |
| :----- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| 1      | Backend & DB                      | Init monorepo; `docker-compose.yml`; setup Backend + Prisma; migrate `init`; `seed.ts`; Auth (login/refresh/logout) + middleware auth/RBAC/validate/errorHandler; CRUD master data. |
| 2      | Backend Transaksi + Frontend Dasar | Endpoint transaksi (atomic stock), generator `poNumber`, PO lifecycle, audit helper; setup Vite + Tailwind + Router + `Providers` (QueryClient); layout; feature master data (`useQuery`). |
| 3      | Frontend Lanjutan + AI Dasar      | Feature transaksi & PO (form + `useMutation` + invalidation), halaman detail PO, dashboard; setup ai-agent, Telegraf long-polling, endpoint `/internal/ai-log`, mapping chatId→user; LLM + tools `cek_stok_barang`, `rekap_pengiriman`. |
| 4      | AI Lanjutan + RAG                 | Tool `buat_draft_po` → `POST /po/draft`; setup RAG ingestion (`rag:ingest`) + retriever read-only; tool `cari_sop`; guardrail, rate limit, conversation logging. |
| 5      | Testing & Finalisasi              | Integration E2E (chat → draft PO → muncul di web); bug fixing & error handling; optimasi prompt & latency; hardening; dokumentasi akhir & demo script. |

---

*End of Technical Design Document*
