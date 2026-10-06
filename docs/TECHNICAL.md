# Technical Design Document (Build Guide)

**Project:** Otomatisasi Warehouse Management System (WMS) dan Tata Kelola Dokumen Berbasis Web dengan Integrasi Asisten AI (RAG) pada Platform Pesan Instan

**Document Type:** Technical Design Document / Developer Build Guide
**Version:** 1.1.0
**Status:** Updated
**Author:** Project Owner
**Date:** 2026-10-02

**Related Documents:** [BRD](./BRD.md) · [FSD](./FSD.md) · [ERD](./ERD.md)

> **Scope dokumen:** panduan teknis implementasi untuk **pengembangan lokal (local development)**. Snippet bersifat acuan implementasi, bukan full scaffolding. Deployment & CI/CD dibahas terpisah pada dokumen lain.

---

## 1. Document Control

### 1.1 Revision History

| Version | Date       | Author        | Description                                  |
| :------ | :--------- | :------------ | :------------------------------------------- |
| 1.0.0   | 2026-09-22 | Project Owner | Initial technical build guide from BRD/FSD/ERD|
| 1.1.0   | 2026-10-02 | Project Owner | Refactor layered architecture (backend & ai-agent); update Repository Layout, §7, §9 |

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

Backend menerapkan **3 layer**: **Presentation** (route/controller) → **Business** (service/domain) → **Persistence** (repository/Prisma), dengan port untuk dependensi outbound.

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── config/
│   │   └── env.ts              # env loader + validasi Zod
│   ├── lib/                    # utilitas bersama (bukan layer)
│   │   ├── errors.ts           # AppError
│   │   ├── pagination.ts       # parsePagination, buildMeta
│   │   ├── password.ts         # hash/verify (bcrypt)
│   │   ├── asyncHandler.ts
│   │   └── http/clientIp.ts
│   ├── presentation/
│   │   └── http/respond.ts     # helper respons { success, data, meta }
│   ├── middlewares/            # PRESENTATION (boundary)
│   │   ├── auth.ts             # verify JWT
│   │   ├── rbac.ts             # requireRole(...)
│   │   ├── validate.ts         # Zod validator
│   │   └── errorHandler.ts     # global error handler
│   ├── modules/                # feature-first; layer internal per module
│   │   └── <feature>/
│   │       ├── <f>.routes.ts       # PRESENTATION: peta path + middleware
│   │       ├── <f>.controller.ts   # PRESENTATION: req/res ↔ use-case
│   │       ├── <f>.schema.ts       # PRESENTATION: validasi Zod
│   │       ├── <f>.service.ts      # BUSINESS: aturan & workflow
│   │       └── <f>.repository.ts   # PERSISTENCE: akses Prisma
│   ├── application/
│   │   └── ports/              # kontrak outbound (audit, notifier, unitOfWork)
│   ├── domain/                 # logic murni (numbering, po-state)
│   ├── infrastructure/         # adapter outbound
│   │   ├── prisma/             # client.ts (PrismaClient + Db), unitOfWork.ts
│   │   ├── audit/              # prismaAudit.ts
│   │   ├── notifier/           # telegram.ts (HTTP ke ai-agent)
│   │   └── auth/               # tokens.ts (JWT sign/verify)
│   ├── composition/
│   │   └── container.ts        # wiring port ↔ adapter
│   ├── routes.ts               # registrasi seluruh router
│   ├── app.ts                  # express app assembly
│   └── server.ts               # listen()
├── .env
├── tsconfig.json
└── package.json
```

> **Aturan dependensi** (ditegakkan ESLint): presentation tidak mengakses Prisma/repository; service tidak mengimpor Prisma/express; adapter outbound mengimplementasikan port di `application/ports`.

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

AI Agent juga menerapkan **3 layer** dengan entry point event-driven (Telegram + HTTP), serta job/CLI ingest (impor & generate dokumen):

```text
ai-agent/
├── src/
│   ├── config/env.ts
│   ├── lib/
│   │   └── telegramFormat.ts # renderer murni Markdown→HTML Telegram (shared)
│   ├── presentation/         # PRESENTATION: batas inbound/outbound channel
│   │   ├── http/
│   │   │   ├── server.ts     # health + POST /notify + POST /ingest + GET /ingest/status
│   │   │   └── notify.schema.ts
│   │   └── telegram/
│   │       ├── bot.ts        # handler pesan Telegram (entry point)
│   │       └── format.ts     # kirim balasan terformat (sendFormatted)
│   ├── application/          # BUSINESS
│   │   ├── ports/            # backendGateway.ts, knowledgeBase.ts, notifier.ts
│   │   ├── agent/            # agent.ts (executor), prompt.ts
│   │   ├── tools/            # schemas.ts, read.ts, write.ts, rag.ts, format.ts, index.ts
│   │   └── chat/             # handleMessage.ts, memory.ts, rateLimit.ts
│   ├── infrastructure/       # PERSISTENCE / adapter outbound
│   │   ├── backend/backendGateway.ts  # HTTP client ke Backend API (impl port)
│   │   ├── telegram/notifier.ts       # push notifikasi Telegram (impl port)
│   │   ├── rag/              # embeddings.ts, retriever.ts, knowledgeBase.ts,
│   │   │                     #   ingest.ts, ingestJob.ts, knowledgeDocStore.ts,
│   │   │                     #   importDocs.ts, generateKamus.ts, generateLaporan.ts
│   │   └── db.ts             # pg Pool READ-ONLY (document_chunks) + write pool (ingest)
│   ├── composition/container.ts
│   └── index.ts              # bootstrap (server + bot)
├── docs/knowledge/           # seed dokumen statis (markdown/txt) → knowledge_documents
├── .env
└── package.json
```

> **Catatan:** `bot/auth.ts` dan `logger.ts` pada rancangan awal tidak dipakai — mapping `chatId → user` dan logging kini melalui Backend API (`BackendGateway`).

---

## 4. Prerequisites & Tooling

| Tool           | Version (min) | Notes                                       |
| :------------- | :------------ | :------------------------------------------ |
| Docker         | 24+           | + Docker Compose v2. Wajib — semua service berjalan di container. |
| Git            | 2.40+         |                                             |
| OpenSSL        | —             | Untuk generate `JWT_SECRET`.                |

> **Node.js tidak perlu dipasang di host.** Semua service (backend, frontend, ai-agent, database) berjalan di dalam Docker; dependency diinstall di dalam image. Node.js 20 LTS hanya menjadi base image container.

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

# Notifikasi Telegram via ai-agent (kosongkan untuk menonaktifkan)
AI_AGENT_URL=http://localhost:8080
# Base URL dashboard untuk deep-link notifikasi PO
WEB_APP_URL=http://localhost:5173
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
AGENT_TOP_K=5
RAG_MIN_SCORE=0.3
RAG_HYBRID=true
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
| `EMBEDDING_DIMENSIONS`  | ai-agent | Harus sama dengan `vector(1536)` pada `DocumentChunk` (ERD §3.16).    |
| `AGENT_TOP_K`           | ai-agent | Jumlah chunk teratas yang diambil saat retrieval RAG (default 5).       |
| `RAG_MIN_SCORE`         | ai-agent | Ambang skor cosine minimal (0-1) agar chunk tak relevan dibuang.        |
| `RAG_HYBRID`            | ai-agent | `true` = gabungan vector + full-text (RRF); `false` = vector saja.      |
| `MAX_HISTORY_TURNS`     | ai-agent | Batas giliran riwayat percakapan yang dikirim ke LLM.                    |
| `CHUNK_SIZE`/`CHUNK_OVERLAP` | ai-agent | Ukuran & tumpang tindih potongan saat ingest dokumen.              |
| `DB_*`                  | ai-agent | Koneksi **read-only** runtime ke `document_chunks`; di compose `DB_HOST=db`. |
| `INTERNAL_API_KEY`      | backend/ai-agent | Menyamakan key untuk endpoint internal (`/po/draft`, `/reports/*`, `/internal/*`, `POST /notify`). |
| `AI_AGENT_URL`          | backend | Base URL ai-agent untuk memicu notifikasi Telegram (mis. `http://ai-agent:8080`). Kosong = notifikasi nonaktif. |
| `WEB_APP_URL`           | backend | Base URL dashboard untuk deep-link notifikasi PO (mis. `http://localhost:5173` → `/purchase-orders/<id>`). |

> **Keamanan:** gunakan user DB terpisah untuk AI Agent dengan hak **`GRANT SELECT`** hanya pada tabel `document_chunks`. Jangan gunakan user superuser. `DATABASE_URL` backend (read/write) tidak dibagikan ke AI Agent.
>
> **Host koneksi:** karena seluruh service berjalan via Docker Compose, host DB adalah `db:5432` (lihat `docker-compose.yml`). Nilai `localhost` pada `.env.example` per-service hanya placeholder dan di-override oleh environment Docker.

---

## 6. Local Setup Quickstart

Seluruh service berjalan di Docker; tidak ada langkah native di host.

```bash
# 1. Clone & masuk
git clone <repo-url> inventory-rag && cd inventory-rag

# 2. Siapkan env
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-agent/.env.example ai-agent/.env

# 3. Nyalakan semua service (db + backend + frontend + ai-agent, hot reload)
make dev            # Ctrl+C untuk berhenti; `make dev-down` dari terminal lain

# 4. (terminal lain) isi data awal & siapkan knowledge base
make seed
make rag-import-docs   # impor dokumen statis docs/knowledge → knowledge_documents
make rag-ingest        # embed knowledge_documents → document_chunks
```

Migrasi dijalankan otomatis oleh container backend saat start. URL service:

| Service  | URL                     |
| :------- | :---------------------- |
| Frontend | http://localhost:5173   |
| Backend  | http://localhost:3001   |
| AI Agent | http://localhost:8080   |
| Database | localhost:5433 (psql)   |

**Alternatif per service:** `make dev-backend`, `make dev-frontend`,
`make dev-ai-agent`. Untuk mode produksi/tanpa hot reload: `make up` dan
`make down`.

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
      - AGENT_TOP_K=5
      - RAG_MIN_SCORE=${RAG_MIN_SCORE:-0.3}
      - RAG_HYBRID=${RAG_HYBRID:-true}
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
    R[Route] --> V[validate Zod] --> MW[auth / rbac] --> C[Controller] --> S[Service] --> RP[Repository] --> P[Prisma] --> DB[(PostgreSQL)]
    S --> DOM[Domain<br/>numbering, po-state]
    S --> PORT[Ports<br/>audit / notifier / unitOfWork]
    PORT -.-> INF[Infrastructure adapter]
    INF --> DB
```

- **Presentation** (`routes` + `controller` + `schema` + `middlewares`): memetakan path & middleware, parsing request, memanggil service, membentuk response. Tidak ada logika bisnis, tidak mengakses Prisma.
- **Business** (`service` + `domain`): logika bisnis, validasi aturan, orkestrasi. Mengakses data lewat repository, dan side-effect lewat **port** (`application/ports`).
- **Persistence** (`repository` + `infrastructure`): **satu-satunya tempat** Prisma dipakai. Adapter outbound (Prisma, notifier Telegram, audit, JWT) mengimplementasikan port.
- **Composition** (`composition/container.ts`): wiring port ↔ adapter.
- **Utils/helper** (`lib/`): pagination, password, `clientIp`, `asyncHandler`, `AppError`.

### 7.2 Core Files

**`src/infrastructure/prisma/client.ts`** — PrismaClient singleton + tipe klien (`Db`) untuk repository:

```ts
import { PrismaClient, type Prisma } from "@prisma/client";
import { env } from "../../config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = PrismaClient | Prisma.TransactionClient;
```

**`src/infrastructure/prisma/unitOfWork.ts`** — adapter transaksi (implementasi port `UnitOfWork`):

```ts
export const prismaUnitOfWork: UnitOfWork = {
  run: (fn) => prisma.$transaction(fn),
};
```

Utilitas bersama lain: `src/lib/pagination.ts` (`parsePagination`/`buildMeta`), `src/lib/password.ts` (`hashPassword`/`verifyPassword`), `src/lib/http/clientIp.ts`, `src/lib/asyncHandler.ts`. `src/lib/errors.ts` (`AppError`) tetap seperti sebelumnya.

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
import type { TransactionType } from "@prisma/client";
import { Errors } from "../lib/errors";
import { container } from "../composition/container";
import type { Db } from "../infrastructure/prisma/client";
import * as productsRepo from "../products/products.repository";
import * as inventory from "./inventory.repository";
import * as repo from "./transactions.repository";

type RecordInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  partnerId?: string;
  createdById: string;
};

// Inti perubahan stok. WAJIB dipanggil di dalam sebuah transaksi.
export async function applyStock(tx: Db, type: TransactionType, input: RecordInput) {
  const product = await productsRepo.findStock(input.productId, tx);
  if (!product) throw Errors.notFound("Product");

  if (type === "OUT" && product.stock < input.quantity) throw Errors.insufficientStock();
  const delta = type === "OUT" ? -input.quantity : input.quantity;

  const txn = await repo.create({ type, ...input }, tx);
  await productsRepo.adjustStock(input.productId, delta, tx);
  await inventory.upsertInventory(input.productId, input.warehouseId, input.quantity, delta, tx);

  return txn;
}

// Entry point service: transaksi via port UnitOfWork (bukan Prisma langsung).
export function recordTransaction(type: "IN" | "OUT", input: RecordInput, actorId: string) {
  return container.uow.run((tx) => applyStock(tx, type, { ...input, createdById: actorId }));
}
```

> **Catatan arsitektur:** snippet di atas ringkas. Implementasi asli (`src/modules/transactions/transactions.service.ts`) memakai `container.uow.run(...)`, repository (`products`, `inventory`, `transactions`, `purchase-orders`) dan validasi PO; Prisma tidak pernah diakses langsung dari service.

> **Catatan race condition:** Pendekatan di atas aman untuk skala UMKM/capstone. Untuk trafik tinggi, pertimbangkan `SELECT ... FOR UPDATE` atau kolom versi optimistik.

### 7.4 PO Number Generation

Logika format nomor ada di **domain** (`src/domain/numbering.ts`), sedangkan penghitungan *sequence* lewat repository (di dalam transaksi):

```ts
// src/domain/numbering.ts — logika murni, tanpa DB
import { format } from "date-fns";

export type DocumentKind = "PO" | "SJ";

export function numberPrefix(kind: DocumentKind, date: Date): string {
  return `${kind}-${format(date, "yyyyMM")}-`;
}

export function buildDocumentNumber(kind: DocumentKind, date: Date, existingCount: number): string {
  return `${numberPrefix(kind, date)}${String(existingCount + 1).padStart(3, "0")}`;
}
```

```ts
// dipanggil di dalam transaksi (purchase-orders.service)
const date = new Date();
const poNumber = buildDocumentNumber(
  "PO",
  date,
  await purchaseOrdersRepo.countByNumberPrefix(numberPrefix("PO", date), tx),
);
```

Validasi transisi status PO/DN tinggal di `src/domain/po-state.ts` (`assertPoTransition`, `assertDnTransition`).

### 7.5 Audit Log Helper

Kontrak di `src/application/ports/audit.ts`, implementasi di `src/infrastructure/audit/prismaAudit.ts`; service memanggil via `container.audit`:

```ts
// application/ports/audit.ts
export interface AuditPort {
  record(params: AuditParams, db?: Db): Promise<void>;
}

// infrastructure/audit/prismaAudit.ts
export async function audit(params: AuditParams, db: Db = prisma): Promise<void> {
  await db.auditLog.create({ data: { ...params, before: params.before ?? null, after: params.after ?? null } });
}

export const prismaAudit: AuditPort = { record: audit };
```

Pemakaian di service (contoh `categories.service.ts`):

```ts
await container.audit.record({ actorId, action: "CREATE", entity: "Category", entityId, after: category, ipAddress: ip });
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

Semua perintah Prisma dijalankan di dalam container backend:

```bash
# via target Makefile
make migrate                        # prisma migrate dev (buat & terapkan migration)
make migrate-deploy                 # prisma migrate deploy (terapkan migration ada)
make db-reset                       # reset DB + re-apply + seed
make seed                           # migrate deploy + jalankan seed.ts
make shell-backend                  # shell interaktif di container backend

# atau langsung lewat docker compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend \
  npx prisma generate                # regenerate client setelah ubah schema
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend \
  npx prisma studio                  # GUI inspeksi data
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

AI Agent memiliki **dua sumber data**: (1) **data bisnis** melalui Backend REST API (function calling), dan (2) **knowledge** (SOP/kebijakan/runbook/panduan/onboarding/FAQ/catatan partner/kontrak/kamus produk/laporan) melalui retrieval vector **read-only** dari `document_chunks`. Riwayat percakapan dibatasi `MAX_HISTORY_TURNS` agar konteks LLM tetap efisien.

### 9.0 Layered Architecture (AI Agent)

AI Agent tidak memakai route HTTP seperti backend; entry point-nya event-driven. Layer tetap dipisah: **Presentation → Business → Persistence**, dengan port untuk dependensi outbound.

```mermaid
flowchart LR
    subgraph INBOUND["Presentation (inbound)"]
        TG[Telegram update] --> BOT[presentation/telegram/bot.ts]
        BE[backend POST /notify] --> HTTP[presentation/http/server.ts]
    end
    BOT --> HM[application/chat/handleMessage.ts]
    HM --> AG[application/agent/agent.ts]
    AG --> TL[application/tools/*]
    TL --> PORT[application/ports/*]
    HTTP --> NOT[presentation + infrastructure/telegram notifier]
    PORT -.-> GW[infrastructure/backend/backendGateway.ts]
    PORT -.-> KB[infrastructure/rag/retriever.ts]
    GW --> BAPI[(Backend REST API)]
    KB --> EMB[embeddings] --> PG[(document_chunks)]
```

| Layer | Isi | Contoh |
| :--- | :--- | :--- |
| Presentation | batas channel (inbound handler, formatting, route HTTP) | `presentation/telegram/bot.ts`, `presentation/http/server.ts` |
| Business | workflow, agent, tools, ports | `application/chat/handleMessage.ts`, `application/agent/*`, `application/tools/*`, `application/ports/*` |
| Persistence | adapter outbound (HTTP ke backend, pg, embeddings, push Telegram) | `infrastructure/backend/backendGateway.ts`, `infrastructure/rag/*`, `infrastructure/telegram/notifier.ts`, `infrastructure/db.ts` |

Alur pesan Telegram: `bot.ts` (presentation) → `handleMessage` (business) → `agent`/`tools` (business) → **port** `BackendGateway`/`KnowledgeBase` → adapter di `infrastructure/` → `format.ts` mengirim balasan.

### 9.1 Backend Client (Port + Adapter)

Kontrak di `src/application/ports/backendGateway.ts`; implementasi axios di `src/infrastructure/backend/backendGateway.ts`:

```ts
// application/ports/backendGateway.ts — kontrak (business tidak tahu HTTP)
export interface BackendGateway {
  getStockByProductName(name: string): Promise<StockLookup | null>;
  listTransactions(filter: TransactionFilter): Promise<ListResult<TransactionRow>>;
  createPoDraft(input: PoDraftInput & { chatId: string; source: "AI_CHAT" }): Promise<PoDraftResult>;
  // ... endpoint lain: products, categories, partners, warehouses, inventory, PO, DN, dashboard
}

// infrastructure/backend/backendGateway.ts — adapter (axios)
export const backend = axios.create({
  baseURL: env.BACKEND_API_URL,
  headers: { "x-internal-key": env.INTERNAL_API_KEY },
});

export const backendGateway: BackendGateway = {
  getStockByProductName: async (name) => {
    const { data } = await backend.get(`/reports/stock/${encodeURIComponent(name)}`);
    return data.data;
  },
  // ...
};
```

### 9.2 Tools (LangChain + Zod → Backend HTTP)

Tools tinggal di `src/application/tools/` (dipecah: `schemas.ts`, `read.ts`, `write.ts`, `rag.ts`, `format.ts`, `index.ts`) dan menerima **port** lewat `buildTools(deps, chatId)`, bukan adapter konkret:

```ts
// src/application/tools/read.ts (contoh)
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { BackendGateway } from "../ports/backendGateway";

export function buildReadTools({ backend }: { backend: BackendGateway }) {
  const checkStock = new DynamicStructuredTool({
    name: "cek_stok_barang",
    description: "Cek sisa stok satu barang berdasarkan nama.",
    schema: stockSchema,
    func: async (input) => {
      const result = await backend.getStockByProductName(input.productName);
      if (!result || result.status === "none") {
        return `Sistem tidak menemukan barang bernama mirip "${input.productName}".`;
      }
      // status "ambiguous" -> tampilkan kandidat; "ok" -> tampilkan stok.
      return `Info database: ${result.product?.name} stok ${result.product?.stock} ${result.product?.unit}.`;
    },
  });
  return [checkStock /* ...tool baca lain */];
}
```

```ts
// src/application/tools/write.ts (contoh)
export function buildWriteTools({ backend }: { backend: BackendGateway }, chatId: string) {
  const createPoDraft = new DynamicStructuredTool({
    name: "buat_draft_po",
    description: "Membuat draft Purchase Order (PO) baru untuk supplier. Status selalu DRAFT.",
    schema: poSchema,
    func: async (input) => {
      try {
        const po = await backend.createPoDraft({ ...input, source: "AI_CHAT", chatId });
        return `Draft PO ${po.poNumber} untuk ${po.partner.name} berhasil dibuat (status DRAFT).`;
      } catch (e) {
        return `Gagal membuat PO: ${(e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? "kesalahan sistem"}.`;
      }
    },
  });
  return [createPoDraft];
}
```

```ts
// src/application/tools/rag.ts (contoh)
export function buildSopTool({ knowledge }: { knowledge: KnowledgeBase }, role?: string | null) {
  const allowed = allowedDocTypes(role); // catatan-partner & kontrak hanya OWNER/SUPER_ADMIN
  return new DynamicStructuredTool({
    name: "cari_sop",
    description: "Mencari SOP, kebijakan, runbook, panduan, onboarding, FAQ, catatan partner, atau kontrak (RAG).",
    schema: sopSchema, // { query, docType? }
    func: async ({ query, docType }) => {
      const docTypes = docType ? [docType] : allowed;
      const chunks = await knowledge.search(query, {
        topK: env.AGENT_TOP_K,
        minScore: env.RAG_MIN_SCORE,
        docTypes,
      });
      if (!chunks.length) return "Tidak ada SOP/panduan yang relevan di knowledge base.";
      return chunks.map((c, i) => `[${i + 1}] (${c.title ?? c.source}) ${c.content}`).join("\n\n");
    },
  });
}
```

> Perhatikan: parameter `items` berbentuk array — berbeda dari rancangan awal (single item) — agar mendukung multi-item PO sekaligus konsisten dengan `PurchaseOrderItem` di ERD.

**Set lengkap tool baca data (pasca-MVP):** selain `cek_stok_barang`, `rekap_pengiriman`, `buat_draft_po`, `buat_draft_surat_jalan`, dan `cari_sop`, tersedia `cari_produk`, `list_kategori`, `list_partner`, `list_gudang`, `stok_per_gudang`, `list_transaksi`, `list_po`, `list_po_status`, `detail_po`, `list_surat_jalan`, `stok_tipis`, dan `ringkasan_dashboard`. Tool RAG: `cari_sop` (dengan `docType`), `cari_nama_produk` (kamus produk), dan `cari_laporan` (laporan naratif). Tool tulis hanya `buat_draft_po` (`POST /po/draft`, SUPPLIER) dan `buat_draft_surat_jalan` (`POST /delivery-notes/draft`, CUSTOMER), keduanya membuat DRAFT. Semua memanggil endpoint backend dengan `x-internal-key` (lihat FSD §9.6/§9.7 & §10.2). Data transaksional **tidak** di-embed; yang di-RAG adalah dokumen `knowledge_documents` (SOP, kebijakan, runbook, panduan, onboarding, FAQ, catatan partner, kontrak, kamus produk, laporan).

### 9.3 System Prompt

```ts
// src/application/agent/prompt.ts
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

