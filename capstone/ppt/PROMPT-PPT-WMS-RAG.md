# Prompt PPT — WMS + AI Assistant

Dokumen ini berisi prompt siap pakai untuk membuat presentasi capstone **WMS + AI Assistant** dengan gaya **simple, clean, light academic, dan sangat profesional**.

Gunakan bersama naskah `PRESENTASI-WMS-RAG.md`.

- **Jumlah slide:** 11
- **Rasio:** 16:9
- **Durasi:** 10 menit
- **Audiens:** dosen penguji dan peserta sidang
- **Gaya:** light academic + enterprise SaaS, bukan startup pitch yang ramai
- **Tool:** ChatGPT, Gamma, Canva, atau PowerPoint Designer

---

## Cara Pakai

1. Pilih salah satu prompt di bawah.
2. Ganti placeholder `[NAMA]`, `[NIM]`, `[INSTITUSI]`, dan `[PEMBIMBING]`.
3. Jika memakai Gamma atau Canva, gunakan **Compact Prompt**.
4. Jika memakai ChatGPT atau ingin kontrol penuh, gunakan **Master Prompt**.
5. Setelah deck jadi, tempel screenshot asli dan diagram dari `capstone/karil/figures/`.
6. Cek hasilnya dengan **Quality Checklist** di bagian akhir.

---

## 1. Master Prompt — Copy-Paste

Gunakan prompt ini untuk ChatGPT, Claude, atau tool presentasi yang menerima instruksi panjang.

