# Functional Specification Document (FSD)

**Project:** Otomatisasi Warehouse Management System (WMS) dan Tata Kelola Dokumen Berbasis Web dengan Integrasi Asisten AI (RAG) pada Platform Pesan Instan

**Document Type:** Functional Specification Document
**Version:** 1.0.0
**Status:** Draft
**Author:** Project Owner
**Date:** 2026-09-22

**Related Documents:** [BRD](./BRD.md) · [ERD](./ERD.md) · [TECHNICAL](./TECHNICAL.md)

---

## 1. Document Control

### 1.1 Revision History

| Version | Date       | Author        | Description                            |
| :------ | :--------- | :------------ | :------------------------------------- |
| 1.0.0   | 2026-09-22 | Project Owner | Initial FSD derived from BRD |

### 1.2 Requirement ID Convention

| Prefix    | Meaning                    |
| :-------- | :------------------------- |
| `FR-xx`   | Functional Requirement     |
| `FR-xx.n` | Sub-functional requirement |
| `NFR-xx`  | Non-Functional Requirement |
| `UC-xx`   | Use Case                   |
| `AC-xx`   | Acceptance Criteria        |

---

## 2. Introduction & Purpose

Dokumen ini menjabarkan spesifikasi fungsional sistem WMS + AI RAG secara rinci, sebagai acuan implementasi oleh developer. Dokumen mencakup arsitektur sistem, kebutuhan fungsional per modul, alur pengguna, spesifikasi API, spesifikasi AI Agent, aturan validasi, kebutuhan non-fungsional, dan skenario pengujian.

Target pembaca: developer, dosen pembimbing/penguji, dan pemangku kepentingan proyek.

---

## 3. System Overview

### 3.1 Context Diagram

```mermaid
flowchart TB
    Owner([Owner / Manager]) -->|Chat| IM[Telegram / WhatsApp]
    Admin([Warehouse Admin]) -->|Browser| FE[Frontend Web<br/>React + Vite]
    Super([Super Admin]) -->|Browser| FE

    IM <-->|Webhook / API| AI[AI Agent Service<br/>LangChain + Telegraf]
    FE <-->|REST API| BE[Backend Service<br/>Express + TypeScript]
    AI <-->|REST API / Function Calling| BE
    BE <-->|"Prisma ORM (read/write)"| DB[(PostgreSQL + pgvector)]
    AI -.->|"pgvector read-only (RAG)"| DB
    AI <-->|LLM API| LLM[OpenAI / Gemini]
```

> **Catatan arsitektur:** AI Agent hanya diberi akses **read-only** ke tabel vector `document_chunks` (knowledge/SOP). Data bisnis (stok, PO, transaksi) diakses melalui Backend REST API. Backend adalah satu-satunya penulis data bisnis.

### 3.2 Service Responsibilities

| Service      | Responsibility                                                                 |
| :----------- | :----------------------------------------------------------------------------- |
| **Frontend** | UI dashboard WMS: master data, transaksi, PO, Surat Jalan, laporan.            |
| **Backend**  | REST API sentral, logika bisnis, validasi, autentikasi, akses database (read/write). |
| **AI Agent** | Menerima pesan chat, mengenali intent, memanggil tools/API backend, retrieval knowledge (RAG, read-only), menyusun jawaban natural. |
| **Database** | Menyimpan data relasional (WMS) dan vector embeddings untuk knowledge/SOP.      |

### 3.3 End-to-End Workflow (Create PO via Chat)

```mermaid
sequenceDiagram
    actor Owner
    participant TG as Telegram
    participant AI as AI Agent
    participant BE as Backend API
    participant DB as PostgreSQL
    participant FE as Web Dashboard

    Owner->>TG: "Besok siapkan PO untuk PT Maju Jaya isinya 50 pack Dimsum"
    TG->>AI: Webhook message
    AI->>AI: Intent routing (buat_draft_po)
    AI->>BE: POST /api/po/draft {partnerName, productName, qty}
    BE->>DB: Cari Partner & Product
    BE->>DB: Insert PurchaseOrder (status=DRAFT) + Item
    DB-->>BE: Success
    BE-->>AI: 201 Created {poNumber}
    AI-->>TG: "Draft PO ... sudah dibuat. Cek web untuk konfirmasi."
    TG-->>Owner: Natural language reply
    FE->>BE: GET /api/po?status=DRAFT (TanStack Query)
    BE-->>FE: Draft PO list
```

---

## 4. Tech Stack