### 9.3.1 Format Balasan Telegram

Agar balasan rapi saat dibaca, output LLM (yang umumnya Markdown) dikonversi ke subset HTML Telegram sebelum dikirim:

```ts
// src/lib/telegramFormat.ts (renderer murni) + src/presentation/telegram/format.ts (sendFormatted)
// - escape &, <, > lebih dulu, lalu konversi **tebal** -> <b>, *miring* -> <i>, `kode` -> <code>
// - normalisasi bullet "- " -> "• ", buang heading "#", ubah baris tabel "|" menjadi daftar
// - sendFormatted() mengirim dengan parse_mode "HTML"; bila Telegram menolak parse,
//   pesan dikirim ulang sebagai teks polos agar tidak hilang.
```

System prompt (`src/application/agent/prompt.ts`) juga memuat aturan **"Gaya & format jawaban"**: satu item per baris dengan awalan `• `, satu baris kosong antar seksi, tanpa heading/tabel Markdown, serta template baku untuk balasan Draft PO, Draft Surat Jalan, dan daftar.

### 9.4 Agent Assembly

```ts
// src/application/agent/agent.ts
import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { container } from "../../composition/container";
import { buildTools, type ToolDeps } from "../tools";
import { buildAgentPrompt } from "./prompt";

// Dibangun per pesan agar chatId ter-inject; tools dari port (bukan adapter konkret).
export async function runAgent(
  input: { chatId: string; message: string; history: BaseMessage[] },
  deps: ToolDeps = container,
) {
  const tools = buildTools(deps, input.chatId);
  const executor = new AgentExecutor({
    agent: createToolCallingAgent({ llm: getLlm(), tools, prompt: buildAgentPrompt() }),
    tools,
    maxIterations: 8,
    returnIntermediateSteps: true,
  });
  return executor.invoke({ input: input.message, chat_history: input.history });
}
```