```text
Anda adalah senior presentation designer dan strategic storyteller yang spesialis membuat deck sidang akademik dan demo produk teknologi. Tugas Anda membuat presentasi capstone yang simple, tenang, formal, dan sangat profesional.

KONTEKS PROYEK
Judul: Otomatisasi Warehouse Management System (WMS) dan Tata Kelola Dokumen Berbasis Web dengan Integrasi Asisten AI (RAG) pada Platform Pesan Instan.
Nama pendek: WMS + AI Assistant.
Inti: sistem manajemen gudang berbasis web untuk admin, dengan asisten AI berbasis RAG di Telegram untuk owner/manager UMKM distribusi fast-moving goods.
Lingkungan: empat layanan Docker, yaitu frontend React, backend Express + TypeScript, AI Agent LangChain + Telegraf, dan PostgreSQL + pgvector.

TUGAS
Buat deck presentasi 11 slide, rasio 16:9, untuk sidang capstone berdurasi 10 menit. Deck harus bisa dipahami oleh dosen penguji non-teknis dan tetap kredibel bagi penguji teknis.

AUDIENS DAN TUJUAN
Audiens: dosen penguji, pembimbing, dan peserta sidang.
Tujuan: dalam 10 menit, audiens memahami (1) masalah nyata di UMKM, (2) solusi WMS + AI, (3) cara kerja dan batas keamanannya, (4) bukti pengujian, dan (5) batasan serta rencana lanjutan.
Nada: yakin, jujur, tidak berlebihan, tidak salesy. Hindari klaim dampak yang belum diukur.

PRINSIP DESAIN
- Gaya: light academic + enterprise SaaS. Bersih, lapang, presisi, seperti laporan konsultan, bukan pitch deck startup.
- Satu slide, satu pesan. Jangan memadatkan dua ide besar dalam satu slide.
- Maksimal 6 bullet per slide. Setiap bullet maksimal 12 kata.
- Banyak ruang kosong. Margin kiri-kanan minimal 0,6 inci.
- Judul besar dan tegas. Body ringkas. Angka penting boleh menjadi hero.
- Gunakan diagram dan screenshot asli. Jangan memakai foto stok, robot, otak AI, sirkuit, atau ilustrasi 3D generik.
- Tidak ada gradien ramai, bayangan tebal, sudut miring, atau animasi berlebihan.
- Konsisten: posisi judul, margin, ukuran kartu, dan gaya ikon harus sama di semua slide.

SISTEM VISUAL
- Kanvas: 13,333 × 7,5 inci (16:9).
- Latar: #F7F8FA. Permukaan kartu: #FFFFFF.
- Teks utama: #0B1220. Teks sekunder: #475569. Teks muted: #94A3B8.
- Aksen utama: #0E7490 (teal). Aksen pendukung: #34D399 (emerald) dan #FBBF24 (amber).
- Garis dan border: #E2E8F0.
- Font judul: Plus Jakarta Sans Bold atau Inter Bold. Font body: Inter Regular. Fallback: Arial.
- Ukuran judul: 32–38 pt. Subjudul: 18–20 pt. Body: 16–18 pt. Caption: 10–12 pt. Angka hero: 56–72 pt.
- Ikon: line icon 1,5–2 px, sudut membulat, satu keluarga ikon. Jangan campur ikon filled dan outline.
- Grafik: tanpa 3D, tanpa gridline berlebihan, label langsung di dekat data, satu warna aksen per grafik.
- Kontras teks minimal 4,5:1. Jangan memakai teks abu muda di atas putih.

NARASI
Alur: masalah → solusi → produk → arsitektur → kepercayaan → bukti → keunggulan → penutup.
Jangan mulai dengan arsitektur. Mulai dengan manusia dan masalah. Teknis sedetail mungkin, tetapi selalu dikaitkan dengan keputusan atau risiko bisnis.

BRIEF PER SLIDE
Gunakan teks di bawah sebagai acuan. Anda boleh meringkas jika kepadatan berlebih, tetapi jangan mengubah angka, makna, atau status pengujian.

SLIDE 1 — COVER
Eyebrow: CAPSTONE PROJECT 2026
Judul: WMS + AI Assistant
Subjudul: Satu data. Dua cara kerja.
Deskripsi: Sistem manajemen gudang berbasis web dengan asisten AI RAG melalui Telegram untuk UMKM distribusi fast-moving goods.
Footer: [NAMA] · [NIM] · [INSTITUSI] · [PROGRAM STUDI] · Pembimbing: [NAMA PEMBIMBING]
Visual: layout editorial bersih, garis teal tipis, potongan screenshot dashboard di sisi kanan. Tanpa foto stok.

SLIDE 2 — MASALAH
Judul: Pencatatan masih tersebar. Keputusan jadi terlambat.
Tiga angka hero:
- 35,6 jam — median beban administratif per bulan.
- 6,3 menit — median waktu mengecek sisa satu produk.
- 2,75% — median selisih stok saat stock opname.
Tiga poin:
- 7 dari 10 UMKM masih memakai buku tulis, spreadsheet, atau grup chat.
- Data tidak real-time, dokumen manual, dan laporan sulit ditelusuri.
- ERP terasa terlalu rumit; adopsi teknologi rendah.
Catatan sumber: Survei 10 pelaku usaha, 29 Oktober 2026. Angka adalah baseline, bukan hasil implementasi.
Visual: tiga angka besar dalam satu baris, label kecil, ikon garis sederhana. Jangan menambah kartu yang tidak perlu.

SLIDE 3 — SOLUSI
Judul: Satu sistem. Dua antarmuka.
Kiri: WMS Web — untuk Admin dan Super Admin. Master data, transaksi stok, Purchase Order, Surat Jalan, laporan, knowledge base.
Kanan: AI Assistant — untuk Owner dan Manager. Telegram. Cek stok, rekap pengiriman, draft PO, draft Surat Jalan, tanya SOP.
Bawah: Backend + PostgreSQL — satu sumber kebenaran data. AI tidak menulis langsung ke tabel bisnis.
Tagline: Admin tetap punya kontrol. Owner cukup bertanya.
Visual: split 50:50, kartu browser di kiri, mockup ponsel dengan bubble chat di kanan, strip navy di bawah.

SLIDE 4 — FITUR WMS
Judul: Operasional gudang dalam satu dashboard.
Enam kartu:
1. Dashboard dan stok multi-gudang — ringkasan stok, transaksi terbaru, stok kritis.
2. Barang masuk dan keluar — stok dihitung otomatis dan atomik.
3. Purchase Order — DRAFT → CONFIRMED → COMPLETED / CANCELLED.
4. Surat Jalan — pengiriman ke customer, edit saat DRAFT, cetak.
5. Laporan enam tab — ringkasan, persediaan, pembelian, pengiriman, mutasi, analitik.
6. RBAC, audit log, knowledge base — tiga peran dan jejak perubahan.
Strip metrik: 13 modul backend · 17 model data · 15 halaman · 6 tab laporan.
Visual: grid 2 × 3, thumbnail screenshot kecil, angka metrik di bawah.

SLIDE 5 — ASISTEN AI
Judul: 18 tools. Satu percakapan.
Tiga contoh chat:
- Owner: "Berapa sisa stok Dimsum Ayam ukuran sedang?" AI: "Stok Dimsum Ayam Ukuran Sedang 120 pack."
- Owner: "Buat PO untuk CV Sumber Frozen, 50 pack Dimsum." AI: "Draft PO-202609-002 dibuat. Status DRAFT. Admin sudah dinotifikasi."
- Owner: "Apa SOP penerimaan barang retur?" AI: "[Jawaban dari knowledge base] · Sumber: SOP Penerimaan Barang Retur."
Kelompok tool: baca data · tulis terbatas · RAG.
Strip: 18 AI tools · maksimal 8 langkah · temperature 0.
Catatan kecil: "120 pack" adalah contoh ilustrasi.
Visual: mockup Telegram di kiri, tiga kartu kelompok tool di kanan, badge 18 TOOLS.

SLIDE 6 — ARSITEKTUR
Judul: Backend memegang kebenaran data.
Empat layanan: Frontend · Backend · AI Agent · PostgreSQL + pgvector.
Tiga prinsip:
- Backend adalah satu-satunya penulis data bisnis.
- AI Agent membaca data lewat API internal dan hanya punya akses baca ke document_chunks.
- Frontend dipakai admin dan super admin; Telegram dipakai owner.
Strip: Kunci internal · RBAC tiga peran · audit log · least privilege.
Visual: diagram arsitektur full-width. Gunakan diagram sederhana: Owner → Telegram → AI Agent → Backend → PostgreSQL; Admin/Super Admin → Frontend → Backend. Beri panah putus-putus untuk akses baca AI ke document_chunks. Jangan menaruh teks di atas garis.

SLIDE 7 — RAG DAN ANTI-HALUSINASI
Judul: Jawaban dibumikan, bukan ditebak.
Pipeline: knowledge_documents → potong teks → embedding 1536 dimensi → pgvector + full-text search → hybrid retrieval (RRF) → ambang skor 0,3 → jawaban + sumber.
Tiga guardrail:
- Data transaksional dibaca live lewat API, tidak di-embed.
- RAG hanya untuk SOP, kebijakan, runbook, dan FAQ.
- Jika konteks tidak relevan, AI mengatakan tidak menemukan SOP, bukan mengarang.
Strip: 18 tools · hybrid retrieval · ambang skor · sumber jawaban.
Visual: pipeline lima langkah di kiri, tiga kartu guardrail di kanan. Sorot "ambang skor 0,3" dan "jawaban + sumber".

SLIDE 8 — DEMO
Judul: Dari chat ke dokumen. Dari dokumen ke keputusan.
Badge: LIVE DEMO
Lima langkah:
1. Login admin → dashboard.
2. Catat barang masuk → stok berubah.
3. Owner cek stok lewat Telegram.
4. Owner minta draft PO → admin dapat notifikasi → konfirmasi → terima barang.
5. Owner tanya SOP → jawaban + sumber.
Catatan: Fallback ke video atau screenshot jika koneksi bermasalah.
Visual: timeline horizontal lima langkah, tiga thumbnail screenshot, badge LIVE kecil. Jangan menampilkan terlalu banyak teks.

SLIDE 9 — BUKTI PENGUJIAN
Judul: Apa yang sudah terbukti, apa yang belum.
Tiga angka:
- 117 / 117 — tes unit dan komponen lulus · 17 berkas.
- 79 — tes integrasi belum dijalankan · memerlukan PostgreSQL.
- 22 — skenario penerimaan dipetakan · 10 bukti unit · 9 menunggu · 3 belum diuji.
Status: Lint dan typecheck tiga layanan lulus.
Batasan: Kelayakan logika terbukti terbatas. Kelayakan integrasi penuh dan dampak operasional belum.
Visual: tiga kolom angka besar, warna teal untuk 117, amber untuk 79, navy untuk 22. Satu kalimat batasan di bawah.

SLIDE 10 — KEUNGGULAN DAN TARGET
Judul: Mengapa pendekatan ini berbeda.
Lima keunggulan:
1. Chat-first — kurva pembelajaran mendekati nol.
2. Single source of truth — backend satu-satunya penulis data.
3. Draft-only AI — manusia tetap mengonfirmasi dokumen.
4. RAG yang bisa ditelusuri — jawaban menyebut sumber.
5. Self-hosted — empat layanan dalam Docker Compose.
Strip target: Target pilot: <10 detik info stok · ≤1% selisih stok · <1 menit draft PO.
Catatan: Target, bukan hasil yang sudah terukur.
Visual: lima baris bernomor, strip navy di bawah, label "TARGET PILOT". Jangan menampilkan lebih dari lima keunggulan.

SLIDE 11 — PENUTUP
Judul: Data benar. Bahasa manusiawi.
Tiga langkah berikutnya:
1. Menjalankan 79 tes integrasi dan uji end-to-end.
2. Pilot 4–8 minggu pada satu atau dua UMKM.
3. Menambahkan WhatsApp dan mengukur kualitas RAG.
Footer: Terima kasih. [NAMA] · [EMAIL] · [LINK DEMO / QR].
Visual: latar navy #0B1220, teks putih, aksen teal. Kalimat utama besar di tengah. QR hanya jika link aktif.

DATA YANG BOLEH DIPAKAI
- Survei 10 pelaku usaha, 29 Oktober 2026.
- Median beban administratif 35,6 jam per bulan.
- Median waktu cek stok 6,3 menit.
- Median selisih stok 2,75%.
- 7 dari 10 UMKM masih manual atau semi-manual.
- 9 dari 10 responden memilih WhatsApp; 1 memilih Telegram.
- 6 dari 10 responden bersedia mencoba asisten chat.
- 4 layanan, 13 modul backend, 17 model data, 15 halaman frontend.
- 18 AI tools, 6 tab laporan.
- 117 tes unit dan komponen lulus dari 17 berkas.
- 79 tes integrasi belum dijalankan.
- 22 skenario penerimaan: 10 bukti unit, 9 menunggu integrasi, 3 belum diuji.
- Lint dan typecheck tiga layanan lulus.

BATASAN DATA
- Jangan mengarang angka, persentase, waktu, atau hasil pengukuran baru.
- Jangan menulis "berhasil menurunkan", "mencapai target", atau "terbukti meningkatkan" karena KPI belum terukur.
- Angka 35,6 / 6,3 / 2,75 adalah baseline survei, bukan hasil implementasi.
- Angka 117 / 79 / 22 adalah status pengujian, bukan bukti kelulusan penuh.
- Jika data belum ada, tulis "belum diukur" atau "belum diuji".
- Jangan menyembunyikan keterbatasan. Keterbatasan adalah bagian dari kredibilitas.

ATURAN LAYOUT
- Judul slide di posisi yang sama di semua slide.
- Satu pesan utama per slide; jika ada dua pesan, pecah menjadi dua slide.
- Jangan memakai lebih dari dua ukuran font besar dalam satu slide.
- Jangan menaruh teks di atas gambar yang sibuk.
- Jangan memakai bullet lebih dari enam.
- Jangan memakai tabel lebih dari lima baris; pindahkan detail ke lampiran atau Q&A.
- Jangan memakai animasi selain fade atau appear sederhana.
- Jangan memakai emoji sebagai ikon.
- Jangan memakai QR code jika link belum aktif.

OUTPUT
Jika tool dapat langsung membuat deck:
- Hasilkan 11 slide 16:9 dengan urutan di atas.
- Sertakan speaker notes singkat di setiap slide.
- Gunakan placeholder screenshot berlabel [SS-01] sampai [SS-07].
- Beri nama file: WMS-AI-Assistant-Capstone.pptx.

Jika tool hanya menghasilkan teks:
- Keluarkan tabel dengan kolom: Slide, Judul, Copy di layar, Arahan visual, Speaker notes.
- Jangan menambahkan slide di luar 11 slide.
- Jangan menambahkan lorem ipsum.

CHECKLIST SEBELUM SELESAI
- Apakah setiap slide hanya memiliki satu pesan?
- Apakah angka baseline dan target dibedakan dengan jelas?
- Apakah tidak ada klaim dampak yang belum diukur?
- Apakah teks body minimal 16 pt dan terbaca dari jarak proyektor?
- Apakah kontras teks memenuhi 4,5:1?
- Apakah semua diagram dan screenshot punya label?
- Apakah tidak ada foto robot, otak AI, atau ilustrasi generik?
- Apakah judul, margin, dan gaya kartu konsisten?
- Apakah deck terasa tenang dan profesional, bukan ramai?
```