| Layer        | Technology                                                       | Function                                                        |
| :----------- | :--------------------------------------------------------------- | :-------------------------------------------------------------- |
| **Frontend** | React (Vite), TypeScript, Tailwind CSS, TanStack Query           | Dashboard WMS, state asinkron, caching, optimistic updates.     |
| **Backend**  | Node.js (Express), TypeScript, Prisma ORM, Zod                   | REST API, logika bisnis, autentikasi, validasi.                 |
| **AI Agent** | Node.js, TypeScript, LangChain.js, Telegraf                      | Webhook chat, RAG retrieval (pgvector, read-only), function calling ke backend. |
| **Database** | PostgreSQL + ekstensi `pgvector`                                 | Data relasional + vector embeddings knowledge/SOP (`document_chunks`).          |
| **Infra**    | Docker, Docker Compose                                           | Isolasi & orkestrasi container.                                 |
| **LLM**      | OpenAI (`gpt-4o-mini`) + `text-embedding-3-small`                | Intent recognition, natural language generation, dan embeddings RAG.           |

---

## 5. Roles & Permission Matrix

| Capability                       | Super Admin | Warehouse Admin | Owner (Chat) |
| :------------------------------- | :---------: | :-------------: | :----------: |
| Manage users & roles             |      ✅     |        ❌       |      ❌      |
| View audit log                   |      ✅     |        ❌       |      ❌      |
| Manage master data (CRUD)        |      ✅     |        ✅       |      ❌      |
| Record inbound/outbound          |      ✅     |        ✅       |      ❌      |
| Create/edit PO                   |      ✅     |        ✅       |  ✅ (draft only) |
| Confirm/cancel PO                |      ✅     |        ✅       |      ❌      |
| Create Surat Jalan               |      ✅     |        ✅       |      ❌      |
| View dashboard & reports         |      ✅     |        ✅       | ✅ (via chat) |
| Chat: check stock                |      ✅     |        ✅       |      ✅      |
| Chat: shipment recap             |      ✅     |        ✅       |      ✅      |
| Chat: create PO draft            |      ✅     |        ✅       |      ✅      |
| Chat: SOP/knowledge (RAG)        |      ✅     |        ✅       |      ✅      |

> **Access control:** JWT-based authentication (access + refresh token). AI chat authenticated by mapping `chatUserId` → `User.telegramId`/`whatsappNumber`.

---

## 6. Functional Requirements

### FR-01 — Authentication & Session

| ID       | Requirement                                                                                  | Priority |
| :------- | :------------------------------------------------------------------------------------------- | :------- |
| FR-01.1  | User dapat login dengan email & password.                                                    | Must     |
| FR-01.2  | Password disimpan sebagai hash (bcrypt/argon2).                                               | Must     |
| FR-01.3  | Sistem menerbitkan JWT access token (short-lived) & refresh token (long-lived).               | Must     |
| FR-01.4  | User dapat logout (invalidate refresh token).                                                 | Must     |
| FR-01.5  | Sistem membatasi endpoint berdasarkan role (RBAC middleware).                                 | Must     |
| FR-01.6  | Sesi chat (Telegram) dipetakan ke user terdaftar; pesan dari nomor tak dikenal ditolak/di-ignore. | Must |

### FR-02 — User & Role Management

| ID       | Requirement                                                          | Priority |
| :------- | :------------------------------------------------------------------- | :------- |
| FR-02.1  | Super Admin dapat membuat, mengubah, menonaktifkan user.             | Must     |
| FR-02.2  | Super Admin dapat menetapkan role (`SUPER_ADMIN`, `ADMIN`, `OWNER`). | Must     |
| FR-02.3  | User dapat mengaitkan akun dengan `telegramId` / `whatsappNumber`.   | Must     |
| FR-02.4  | Sistem menolak akses dari user non-aktif.                            | Must     |

### FR-03 — Master Data

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-03.1  | CRUD **Category** (nama unik).                                                                 | Must     |
| FR-03.2  | CRUD **Product** (SKU unik, nama, deskripsi, unit, category, stock, min stock).                | Must     |
| FR-03.3  | Pencarian & filter produk berdasarkan nama/SKU/kategori.                                      | Must     |
| FR-03.4  | CRUD **Partner** dengan tipe `SUPPLIER` / `CUSTOMER` (nama, phone, address).                   | Must     |
| FR-03.5  | CRUD **Warehouse** (kode, nama, alamat).                                                       | Must     |
| FR-03.6  | Sistem mencegah penghapusan master data yang masih direferensikan transaksi (restrict).        | Must     |
| FR-03.7  | Sistem memberi peringatan jika stok produk di bawah `minStock` (low-stock alert).              | Should   |