### 9.5 Bot + Auth Mapping + Logging

Presentation (`presentation/telegram/bot.ts`) hanya menerima event & mengirim balasan; workflow ada di business (`application/chat/handleMessage.ts`):

```ts
// src/presentation/telegram/bot.ts
import { Telegraf, type Context } from "telegraf";
import { message } from "telegraf/filters";
import { container } from "../../composition/container";
import { handleMessage } from "../../application/chat/handleMessage";
import { sendFormatted } from "./format";

export function createBot(): Telegraf {
  const bot = new Telegraf(requireTelegramToken());

  bot.start((ctx) => ctx.reply("Halo Bos! Ketik mis. 'Cek stok dimsum' atau 'Buat PO untuk CV Sumber Frozen'"));

  bot.on(message("text"), async (ctx: Context) => {
    const chatId = String(ctx.chat!.id);
    const result = await handleMessage(container, {
      chatId,
      text: (ctx.message as { text: string }).text,
      onThinking: async () => { await ctx.sendChatAction("typing"); },
    });
    await sendFormatted(ctx, result.reply);
  });

  return bot;
}
```

```ts
// src/application/chat/handleMessage.ts — business: validasi user (via BackendGateway),
// rate limit, runAgent, simpan riwayat, dan log percakapan (best-effort).
export async function handleMessage(deps: ToolDeps, input: { chatId: string; text: string }) {
  const user = await deps.backend.resolveChatUser(input.chatId);
  if (!user) return { status: "unregistered", reply: "Maaf, akun Anda belum terdaftar..." };
  if (isRateLimited(input.chatId)) return { status: "rate_limited", reply: "Terlalu banyak permintaan..." };
  const result = await runAgent({ chatId: input.chatId, message: input.text, history: getHistory(input.chatId) }, deps);
  await deps.backend.logConversation({ platform: "TELEGRAM", chatId: input.chatId, messageIn: input.text, messageOut: result.output });
  return { status: "ok", reply: result.output };
}
```