---

## 2. Compact Prompt — Gamma / Canva

Gunakan versi ini jika tool membatasi panjang prompt.

```text
Buat presentasi 11 slide 16:9, bahasa Indonesia, gaya light academic yang bersih dan sangat profesional untuk sidang capstone. Latar #F7F8FA, teks navy #0B1220, aksen teal #0E7490, font Plus Jakarta Sans/Inter, banyak ruang kosong, maksimal 6 bullet per slide, tanpa foto stok/robot/otak AI.

Proyek: WMS + AI Assistant, sistem manajemen gudang berbasis web dengan asisten AI RAG di Telegram untuk UMKM distribusi fast-moving goods. Admin memakai dashboard web; owner cukup bertanya lewat chat.

Alur slide:
1. Cover: "WMS + AI Assistant" / "Satu data. Dua cara kerja."
2. Masalah: pencatatan tersebar. Angka baseline: 35,6 jam/bulan beban administratif, 6,3 menit cek stok, 2,75% selisih stok. 7/10 UMKM masih manual.
3. Solusi: satu sistem, dua antarmuka. WMS web untuk admin; AI Telegram untuk owner. Backend + PostgreSQL sebagai sumber kebenaran.
4. Fitur WMS: dashboard stok multi-gudang, transaksi masuk/keluar, PO, surat jalan, laporan 6 tab, RBAC/audit log.
5. Asisten AI: 18 tools. Contoh chat cek stok, buat draft PO, tanya SOP. Tool tulis hanya membuat draft.
6. Arsitektur: 4 layanan (frontend, backend, AI agent, PostgreSQL+pgvector). Backend satu-satunya penulis data; AI read-only.
7. RAG: knowledge_documents → chunk → embedding → pgvector → hybrid retrieval → ambang skor 0,3 → jawaban + sumber. Anti-halusinasi.
8. Demo: login → transaksi masuk → cek stok via Telegram → draft PO → notifikasi admin → konfirmasi → tanya SOP.
9. Bukti: 117 tes unit lulus, 79 tes integrasi belum dijalankan, 22 skenario penerimaan dipetakan. Jujur pada keterbatasan.
10. Keunggulan: chat-first, single source of truth, draft-only AI, RAG bertrace, self-hosted. Target pilot: <10 detik, ≤1%, <1 menit.
11. Penutup: "Data benar. Bahasa manusiawi." + 3 langkah lanjutan.

Aturan: jangan mengarang angka; bedakan baseline vs target; jangan klaim dampak yang belum diukur; gunakan diagram sederhana dan placeholder screenshot; tanpa emoji; tanpa animasi ramai.
```