### FR-04 — Inbound (Barang Masuk)

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-04.1  | Admin dapat mencatat transaksi barang masuk (produk, qty, warehouse, catatan, tanggal).        | Must     |
| FR-04.2  | Setiap transaksi masuk menambah `Product.stock` secara otomatis.                               | Must     |
| FR-04.3  | Transaksi masuk dapat dikaitkan ke sebuah PO supplier (opsional).                              | Should   |
| FR-04.4  | Sistem menolak qty ≤ 0.                                                                        | Must     |
| FR-04.5  | Sistem mencatat `createdById` & timestamp.                                                     | Must     |
| FR-04.6  | Admin dapat membatalkan (void) transaksi dengan alasan, dan stok dikoreksi (soft reversal).    | Should   |

### FR-05 — Outbound (Barang Keluar)

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-05.1  | Admin dapat mencatat transaksi barang keluar (produk, qty, warehouse, catatan, tanggal).       | Must     |
| FR-05.2  | Setiap transaksi keluar mengurangi `Product.stock` secara otomatis.                            | Must     |
| FR-05.3  | Sistem menolak transaksi keluar jika qty > stok tersedia (BR-RULE-002).                        | Must     |
| FR-05.4  | Transaksi keluar dapat dikaitkan dengan Surat Jalan / customer (opsional).                     | Should   |
| FR-05.5  | Sistem mencatat `createdById` & timestamp.                                                     | Must     |

### FR-06 — Purchase Order

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-06.1  | Admin dapat membuat PO (partner, target date, catatan, item list).                             | Must     |
| FR-06.2  | Sistem men-generate `poNumber` unik otomatis.                                                  | Must     |
| FR-06.3  | PO baru berstatus `DRAFT`.                                                                      | Must     |
| FR-06.4  | Admin dapat mengubah PO saat `DRAFT` (termasuk item).                                           | Must     |
| FR-06.5  | Admin dapat mengonfirmasi PO → `CONFIRMED`.                                                     | Must     |
| FR-06.6  | Admin dapat menandai PO `COMPLETED` setelah barang diproses.                                    | Must     |
| FR-06.7  | Admin dapat membatalkan PO → `CANCELLED`.                                                       | Must     |
| FR-06.8  | Sistem hanya mengizinkan penghapusan PO saat `DRAFT` (cascade item).                            | Must     |
| FR-06.9  | AI dapat membuat PO `DRAFT` dari instruksi bahasa natural (lihat FR-08).                        | Must     |
| FR-06.10 | Sistem menampilkan daftar PO dengan filter status/partner/tanggal.                              | Should   |
| FR-06.11 | Sistem dapat mengekspor PO ke PDF.                                                              | Could    |

### FR-07 — Delivery Note (Surat Jalan)

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-07.1  | Admin dapat membuat Surat Jalan dari PO berstatus `CONFIRMED`/`COMPLETED`.                      | Should   |
| FR-07.2  | Sistem men-generate nomor Surat Jalan unik.                                                     | Should   |
| FR-07.3  | Surat Jalan berisi partner, daftar item, qty, dan tanggal kirim.                                | Should   |
| FR-07.4  | Konfirmasi Surat Jalan membuat transaksi OUT otomatis (opsional, sesuai konfigurasi).            | Could    |
| FR-07.5  | Surat Jalan dapat dicetak/diekspor PDF.                                                          | Could    |
| FR-07.6  | Status Surat Jalan: `DRAFT`, `SHIPPED`, `DELIVERED`, `CANCELLED`.                               | Should   |

### FR-08 — AI Chat Assistant

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-08.1  | Sistem menerima pesan masuk dari Telegram (MVP) / WhatsApp (lanjutan).                          | Must     |
| FR-08.2  | AI mengenali intent: **check stock**, **daily shipment recap**, **create PO draft**, **SOP/knowledge (RAG)**. | Must     |
| FR-08.3  | AI memanggil tools (function calling) untuk membaca/menulis data bisnis — dilarang raw SQL.     | Must     |
| FR-08.4  | Jawaban AI hanya berdasarkan data dari backend (anti-halusinasi, temperature 0).                | Must     |
| FR-08.5  | AI membalas dengan bahasa Indonesia natural & profesional.                                      | Must     |
| FR-08.6  | Jika data tidak ditemukan, AI memberi pesan jelas (bukan mengarang).                            | Must     |
| FR-08.7  | Semua percakapan dicatat pada `AiConversationLog` (audit & evaluasi).                           | Should   |
| FR-08.8  | AI hanya melayani user yang terautentikasi (mapping chat ID → user).                            | Must     |
| FR-08.9  | AI memberikan feedback "typing" saat memproses.                                                 | Should   |
| FR-08.10 | Sistem menangani error LLM/downstream dengan pesan ramah ke user.                               | Must     |
| FR-08.11 | AI menjawab pertanyaan SOP/kebijakan dari knowledge base via retrieval vector (RAG), read-only ke `document_chunks`. | Should |
| FR-08.12 | Jawaban SOP hanya bersumber dari konteks retrieval (grounded), menyebutkan sumber bila tersedia. | Must   |
| FR-08.13 | Knowledge base dapat di-*ingest* dari dokumen SOP (chunking + embeddings) via proses terpisah.   | Should   |