> **Alternatif webhook untuk produksi:** gunakan `bot.launch({ webhook: { domain, port } })` atau `@telegraf/… webhookCallback` yang di-mount pada Express. Untuk local dev, long-polling lebih sederhana.

### 9.6 Authorization via Chat Mapping

Backend memetakan `telegramId`/`whatsappNumber` ke `User`. Pada endpoint `/internal/ai-log` & `/po/draft`, backend memvalidasi:

```ts
// users.service.ts (business) — data diakses lewat repository
const user = await usersRepo.findByChatId(chatId); // cocokkan telegramId / whatsappNumber
if (!user || !user.isActive) throw Errors.forbidden();
```

User tak terdaftar → pesan diabaikan/ditolak.

### 9.6.1 Notifikasi Telegram (Push)

AI Agent mengekspos satu endpoint internal di HTTP server-nya untuk mengirim pesan proaktif (di luar balasan reaktif):

```ts
// POST /notify  (header: x-internal-key)
{
  "chatIds": ["123456789", "987654321"],
  "text": "🆕 **Draft PO baru** (via AI Chat)\n**PO-202609-012** — Distributor Sentosa Makmur\n• 100 pack Saus Sambal Kemasan 500g",
  "button": { "label": "Buka & Konfirmasi PO", "url": "http://localhost:5173/purchase-orders/<id>" }
}
```