---

## 3. Copy Deck Ringkas

Gunakan bagian ini jika ingin menempel teks secara manual ke Canva/PowerPoint.

### Slide 1 — Cover

```text
CAPSTONE PROJECT 2026

WMS + AI Assistant
Satu data. Dua cara kerja.

Sistem manajemen gudang berbasis web dengan asisten AI RAG
melalui Telegram untuk UMKM distribusi fast-moving goods.

[NAMA] · [NIM]
[INSTITUSI] · [PROGRAM STUDI]
Pembimbing: [NAMA PEMBIMBING]
```

### Slide 2 — Masalah

```text
Pencatatan masih tersebar. Keputusan jadi terlambat.

35,6 jam
Median beban administratif per bulan

6,3 menit
Median waktu mengecek sisa satu produk

2,75%
Median selisih stok saat stock opname

• 7 dari 10 UMKM masih memakai buku tulis, spreadsheet, atau grup chat.
• Data tidak real-time, dokumen manual, dan laporan sulit ditelusuri.
• ERP terasa terlalu rumit; adopsi teknologi rendah.

Sumber: survei 10 pelaku usaha, 29 Oktober 2026.
Angka adalah baseline, bukan hasil implementasi.
```

### Slide 3 — Solusi

```text
Satu sistem. Dua antarmuka.

WMS Web — Admin & Super Admin
Master data, transaksi stok, Purchase Order, Surat Jalan,
laporan, knowledge base.

AI Assistant — Owner & Manager
Telegram. Cek stok, rekap pengiriman, draft PO,
draft Surat Jalan, tanya SOP.

Backend + PostgreSQL
Satu sumber kebenaran data. AI tidak menulis langsung ke tabel bisnis.

Admin tetap punya kontrol. Owner cukup bertanya.
```