**Intent → Tool Mapping**

| Intent               | Trigger Example                                                    | Tool (`name`)     | Action                          |
| :------------------- | :----------------------------------------------------------------- | :---------------- | :------------------------------ |
| Check stock          | "Ada berapa sisa stok dimsum ukuran sedang?"                        | `cek_stok_barang` | GET produk + stock              |
| Daily shipment recap | "Kemarin tgl 20 kita kirim kemana aja?"                            | `rekap_pengiriman`| GET transaksi OUT by date       |
| Create PO draft      | "Besok siapkan PO untuk PT Maju Jaya isinya 50 pack Dimsum"        | `buat_draft_po`   | POST draft PO                   |
| SOP / knowledge       | "Apa SOP penerimaan barang retur?"                                 | `cari_sop`        | Retrieval top-K `document_chunks` (read-only) |

### FR-09 — Dashboard & Reporting

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-09.1  | Dashboard menampilkan ringkasan: total produk, stok kritis, transaksi hari ini, PO aktif.      | Should   |
| FR-09.2  | Laporan transaksi masuk/keluar per periode dengan filter.                                      | Should   |
| FR-09.3  | Laporan stok terkini per gudang/kategori.                                                       | Should   |
| FR-09.4  | Laporan pengiriman harian (mendukung intent recap AI).                                          | Should   |
| FR-09.5  | Ekspor laporan ke CSV/Excel.                                                                    | Could    |

### FR-10 — Audit Log

| ID       | Requirement                                                                                   | Priority |
| :------- | :-------------------------------------------------------------------------------------------- | :------- |
| FR-10.1  | Sistem mencatat perubahan pada entitas penting (product, PO, transaksi, user).                  | Should   |
| FR-10.2  | Audit log menyimpan: actor, action, entity, entityId, before/after (JSON), timestamp, IP.       | Should   |
| FR-10.3  | Super Admin dapat melihat & memfilter audit log.                                                | Should   |

---

## 7. Use Cases

### UC-01 — Owner Checks Stock via Chat

| Field          | Detail                                                              |
| :------------- | :------------------------------------------------------------------ |
| **Actor**      | Owner                                                               |
| **Precondition** | Owner terdaftar & chat ID ter-mapping ke user aktif.              |
| **Trigger**    | Owner mengirim "Berapa sisa stok dimsum ukuran sedang?"             |
| **Main Flow**  | 1. AI menerima pesan → 2. Intent routing ke `cek_stok_barang` → 3. Query produk via backend → 4. AI menyusun jawaban → 5. Balas ke chat. |
| **Alternate**  | Produk tidak ditemukan → AI minta klarifikasi nama barang.          |
| **Postcondition** | Percakapan tercatat; tidak ada perubahan data.                   |

### UC-02 — Owner Creates PO Draft via Chat

| Field          | Detail                                                              |
| :------------- | :------------------------------------------------------------------ |
| **Actor**      | Owner                                                               |
| **Precondition** | Partner & Product sudah ada di master data.                       |
| **Trigger**    | "Besok siapkan PO untuk PT Maju Jaya isinya 50 pack Dimsum"         |
| **Main Flow**  | 1. AI parse intent & parameter → 2. Panggil `buat_draft_po` → 3. Backend validasi & insert PO `DRAFT` → 4. AI konfirmasi ke chat. |
| **Alternate**  | Partner/Product tidak ditemukan → AI informasikan kegagalan.        |
| **Postcondition** | Draft PO muncul di dashboard admin.                               |

### UC-03 — Admin Records Inbound/Outbound

| Field          | Detail                                                              |
| :------------- | :------------------------------------------------------------------ |
| **Actor**      | Warehouse Admin                                                     |
| **Precondition** | Login & produk tersedia.                                         |
| **Trigger**    | Admin membuka form transaksi.                                       |
| **Main Flow**  | 1. Pilih produk & gudang → 2. Input qty & catatan → 3. Submit → 4. Sistem update stok → 5. TanStack Query invalidate → tabel stok refresh. |
| **Alternate**  | Qty melebihi stok (OUT) → sistem menolak dengan pesan error.        |
| **Postcondition** | Stok ter-update, transaksi tercatat.                              |

### UC-04 — Admin Confirms PO from Chat