- `text` berformat Markdown; AI Agent mengonversinya ke HTML Telegram (`markdownToTelegramHtml`) dengan fallback teks polos.
- `button` opsional → inline keyboard berisi URL deep-link.

Backend memicu endpoint ini secara **best-effort** (timeout 5 detik, gagal hanya di-log) melalui adapter outbound `src/infrastructure/notifier/telegram.ts` (implementasi `NotifierPort` di `src/application/ports/notifier.ts`). Di ai-agent, request diterima `presentation/http/server.ts` lalu dikirim oleh `infrastructure/telegram/notifier.ts` (implementasi port `Notifier`):

| Trigger | Penerima |
| :------ | :------- |
| Draft PO dibuat via chat (`source = AI_CHAT`) | Semua user aktif `ADMIN`/`SUPER_ADMIN` yang punya `telegramId` |
| PO `CONFIRMED`/`CANCELLED` | Pembuat PO (owner) |
| PO menjadi `COMPLETED` (penerimaan penuh) | Pembuat PO (owner) |

> Prasyarat: penerima harus mengisi `telegramId` dan pernah `/start` bot (Telegram tidak mengizinkan bot memulai percakapan baru).

### 9.7 RAG Pipeline (Vector Store Read-Only)

AI Agent menggunakan dua jalur data: **(1)** data bisnis via Backend API (function calling), dan **(2)** knowledge (SOP/kebijakan/runbook/panduan/onboarding/FAQ/catatan partner/kontrak/kamus produk/laporan) via retrieval vector **read-only** dari tabel `document_chunks`.