### Slide 4 — Fitur WMS

```text
Operasional gudang dalam satu dashboard.

1. Dashboard dan stok multi-gudang
2. Barang masuk dan keluar — stok dihitung otomatis
3. Purchase Order — DRAFT → CONFIRMED → COMPLETED / CANCELLED
4. Surat Jalan — edit saat DRAFT, cetak
5. Laporan enam tab — ringkasan, persediaan, pembelian,
   pengiriman, mutasi, analitik
6. RBAC, audit log, knowledge base

13 modul backend · 17 model data · 15 halaman · 6 tab laporan
```

### Slide 5 — Asisten AI

```text
18 tools. Satu percakapan.

“Berapa sisa stok Dimsum Ayam ukuran sedang?”
“Stok Dimsum Ayam Ukuran Sedang 120 pack.”

“Buat PO untuk CV Sumber Frozen, 50 pack Dimsum.”
“Draft PO-202609-002 dibuat. Status DRAFT.
Admin sudah dinotifikasi.”

“Apa SOP penerimaan barang retur?”
“[Jawaban knowledge base] · Sumber: SOP Penerimaan Barang Retur.”

Baca data · Tulis terbatas · RAG

18 AI tools · maksimal 8 langkah · temperature 0

Contoh percakapan ilustratif; angka pada mockup bukan hasil pengukuran.
```