| Field          | Detail                                                              |
| :------------- | :------------------------------------------------------------------ |
| **Actor**      | Warehouse Admin                                                     |
| **Precondition** | Terdapat PO `DRAFT` (mungkin dari AI).                            |
| **Trigger**    | Admin membuka halaman PO.                                           |
| **Main Flow**  | 1. Lihat draft PO → 2. Verifikasi item → 3. Klik Confirm → 4. Status `CONFIRMED`. |
| **Postcondition** | PO siap dibuatkan Surat Jalan.                                    |

---

## 8. Screen Inventory (Frontend)

| ID    | Screen                  | Route                     | Key Elements                                             |
| :---- | :---------------------- | :------------------------ | :------------------------------------------------------- |
| S-01  | Login                   | `/login`                  | Email, password, submit.                                 |
| S-02  | Dashboard               | `/`                       | KPI cards, low-stock alerts, recent transactions.        |
| S-03  | Product List            | `/products`               | Tabel + search/filter, tombol CRUD.                      |
| S-04  | Product Form            | `/products/new`, `/:id/edit` | Form master barang.                                  |
| S-05  | Category List          | `/categories`             | Tabel + CRUD.                                            |
| S-06  | Partner List           | `/partners`               | Tabel + filter tipe (Supplier/Customer) + CRUD.          |
| S-07  | Warehouse List         | `/warehouses`             | Tabel + CRUD.                                            |
| S-08  | Inbound Transactions   | `/inbound`                | Tabel transaksi masuk + form input.                      |
| S-09  | Outbound Transactions  | `/outbound`               | Tabel transaksi keluar + form input.                     |
| S-10  | Purchase Order List    | `/purchase-orders`        | Tabel + filter status; highlight draft dari AI.           |
| S-11  | Purchase Order Detail  | `/purchase-orders/:id`    | Header + item; aksi confirm/complete/cancel/print.        |
| S-12  | Delivery Note List     | `/delivery-notes`         | Tabel + CRUD.                                            |
| S-13  | Reports                | `/reports`                | Filter periode, tabel, export.                           |
| S-14  | User Management        | `/users`                  | Tabel user + role + mapping chat ID (Super Admin).        |
| S-15  | Audit Log              | `/audit-logs`             | Tabel + filter (Super Admin).                             |

---

## 9. API Specification

### 9.1 Conventions

- **Base URL:** `http://localhost:3000/api`
- **Auth:** `Authorization: Bearer <access_token>`
- **Content-Type:** `application/json`
- **Pagination:** `?page=1&limit=20`
- **Error envelope:** `{ "success": false, "error": { "code": "...", "message": "..." } }`
- **Success envelope:** `{ "success": true, "data": {...}, "meta": {...} }`

### 9.2 Auth & Users

| Method | Endpoint                | Description             | Auth        |
| :----- | :---------------------- | :---------------------- | :---------- |
| POST   | `/auth/login`           | Login, issue tokens     | Public      |
| POST   | `/auth/refresh`         | Refresh access token    | Public      |
| POST   | `/auth/logout`          | Invalidate refresh token| Bearer      |
| GET    | `/users`                | List users              | Super Admin |
| POST   | `/users`                | Create user             | Super Admin |
| PATCH  | `/users/:id`            | Update user/role        | Super Admin |
| DELETE | `/users/:id`            | Deactivate user         | Super Admin |

### 9.3 Master Data

| Method | Endpoint             | Description            | Auth   |
| :----- | :------------------- | :--------------------- | :----- |
| GET    | `/products`          | List products (filter) | Bearer |
| POST   | `/products`          | Create product         | Admin  |
| GET    | `/products/:id`      | Get product detail     | Bearer |
| PATCH  | `/products/:id`      | Update product         | Admin  |
| DELETE | `/products/:id`      | Delete product         | Admin  |
| GET/POST/PATCH/DELETE | `/categories` | Category CRUD | Admin |
| GET/POST/PATCH/DELETE | `/partners`   | Partner CRUD  | Admin |
| GET/POST/PATCH/DELETE | `/warehouses` | Warehouse CRUD| Admin |

### 9.4 Inventory Transactions

| Method | Endpoint               | Description                          | Auth  |
| :----- | :--------------------- | :----------------------------------- | :---- |
| GET    | `/transactions`        | List transactions (type/date filter) | Bearer |
| POST   | `/transactions/inbound`| Record inbound                       | Admin |
| POST   | `/transactions/outbound`| Record outbound                     | Admin |
| POST   | `/transactions/:id/void`| Void transaction (with reason)      | Admin |

### 9.5 Purchase Order