Dokumen sumber (source of truth) kini disimpan di tabel **`knowledge_documents`** dan dikelola dari halaman web **Knowledge Base** (khusus `SUPER_ADMIN`). Proses ingest membaca tabel itu — bukan lagi file `docs/knowledge/*.md` secara langsung.

```mermaid
flowchart LR
    subgraph Admin["Admin (web, SUPER_ADMIN)"]
        UI[Halaman /knowledge] -->|upload/edit/hapus| KD[(knowledge_documents)]
        UI -->|POST /knowledge/ingest| BE[Backend API]
    end
    subgraph Offline["Ingestion (AI Agent, kredensial write)"]
        BE -->|x-internal-key /ingest| ING[infrastructure/rag/ingestJob.ts]
        KD --> ING
        ING --> CH[chunk + contentHash<br/>CHUNK_SIZE / CHUNK_OVERLAP]
        CH --> EMB[embed<br/>OPENAI_EMBEDDING_MODEL]
        EMB --> VDB[(document_chunks<br/>pgvector)]
    end
    subgraph Runtime["Runtime (read-only)"]
        Q[Pesan user] --> RET[infrastructure/rag/retriever.ts]
        RET -->|top-K AGENT_TOP_K| VDB
        RET --> CTX[Konteks SOP]
        CTX --> AG[AgentExecutor]
    end
```

**`src/infrastructure/db.ts`** — koneksi read-only (gunakan user DB ber-`SELECT` saja):

```ts
// src/infrastructure/db.ts
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

**`src/infrastructure/rag/embeddings.ts`:**

```ts
import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  apiKey: process.env.OPENAI_API_KEY,
});
```

**`src/infrastructure/rag/ingest.ts`** — baca `knowledge_documents` → chunk + embed → tulis `document_chunks` (kredensial write). Idempoten: `contentHash` (SHA-256) membuat dokumen yang isinya tak berubah dilewati; tulis per-dokumen dalam transaksi.

```ts
export async function runIngest(pool, filter = {}) {
  const { rows } = await pool.query(
    `SELECT "id","filename","title","docType","content","metadata"
     FROM "knowledge_documents" WHERE "isActive" = true`,
  );
  for (const doc of rows) {
    const contentHash = sha256(doc.content);
    // lewati bila chunk dengan hash sama sudah ada
    // split + embed, lalu dalam transaksi: DELETE by documentId, INSERT chunk
  }
}
```

**`src/infrastructure/rag/ingestJob.ts`** — runner job in-memory (status `idle|running|done|error`, lock anti-tumpang-tindih) yang dipanggil dari endpoint internal AI Agent:

| Endpoint AI Agent          | Fungsi                                             |
| :------------------------- | :------------------------------------------------- |
| `POST /ingest`             | Mulai job re-ingest (body opsional `{documentId,docType}`) |
| `GET /ingest/status`       | Status job terkini                                 |

Keduanya dilindungi header `x-internal-key` dan dipanggil backend (bukan browser langsung).

**`src/infrastructure/rag/retriever.ts`** — retrieval (read-only) dengan `embedQuery`, ambang skor, filter `docTypes`, dan opsi hybrid:

```ts
export async function searchKnowledge(query: string, options: KnowledgeSearchOptions = {}) {
  const topK = options.topK ?? env.AGENT_TOP_K;
  const minScore = options.minScore ?? env.RAG_MIN_SCORE;
  const docTypes = options.docTypes?.length ? options.docTypes : null;

  try {
    const vector = await getEmbeddings().embedQuery(query); // embedQuery, bukan embedDocuments
    const rows = env.RAG_HYBRID
      ? await hybridSearch(JSON.stringify(vector), query, topK, docTypes) // vector + full-text (RRF)
      : await vectorSearch(JSON.stringify(vector), topK, docTypes);
    return rows.filter(/* buang skor < minScore, kecuali cocok full-text */);
  } catch (err) {
    console.error("Retrieval knowledge base gagal:", err);
    return []; // degradasi anggun
  }
}
```

| Parameter                   | Nilai default | Efek                                                                 |
| :-------------------------- | :------------ | :------------------------------------------------------------------- |
| `OPENAI_EMBEDDING_MODEL`    | `text-embedding-3-small` | Model embedding; harus konsisten antara ingest & retrieval. |
| `EMBEDDING_DIMENSIONS`      | `1536`        | Harus sama dengan `vector(1536)` di skema (ERD §3.16).               |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `200` | Granularitas potongan; makin kecil makin presisi, makin banyak chunk. |
| `AGENT_TOP_K`               | `5`           | Jumlah chunk konteks yang diambil per query.                          |
| `RAG_MIN_SCORE`             | `0.3`         | Ambang skor cosine minimal agar chunk tak relevan dibuang.            |
| `RAG_HYBRID`                | `true`        | Gabungan vector + full-text (RRF); `false` = vector saja.             |

```bash
# Impor sekali: docs/knowledge/*.md → tabel knowledge_documents (source of truth)
make rag-import-docs