### Slide 6 — Arsitektur

```text
Backend memegang kebenaran data.

Frontend · Backend · AI Agent · PostgreSQL + pgvector

• Backend adalah satu-satunya penulis data bisnis.
• AI Agent membaca lewat API internal dan hanya punya
  akses baca ke document_chunks.
• Frontend untuk admin dan super admin; Telegram untuk owner.

Kunci internal · RBAC tiga peran · audit log · least privilege
```

### Slide 7 — RAG

```text
Jawaban dibumikan, bukan ditebak.

knowledge_documents
→ potong teks
→ embedding 1536 dimensi
→ pgvector + full-text search
→ hybrid retrieval (RRF)
→ ambang skor 0,3
→ jawaban + sumber

• Data transaksional dibaca live lewat API, tidak di-embed.
• RAG hanya untuk SOP, kebijakan, runbook, dan FAQ.
• Jika konteks tidak relevan, AI mengatakan tidak menemukan SOP.

18 tools · hybrid retrieval · ambang skor · sumber jawaban
```

### Slide 8 — Demo

```text
Dari chat ke dokumen. Dari dokumen ke keputusan.

LIVE DEMO

1. Login admin → dashboard.
2. Catat barang masuk → stok berubah.
3. Owner cek stok lewat Telegram.
4. Owner minta draft PO → admin dapat notifikasi
   → konfirmasi → terima barang.
5. Owner tanya SOP → jawaban + sumber.

Fallback: video atau screenshot jika koneksi bermasalah.
```

### Slide 9 — Bukti

```text
Apa yang sudah terbukti, apa yang belum.

117 / 117
Tes unit dan komponen lulus · 17 berkas

79
Tes integrasi belum dijalankan · memerlukan PostgreSQL

22
Skenario penerimaan dipetakan · 10 bukti unit ·
9 menunggu · 3 belum diuji

Lint dan typecheck tiga layanan lulus.

Kelayakan logika terbukti terbatas.
Kelayakan integrasi penuh dan dampak operasional belum.
```

### Slide 10 — Keunggulan

```text
Mengapa pendekatan ini berbeda.

1. Chat-first — kurva pembelajaran mendekati nol.
2. Single source of truth — backend satu-satunya penulis data.
3. Draft-only AI — manusia tetap mengonfirmasi dokumen.
4. RAG yang bisa ditelusuri — jawaban menyebut sumber.
5. Self-hosted — empat layanan dalam Docker Compose.

TARGET PILOT
<10 detik info stok · ≤1% selisih stok · <1 menit draft PO

Target, bukan hasil yang sudah terukur.
```

### Slide 11 — Penutup

```text
Data benar. Bahasa manusiawi.

Langkah berikutnya:
1. Menjalankan 79 tes integrasi dan uji end-to-end.
2. Pilot 4–8 minggu pada satu atau dua UMKM.
3. Menambahkan WhatsApp dan mengukur kualitas RAG.

Terima kasih.
[NAMA] · [EMAIL] · [LINK DEMO / QR]
```

---

## 4. Design Tokens