| Method | Endpoint                  | Description                      | Auth        |
| :----- | :------------------------ | :------------------------------- | :---------- |
| GET    | `/po`                     | List PO (filter status/partner)  | Bearer      |
| POST   | `/po`                     | Create PO (status DRAFT)         | Admin       |
| **POST** | **`/po/draft`**         | **Internal: create draft (AI)**  | Service/AI  |
| GET    | `/po/:id`                 | PO detail with items             | Bearer      |
| PATCH  | `/po/:id`                 | Update PO (only DRAFT)           | Admin       |
| POST   | `/po/:id/confirm`         | Confirm PO                       | Admin       |
| POST   | `/po/:id/complete`        | Complete PO                      | Admin       |
| POST   | `/po/:id/cancel`          | Cancel PO                        | Admin       |
| DELETE | `/po/:id`                 | Delete PO (only DRAFT)           | Admin       |
| GET    | `/po/:id/pdf`             | Export PO to PDF                 | Bearer      |

**Example — `POST /po/draft` (called by AI Agent):**

```json
// Request
{
  "partnerName": "PT Maju Jaya",
  "items": [{ "productName": "Dimsum Ayam Sedang", "qty": 50 }],
  "targetDate": "2026-09-23",
  "source": "AI_CHAT"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "9b1d...",
    "poNumber": "PO-202609-001",
    "status": "DRAFT",
    "partner": { "id": "a1...", "name": "PT Maju Jaya" },
    "items": [{ "productName": "Dimsum Ayam Sedang", "qty": 50 }]
  }
}
```

### 9.6 Delivery Note

| Method | Endpoint              | Description             | Auth  |
| :----- | :-------------------- | :---------------------- | :---- |
| GET    | `/delivery-notes`     | List delivery notes     | Bearer |
| POST   | `/delivery-notes`     | Create from PO          | Admin |
| GET    | `/delivery-notes/:id` | Detail                  | Bearer |
| PATCH  | `/delivery-notes/:id` | Update status           | Admin |
| GET    | `/delivery-notes/:id/pdf` | Export PDF          | Bearer |

### 9.7 Reports (internal for AI + web)

| Method | Endpoint                        | Description                         | Auth       |
| :----- | :------------------------------ | :---------------------------------- | :--------- |
| GET    | `/reports/stock`                | Current stock report                | Bearer     |
| GET    | `/reports/stock/:productName`   | Stock lookup by name (AI tool)      | Service/AI |
| GET    | `/reports/shipments?date=`      | Daily shipment recap (AI tool)      | Service/AI |
| GET    | `/reports/low-stock`            | Low stock alerts                    | Bearer     |

### 9.8 Error Codes

| HTTP | Code                 | Meaning                              |
| :--- | :------------------- | :----------------------------------- |
| 400  | `VALIDATION_ERROR`   | Invalid input (Zod).                 |
| 401  | `UNAUTHENTICATED`    | Missing/invalid token.               |
| 403  | `FORBIDDEN`          | Insufficient role.                   |
| 404  | `NOT_FOUND`          | Resource not found.                  |
| 409  | `INSUFFICIENT_STOCK` | Outbound exceeds available stock.    |
| 409  | `INVALID_STATE`      | Illegal PO/DN state transition.      |
| 422  | `UNPROCESSABLE`      | Business rule violation.             |
| 500  | `INTERNAL_ERROR`     | Unexpected server error.             |

---

## 10. AI Agent Specification

### 10.1 Architecture

AI Agent memiliki **dua jalur data**:

1. **Data bisnis** — pola **Function/Tool Calling**. AI **tidak** menulis SQL langsung; Backend mengekspos endpoint aman, AI memilih tool dan mengisi parameter tervalidasi (Zod). Backend satu-satunya penulis data bisnis.
2. **Knowledge/SOP** — **RAG retrieval** *read-only* ke tabel `document_chunks` (pgvector). Dokumen SOP di-*ingest* (chunking + embeddings) oleh proses offline terpisah, lalu diambil top-K saat runtime.

```mermaid
flowchart LR
    Q[Pesan user] --> AI[AI Agent]
    AI -->|Function Calling| BE[Backend API]
    BE --> WMS[(Data WMS)]
    AI -->|retrieval top-K, read-only| VC[(document_chunks pgvector)]
    AI --> LLM[LLM + embeddings]
```

### 10.2 Tools

| Tool Name          | Description                              | Parameters (Zod)                                     | Backend/Source                  |
| :----------------- | :--------------------------------------- | :--------------------------------------------------- | :------------------------------ |
| `cek_stok_barang`  | Cek sisa stok berdasarkan nama barang    | `productName: string`                                | `GET /reports/stock/:productName` |
| `rekap_pengiriman` | Rekap pengiriman pada tanggal tertentu   | `date: string` (ISO or natural)                      | `GET /reports/shipments?date=`  |
| `buat_draft_po`    | Membuat draft Purchase Order             | `partnerName: string`, `items: {productName, qty}[]` | `POST /po/draft`                |
| `cari_sop`         | Cari SOP/kebijakan internal (RAG)        | `query: string`                                      | `document_chunks` (read-only, top-K) |