# Jalankan ingestion dari tabel knowledge_documents (via Docker)
make rag-ingest   # membaca knowledge_documents, menulis document_chunks
```

> **Penting:** AI Agent di runtime **hanya membaca** `document_chunks` untuk retrieval. Proses ingest memakai kredensial write terpisah; jangan memberi hak tulis ke proses runtime (least privilege).

#### 9.7.1 Manajemen Knowledge Base (Web, SUPER_ADMIN)

Backend mengekspos modul `/api/knowledge/*` (auth + `requireRole("SUPER_ADMIN")`), memakai multer untuk unggah `.md`/`.txt`:

| Endpoint                            | Fungsi                                   |
| :---------------------------------- | :--------------------------------------- |
| `GET /knowledge/documents`          | Daftar dokumen (paginasi, filter `docType`) |
| `POST /knowledge/documents`         | Unggah/tambah dokumen (multipart/JSON)   |
| `GET /knowledge/documents/:id`      | Detail (termasuk isi)                    |
| `PATCH /knowledge/documents/:id`    | Ubah (naikkan `version` bila isi berubah) |
| `DELETE /knowledge/documents/:id`   | Nonaktifkan (soft delete)                |
| `GET /knowledge/stats`              | Statistik dokumen & chunk per `docType`  |
| `GET /knowledge/chunks`             | Pratinjau/pencarian chunk terindeks      |
| `POST /knowledge/ingest`            | Picu re-ingest (proxy ke AI Agent)       |
| `GET /knowledge/ingest/status`      | Status re-ingest                         |

Skema: `knowledge_documents` (source of truth) + kolom metadata di `document_chunks` (`documentId`, `docType`, `title`, `metadata`, `contentHash`, `embeddingModel`, `dimensions`, `content_tsv`). Kolom generated `content_tsv` + index GIN dibuat via migrasi SQL manual.

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
    AI->>AI: intent → cari_sop (docType opsional)
    AI->>RAG: searchKnowledge(query, { topK, minScore, docTypes })
    RAG->>PG: hybrid (vector <=> + full-text @@) + threshold + LIMIT top_k (read-only)
    PG-->>RAG: chunks + score + docType
    RAG-->>AI: konteks SOP (judul + sumber)
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
# contoh perintah (semua via Docker)
make test          # unit + integration
make lint
make typecheck
```

---

## 12. Local Development Workflow

Semua perintah dijalankan lewat Docker (`make` membungkus `docker compose`).
Tidak ada `npm`/`tsx` di host.

### 12.1 Scripts per Service (dijalankan di dalam container)

```json
// backend/package.json (excerpt)
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
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
    "build": "NODE_OPTIONS=--max-old-space-size=6144 tsc -p tsconfig.build.json",
    "rag:ingest": "tsx src/infrastructure/rag/ingest.ts",
    "rag:import-docs": "tsx src/infrastructure/rag/importDocs.ts",
    "rag:generate-kamus": "tsx src/infrastructure/rag/generateKamus.ts",
    "rag:generate-laporan": "tsx src/infrastructure/rag/generateLaporan.ts",
    "lint": "eslint .",
    "typecheck": "NODE_OPTIONS=--max-old-space-size=6144 tsc --noEmit",
    "test": "vitest run"
  }
}
```

Perintah Makefile untuk menjalankannya di container:

| Kebutuhan        | Perintah                                             |
| :--------------- | :--------------------------------------------------- |
| Semua service    | `make dev` (Ctrl+C) / `make dev-down`                |
| Per service      | `make dev-backend` · `make dev-frontend` · `make dev-ai-agent` |
| Log              | `make dev-logs`                                      |
| Lint / Typecheck | `make lint` · `make typecheck`                       |
| Test             | `make test`                                          |
| Build produksi   | `make build`                                         |

### 12.2 Daily Loop

```bash
make dev          # db + backend + frontend + ai-agent (hot reload)
make dev-logs     # terminal lain: ikuti log
```

### 12.3 Reset & Reseed

```bash
# hapus data dan ulangi migration + seed (di dalam container backend)
make db-reset
```

### 12.4 Ingest Knowledge Base (RAG)

```bash
# 1) Sekali: impor dokumen statis docs/knowledge/*.md → tabel knowledge_documents
make rag-import-docs

# 2) Bangun/refresh index dari knowledge_documents → document_chunks
make rag-ingest

# 3) Opsional: generate dokumen dari Backend API lalu ingest otomatis
make rag-generate-kamus     # kamus produk dari katalog
make rag-generate-laporan   # laporan naratif periode berjalan
```

Setelah itu, dokumen juga dapat dikelola dari halaman web **Knowledge Base** (`SUPER_ADMIN`) dengan tombol re-ingest (per dokumen atau semua).

Verifikasi isi tabel:

```sql
SELECT "docType", count(*) FROM document_chunks GROUP BY "docType";
```

Jalankan lewat container DB: `make db-shell`.

### 12.5 Menguji Bot Lokal

1. Buat bot lewat **@BotFather** → dapat `TELEGRAM_BOT_TOKEN`.
2. Set token di `.env` (root) atau `ai-agent/.env`, lalu jalankan `make dev-ai-agent` (atau `make dev`).
3. Kirim pesan ke bot di Telegram. Untuk mode webhook, gunakan tunnel (mis. `cloudflared`/`ngrok`) dan set `domain`.

---

## 13. Coding Standards & Conventions

### 13.1 Naming

| Item          | Convention            | Example                       |
| :------------ | :-------------------- | :---------------------------- |
| File (modul)  | kebab-case            | `purchase-orders.service.ts`  |
| Variabel/fn   | camelCase             | `buildDocumentNumber`         |
| Tipe/Class    | PascalCase            | `StockTransactionInput`       |
| Konstanta     | UPPER_SNAKE_CASE      | `JWT_ACCESS_TTL`              |
| Tabel DB      | snake_case plural     | `purchase_order_items`        |
| Endpoint      | kebab-case plural     | `/delivery-notes`             |

### 13.2 TypeScript & Lint

- `strict: true`, hindari `any` (kecuali sangat terpaksa & diberi komentar).
- ESLint + Prettier dengan config seragam di ketiga service.
- Jalankan `make lint && make typecheck` sebelum commit (via Docker).

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
| `PrismaClientInitializationError`                  | DB belum siap / URL salah                  | `make db-up`, cek `DATABASE_URL` di compose.                      |
| `@prisma/client did not initialize`                | Belum `prisma generate`                    | `make dev` (generate otomatis saat start) atau `make shell-backend` lalu `npx prisma generate`. |
| Error ekstensi `vector` saat migrate               | Pakai image Postgres biasa                 | Gunakan `ankane/pgvector` (lihat compose).                        |
| Port 3000/5173/8080/5432 sudah dipakai             | Service lain berjalan                      | Hentikan proses atau ubah port.                                   |
| Bot tidak merespons                                | Token salah / bot belum di-`launch`        | Cek `TELEGRAM_BOT_TOKEN`, lihat log ai-agent.                     |
| `401` berulang di frontend                         | Access token expired, refresh gagal        | Cek interceptor & `JWT_REFRESH_SECRET`.                           |
| `403 FORBIDDEN` pada AI `POST /po/draft`           | `INTERNAL_API_KEY` tidak cocok             | Samakan key di backend & ai-agent.                                |
| Jawaban AI mengarang                               | Temperature > 0 / tools tak dipanggil      | Set `LLM_TEMPERATURE=0`, periksa deskripsi tool.                  |
| Jawaban SOP tidak relevan / kosong                 | `document_chunks` belum di-ingest          | Jalankan `make rag-ingest` (atau re-ingest dari UI), cek `AGENT_TOP_K`/`RAG_MIN_SCORE`. |
| Dokumen baru dari UI belum bisa dijawab            | Belum di-re-ingest setelah upload          | Klik re-ingest (per dokumen atau semua) di halaman Knowledge Base. |
| Error `expected 1536 dimensions`                   | Dimensi embedding tak cocok dengan kolom   | Samakan `EMBEDDING_DIMENSIONS` dgn `vector(1536)`; re-ingest.     |
| AI `permission denied for table document_chunks`   | User DB read-only kurang `GRANT SELECT`    | Beri `GRANT SELECT` pada `document_chunks` (lihat §2.3 rule 5).   |
| Outbound selalu ditolak                            | Stok belum di-seed / salah gudang          | Cek `Inventory` per `warehouseId`; jalankan `make seed`.          |
| Perubahan schema tidak terpakai                    | Client belum di-regenerate                 | `make dev` (generate otomatis saat start) lalu restart container. |

---

## 15. Roadmap → Technical Tasks

Pemetaan timeline 5 minggu (FSD) menjadi task teknis.

| Minggu | Fase                              | Task teknis kunci                                                                                                   |
| :----- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| 1      | Backend & DB                      | Init monorepo; `docker-compose.yml`; setup Backend + Prisma; migrate `init`; `seed.ts`; Auth (login/refresh/logout) + middleware auth/RBAC/validate/errorHandler; CRUD master data. |
| 2      | Backend Transaksi + Frontend Dasar | Endpoint transaksi (atomic stock), generator `poNumber`, PO lifecycle, audit helper; setup Vite + Tailwind + Router + `Providers` (QueryClient); layout; feature master data (`useQuery`). |
| 3      | Frontend Lanjutan + AI Dasar      | Feature transaksi & PO (form + `useMutation` + invalidation), halaman detail PO, dashboard; setup ai-agent, Telegraf long-polling, endpoint `/internal/ai-log`, mapping chatId→user; LLM + tools `cek_stok_barang`, `rekap_pengiriman`. |
| 4      | AI Lanjutan + RAG                 | Tool `buat_draft_po` → `POST /po/draft`; RAG: `knowledge_documents` (source of truth) + halaman web Knowledge Base (SUPER_ADMIN), ingest DB + job/CLI (`rag-import-docs`, `rag-generate-*`); retriever read-only (hybrid + threshold); tool `cari_sop`/`cari_nama_produk`/`cari_laporan`; guardrail, rate limit, conversation logging. |
| 5      | Testing & Finalisasi              | Integration E2E (chat → draft PO → muncul di web); bug fixing & error handling; optimasi prompt & latency; hardening; dokumentasi akhir & demo script. |

---

*End of Technical Design Document*