| Elemen | Nilai | Catatan |
| :--- | :--- | :--- |
| Rasio | 16:9 | 13,333 × 7,5 inci |
| Background | `#F7F8FA` | Abu sangat terang, bukan putih murni |
| Surface | `#FFFFFF` | Kartu dan panel |
| Text primary | `#0B1220` | Navy hampir hitam |
| Text secondary | `#475569` | Untuk penjelasan |
| Text muted | `#94A3B8` | Untuk caption dan sumber |
| Accent | `#0E7490` | Teal utama |
| Accent 2 | `#34D399` | Emerald untuk status positif |
| Warning | `#FBBF24` | Amber untuk risiko atau target |
| Border | `#E2E8F0` | Garis kartu |
| Heading font | Plus Jakarta Sans Bold | Fallback Arial Bold |
| Body font | Inter Regular | Fallback Arial |
| Title size | 32–38 pt | Konsisten di semua slide |
| Body size | 16–18 pt | Minimum 16 pt |
| Caption size | 10–12 pt | Sumber dan catatan |
| Hero number | 56–72 pt | Untuk 35,6 / 117 / 79 / 22 |
| Margin | 0,6 inci | Kiri, kanan, atas, bawah |
| Grid | 12 kolom | Gap 0,25 inci |
| Icon | Line icon 1,5–2 px | Satu keluarga ikon |
| Animation | Fade / appear | Tanpa bounce atau zoom |

---

## 5. Negative Prompt

Tempel bagian ini jika tool mendukung negative prompt atau “hindari”.

```text
Hindari:
- latar gelap, neon, cyberpunk, atau gradient mesh;
- robot, otak AI, sirkuit, hologram, atau ilustrasi 3D generik;
- foto stok orang berjabat tangan, tim rapat, atau gudang generik;
- dashboard palsu dengan angka karangan;
- lebih dari 6 bullet per slide;
- teks di bawah 14 pt;
- paragraf panjang di dalam slide;
- tabel lebih dari 5 baris;
- emoji sebagai ikon;
- warna aksen lebih dari tiga;
- bayangan tebal, sudut miring, atau animasi berlebihan;
- klaim “berhasil menurunkan”, “mencapai target”, atau “terbukti meningkatkan”;
- angka yang tidak ada di brief;
- lorem ipsum;
- QR code tanpa link aktif.
```

---

## 6. Prompt Revisi

Gunakan jika hasil generate belum sesuai.

### Terlalu ramai

```text
Rapikan deck ini. Kurangi setiap slide menjadi maksimal 3 poin utama.
Perbesar whitespace, hilangkan kartu yang tidak perlu, dan pastikan
hanya ada satu pesan per slide. Pertahankan warna, font, dan angka.
```

### Terlalu gelap atau terlalu “startup pitch”

```text
Ubah menjadi gaya light academic: latar #F7F8FA, teks navy #0B1220,
aksen teal #0E7490. Hilangkan gradien, glow, dan ilustrasi 3D.
Buat terasa seperti deck konsultan yang tenang dan formal.
```

### Teks kepotong atau terlalu kecil

```text
Perbaiki hierarki teks. Judul maksimal 2 baris, body minimal 16 pt,
caption minimal 10 pt. Jangan mengecilkan font untuk memuat teks;
ringkas teksnya. Pastikan margin 0,6 inci di semua sisi.
```

### Terlalu generik

```text
Hapus ilustrasi AI generik. Gunakan diagram arsitektur sederhana,
mockup chat Telegram, dan placeholder screenshot aplikasi.
Gaya harus terasa seperti produk nyata, bukan konsep abstrak.
```

### Angka tidak konsisten

```text
Ganti semua angka dengan data berikut dan jangan menambah angka lain:
35,6 jam/bulan; 6,3 menit; 2,75%; 117 tes unit lulus; 79 tes integrasi
belum dijalankan; 22 skenario penerimaan; 13 modul; 17 model;
15 halaman; 18 tools; 6 tab laporan.
Beri label baseline untuk 35,6 / 6,3 / 2,75 dan label target untuk
<10 detik / ≤1% / <1 menit.
```

### Slide terlalu padat

```text
Pecah slide yang terlalu padat menjadi dua slide, atau pindahkan detail
ke speaker notes. Deck utama harus tetap 11 slide; gunakan lampiran
terpisah jika detail benar-benar diperlukan.
```

---

## 7. Tool-Specific Tips

### ChatGPT

1. Tempel **Master Prompt**.
2. Minta output dalam tabel per slide terlebih dahulu.
3. Setelah setuju, minta versi naratif untuk speaker notes.
4. Gunakan hasilnya untuk mengisi PowerPoint atau Canva.
5. Jangan minta ChatGPT mengarang screenshot; gunakan aset asli.

### Gamma