### 10.3 System Prompt Guidelines

```
You are a smart Warehouse Assistant (Virtual WMS) for an Indonesian SME.
- Respond in professional, friendly Bahasa Indonesia.
- NEVER fabricate stock, shipment, or partner data.
- ALWAYS use provided tools to read or write business data.
- For SOP/policy questions, use the cari_sop tool and answer ONLY from returned context; cite the source when available.
- If a tool returns not-found, ask the user for clarification; do not invent values.
- When creating a PO, always keep status DRAFT and remind the user to confirm on the web.
- Do not reveal internal IDs, SQL, or API keys.
```

### 10.4 Guardrails

| Guardrail             | Implementation                                                      |
| :-------------------- | :------------------------------------------------------------------ |
| No raw SQL (business) | Tools only; backend enforces parameterized Prisma queries.          |
| DB read-only (RAG)    | Runtime AI Agent hanya `SELECT` pada `document_chunks`; tanpa hak tulis. |
| Grounded RAG answer   | Jawab SOP hanya dari konteks hasil retrieval; sebut sumber bila ada. |
| Anti-hallucination    | `temperature = 0`, tool-only data, refuse unknown data.             |
| Authorization         | Map chat ID → registered active user; else reject.                  |
| Rate limiting         | Limit messages per user per minute.                                 |
| Input sanitation      | Zod schemas + validation before any write.                          |
| Audit                 | Log every message + tool call + result to `AiConversationLog`.      |
| Scope limitation      | Intents MVP: stock, shipment, PO, SOP; expand post-MVP.             |

### 10.5 Error/Edge Handling

| Scenario                        | AI Behavior                                              |
| :------------------------------ | :------------------------------------------------------- |
| Product not found               | "Saya tidak menemukan barang bernama X. Bisa sebutkan nama lain?" |
| Partner not found               | Inform failure; do not create PO.                        |
| Insufficient stock for PO       | Warn user; still create draft (PO does not move stock).  |
| SOP not found in knowledge base | State that no relevant SOP was found; do not invent policy. |
| LLM/API error                   | "Maaf, sistem sedang mengalami gangguan. Coba lagi nanti."|
| Out-of-scope question           | Politely state limitation and suggest capabilities.      |

---

## 11. Validation & Business Logic Rules

| ID    | Rule                                                                                          |
| :---- | :-------------------------------------------------------------------------------------------- |
| VL-01 | `Product.sku` unik; `Category.name` unik; `poNumber` unik.                                     |
| VL-02 | `quantity` transaksi & PO item harus integer > 0.                                              |
| VL-03 | Outbound: `quantity ≤ Product.stock` (gudang terkait).                                         |
| VL-04 | PO hanya editable saat `DRAFT`; state transition mengikuti diagram pada §11.1.                 |
| VL-05 | Hapus master data yang direferensikan transaksi → ditolak (RESTRICT) kecuali tanpa referensi.  |
| VL-06 | `Product.stock` tidak boleh diubah via endpoint update produk secara langsung.                 |
| VL-07 | Delivery Note hanya dari PO `CONFIRMED`/`COMPLETED`.                                           |

### 11.1 PO State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> CONFIRMED: confirm
    DRAFT --> CANCELLED: cancel/delete
    CONFIRMED --> COMPLETED: complete
    CONFIRMED --> CANCELLED: cancel
    COMPLETED --> [*]
    CANCELLED --> [*]
```

---

## 12. Non-Functional Requirements

| ID      | Category        | Requirement                                                                     |
| :------ | :-------------- | :------------------------------------------------------------------------------ |
| NFR-01  | Performance     | Respons API rata-rata < 500 ms untuk operasi CRUD.                              |
| NFR-02  | Performance     | Jawaban AI chat < 5 detik untuk query stok/rekap.                               |
| NFR-03  | Scalability     | Arsitektur container dapat di-scale horizontal per service.                     |
| NFR-04  | Security        | Password hashed; JWT; HTTPS di production; secrets via env.                     |
| NFR-05  | Security        | Validasi input dengan Zod di semua endpoint write.                              |
| NFR-06  | Reliability     | Sistem menangani kegagalan LLM/downstream tanpa crash (graceful degradation).    |
| NFR-07  | Auditability    | Perubahan data penting & percakapan AI tercatat.                                |
| NFR-08  | Usability       | Web dashboard responsif; chat *zero-learning-curve*.                            |
| NFR-09  | Maintainability | Kode TypeScript terstruktur; linting & formatting konsisten.                    |
| NFR-10  | Portability     | Dapat dijalankan via `docker compose up` di Linux/WSL2/VPS.                     |
| NFR-11  | Observability   | Logging terstruktur untuk backend & AI agent.                                   |
| NFR-12  | Security        | AI Agent memakai kredensial DB **read-only** (`SELECT` pada `document_chunks`); least privilege. |

---

## 13. Deployment Topology (Docker Compose)

```yaml
version: '3.8'

services:
  db:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: wms_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/wms_db
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - db

  ai-agent:
    build: ./ai-agent
    environment:
      - PORT=8080
      - BACKEND_API_URL=http://backend:3000/api
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=gpt-4o-mini
      - OPENAI_EMBEDDING_MODEL=text-embedding-3-small
      - EMBEDDING_DIMENSIONS=1536
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - AGENT_TOP_K=12
      - CHUNK_SIZE=1000
      - CHUNK_OVERLAP=200
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=wms_db
      - DB_USER=${POSTGRES_USER}
      - DB_PASSWORD=${POSTGRES_PASSWORD}
    ports:
      - "8080:8080"
    depends_on:
      - db
      - backend

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:3000

volumes:
  pgdata:
```

| Service    | Internal Port | External Port | Notes                        |
| :--------- | :------------ | :------------ | :--------------------------- |
| db         | 5432          | 5432          | PostgreSQL + pgvector        |
| backend    | 3000          | 3000          | REST API                     |
| ai-agent   | 8080          | 8080          | Webhook bot + RAG retrieval  |
| frontend   | 5173          | 5173          | Vite dev / static build      |

> **Catatan:** AI Agent memakai kredensial DB read-only (least privilege). Detail env & pipeline RAG ada di [TECHNICAL §5 & §9](./TECHNICAL.md).

---

## 14. Acceptance Criteria & Test Scenarios

| ID    | Scenario                                   | Steps                                                                 | Expected Result                                         |
| :---- | :----------------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------ |
| AC-01 | Login sukses                               | Input kredensial valid → submit                                       | Redirect dashboard, token tersimpan.                    |
| AC-02 | RBAC menolak akses                         | Admin akses `/users`                                                  | 403 FORBIDDEN.                                          |
| AC-03 | Create product                             | Isi form → submit                                                     | Produk muncul di list, audit log tercatat.              |
| AC-04 | Inbound menambah stok                      | Catat IN qty 50                                                        | `Product.stock` +50.                                    |
| AC-05 | Outbound melebihi stok ditolak             | Catat OUT qty > stok                                                   | 409 INSUFFICIENT_STOCK.                                 |
| AC-06 | AI cek stok akurat                         | Chat "sisa stok dimsum?" → bandingkan DB                              | Angka sama persis dengan DB.                            |
| AC-07 | AI buat draft PO                           | Chat perintah PO → cek dashboard                                      | PO `DRAFT` muncul di antrean admin.                     |
| AC-08 | PO dibuat via chat tidak langsung CONFIRM  | Buat PO via chat                                                      | Status tetap `DRAFT` hingga admin confirm.              |
| AC-09 | Konfirmasi PO                              | Admin klik confirm                                                    | Status `CONFIRMED`; hanya valid dari `DRAFT`.           |
| AC-10 | Out-of-scope chat ditangani baik           | Chat "berapa harga saham?"                                            | AI menolak sopan & menawarkan kapabilitas.              |
| AC-11 | Product not found via chat                 | Chat barang tidak ada                                                 | AI minta klarifikasi, tidak mengarang.                  |
| AC-12 | Cascade delete PO draft                    | Hapus PO `DRAFT`                                                      | Item ikut terhapus; DB bersih.                          |
| AC-13 | TanStack Query refresh                     | Submit transaksi → lihat tabel stok                                   | Tabel ter-update tanpa reload manual.                   |
| AC-14 | Delivery note dari PO                       | Buat DN dari PO `CONFIRMED`                                           | DN terbentuk; dari PO `DRAFT` ditolak.                  |
| AC-15 | AI jawab SOP via RAG                        | Ingest SOP → chat "Apa SOP retur?"                                    | Jawaban sesuai konteks SOP + menyebut sumber.           |
| AC-16 | RAG anti-halusinasi                         | Ingest SOP tanpa memuat topik X → tanya X                             | AI menyatakan SOP tidak ditemukan (tidak mengarang).    |
| AC-17 | AI Agent read-only DB                       | Coba tulis `document_chunks` dari runtime AI                          | Ditolak (permission denied).                             |

---

*End of Functional Specification Document*