1. Pilih **Create from prompt**.
2. Tempel **Compact Prompt**.
3. Pilih tema **Light / Minimal / Professional**.
4. Set rasio 16:9.
5. Setelah generate, ganti gambar generik dengan screenshot asli.
6. Rapikan margin dan ukuran font secara manual.

### Canva

1. Gunakan **Magic Design** dengan **Compact Prompt**.
2. Pilih template minimalis dengan banyak whitespace.
3. Terapkan design token: `#F7F8FA`, `#0B1220`, `#0E7490`.
4. Ganti font ke Plus Jakarta Sans atau Inter.
5. Tambahkan diagram dan screenshot secara manual.
6. Gunakan **Presenter Notes** untuk naskah.

### PowerPoint

1. Gunakan **Master Prompt** untuk menghasilkan copy deck.
2. Buat slide master dengan background `#F7F8FA` dan judul navy.
3. Gunakan **Designer** untuk saran layout, tetapi tetap kunci margin.
4. Simpan sebagai `.pptx` dan `.pdf`.
5. Cek font substitution di komputer presentasi.

---

## 8. Asset Placement

| Slide | Aset | Catatan |
| :---: | :--- | :--- |
| 01 | `[SS-01]` dashboard | Potongan kecil di kanan, jangan fullscreen |
| 02 | Tidak ada | Fokus pada tiga angka |
| 03 | `[SS-01]`, `[SS-06]` | Kartu browser dan mockup ponsel |
| 04 | `[SS-01]`–`[SS-05]` | Thumbnail di kartu |
| 05 | `[SS-06]` | Tiga bubble chat |
| 06 | `gambar-2.png` | Diagram arsitektur full-width |
| 07 | `gambar-3.png` | Pipeline atau alur tool calling |
| 08 | `[SS-01]`, `[SS-06]`, `[SS-07]` | Thumbnail demo |
| 09 | Tidak ada | Tiga angka besar |
| 10 | Tidak ada | Lima baris keunggulan |
| 11 | QR / logo | Hanya jika link aktif |

---

## 9. Quality Checklist

- [ ] Deck tepat 11 slide, 16:9.
- [ ] Setiap slide hanya memiliki satu pesan utama.
- [ ] Maksimal 6 bullet per slide; body minimal 16 pt.
- [ ] Angka baseline diberi label “baseline”.
- [ ] Angka target diberi label “target pilot”.
- [ ] Tidak ada klaim dampak yang belum diukur.
- [ ] 117 / 79 / 22 sesuai laporan.
- [ ] Diagram arsitektur dan RAG terbaca.
- [ ] Tidak ada robot, otak AI, atau foto stok generik.
- [ ] Warna hanya navy, teal, emerald, amber, dan netral.
- [ ] Margin konsisten di semua slide.
- [ ] Tidak ada teks yang terpotong.
- [ ] Kontras teks memenuhi 4,5:1.
- [ ] Speaker notes tersedia.
- [ ] File `.pptx` dan `.pdf` sudah disimpan.
- [ ] Nama file: `WMS-AI-Assistant-Capstone.pptx`.

---

## 10. Kalimat Kunci yang Boleh Dipakai

Gunakan kalimat ini jika tool membutuhkan tagline atau ringkasan.

```text
Satu data. Dua cara kerja.
Admin di web. Owner di chat.
Data benar. Bahasa manusiawi.
Backend memegang kebenaran data. AI membantu memahami bahasa.
AI tidak menulis data bisnis; AI hanya membuat draft.
Angka dari database. SOP dari dokumen.
Kelayakan logika terbukti terbatas; integrasi penuh belum.
Target pilot, bukan klaim hasil.
```

---

## 11. Yang Tidak Boleh Dilakukan

- Jangan menulis “AI menggantikan admin”. AI hanya membantu; keputusan tetap di manusia.
- Jangan menulis “100% akurat”. KPI-4 belum diukur secara empiris.
- Jangan menulis “mengurangi 35,6 jam”. Itu baseline, bukan hasil.
- Jangan menulis “sudah dipakai UMKM”. Pilot belum dilakukan.
- Jangan menampilkan angka tanpa satuan atau sumber.
- Jangan menampilkan screenshot palsu yang dibuat AI.
- Jangan menyembunyikan 79 tes integrasi yang belum dijalankan.
- Jangan memakai Telegram dan WhatsApp secara bergantian tanpa penjelasan; MVP memakai Telegram, WhatsApp adalah rencana lanjutan.
