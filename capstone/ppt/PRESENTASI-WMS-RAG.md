# Naskah Presentasi — WMS + AI Assistant

**Judul proyek:** Otomatisasi Warehouse Management System (WMS) dan Tata Kelola Dokumen Berbasis Web dengan Integrasi Asisten AI (RAG) pada Platform Pesan Instan

**Durasi:** 10 menit  
**Jumlah slide:** 11  
**Gaya visual:** Light academic — bersih, tenang, formal, banyak ruang kosong  
**Audiens:** Dosen penguji dan peserta sidang capstone  
**Format:** Mengikuti `example.md` (`SLIDE`, `ACTOR`, `PPT`, `PRESENTASI`), dengan tambahan `VISUAL`, `DURASI`, dan `CUE`

---

## Cara Pakai

1. Ganti seluruh placeholder `[NAMA]`, `[NIM]`, `[INSTITUSI]`, dan `[PEMBIMBING]`.
2. Ganti penanda `[SS-01]` sampai `[SS-07]` dengan tangkapan layar asli.
3. Gunakan `gambar-2.png` dan `gambar-3.png` dari `capstone/karil/figures/` untuk slide arsitektur dan RAG.
4. Latih naskah per bagian, bukan per kata. Naskah ini ditulis untuk diucapkan, bukan dibacakan.
5. Sediakan cadangan demo berupa video atau screenshot. Jangan men-debug aplikasi saat presentasi.

---

## Alokasi Waktu

| Slide | Topik | Durasi | Kumulatif |
| :---: | :--- | ---: | ---: |
| 01 | Cover | 0:30 | 0:30 |
| 02 | Masalah | 0:50 | 1:20 |
| 03 | Solusi | 0:50 | 2:10 |
| 04 | Fitur WMS | 0:50 | 3:00 |
| 05 | Asisten AI | 1:10 | 4:10 |
| 06 | Arsitektur | 0:50 | 5:00 |
| 07 | RAG dan anti-halusinasi | 0:50 | 5:50 |
| 08 | Demo | 1:30 | 7:20 |
| 09 | Bukti pengujian | 0:50 | 8:10 |
| 10 | Keunggulan dan target | 0:50 | 9:00 |
| 11 | Penutup | 0:30 | 9:30 |

Sisa ±30 detik dipakai untuk transisi, jeda, dan perpindahan aplikasi.

---

## Pembagian Peran (Opsional)

Jika presentasi dilakukan berkelompok, gunakan pembagian berikut. Jika sendiri, ganti semua `ACTOR` menjadi `Presenter`.

| Actor | Bagian |
| :---: | :--- |
| A | Cover, masalah, solusi, penutup |
| B | Fitur WMS, demo aplikasi |
| C | Asisten AI, RAG, keunggulan |
| D | Arsitektur, pengujian, Q&A teknis |

---

## Peta Aset Visual

| Kode | Aset | Dipakai di |
| :--- | :--- | :--- |
| `[SS-01]` | Dashboard admin | Slide 04, 08 |
| `[SS-02]` | Form transaksi barang masuk/keluar | Slide 04, 08 |
| `[SS-03]` | Daftar dan detail Purchase Order | Slide 04, 08 |
| `[SS-04]` | Detail Surat Jalan dan cetak | Slide 04 |
| `[SS-05]` | Laporan enam tab | Slide 04 |
| `[SS-06]` | Percakapan Telegram: stok, draft PO, SOP | Slide 05, 08 |
| `[SS-07]` | Notifikasi Telegram ke admin | Slide 08 |
| `gambar-2.png` | Diagram arsitektur logis | Slide 06 |
| `gambar-3.png` | Diagram alur tool calling dan retrieval | Slide 07 |

---

# SLIDE 01 — COVER

- **ACTOR:** A
- **DURASI:** 30 detik

**PPT:**

> **CAPSTONE PROJECT 2026**
>
> # WMS + AI Assistant
>
> ### Satu data. Dua cara kerja.
>
> Sistem manajemen gudang berbasis web dengan asisten AI RAG melalui Telegram untuk UMKM distribusi *fast-moving goods*.
>
> [NAMA] · [NIM]  
> [INSTITUSI] · [PROGRAM STUDI]  
> Pembimbing: [NAMA PEMBIMBING]

**VISUAL:**

- Latar `#F7F8FA`, teks navy `#0B1220`.
- Garis tipis teal di atas judul.
- Sisi kanan: potongan screenshot dashboard yang dibingkai rapi, bukan foto stok.
- Tanpa logo robot, otak AI, atau ilustrasi 3D.
- Margin kiri-kanan minimal 0,6 inci.

**PRESENTASI:**

> Selamat pagi. Kami dari [INSTITUSI] akan mempresentasikan proyek capstone berjudul **WMS + AI Assistant**.
>
> Ide utamanya sederhana: admin gudang tetap bekerja di dashboard web, sementara owner cukup bertanya lewat Telegram. Satu data, dua cara kerja.
>
> Dalam sepuluh menit, kami akan menunjukkan masalahnya, solusinya, cara kerjanya, dan sejauh mana sistem ini sudah diuji.

**CUE:** Berdiri di sisi kiri layar. Tekan slide setelah kalimat “dua cara kerja”.

---

# SLIDE 02 — MASALAH

- **ACTOR:** A
- **DURASI:** 50 detik

**PPT:**

> # Pencatatan masih tersebar. Keputusan jadi terlambat.
>
> **35,6 jam**  
> Median beban administratif per bulan
>
> **6,3 menit**  
> Median waktu mengecek sisa satu produk
>
> **2,75%**  
> Median selisih stok saat *stock opname*
>
> - 7 dari 10 UMKM masih memakai buku tulis, spreadsheet, atau grup chat.
> - Data tidak *real-time*, dokumen manual, dan laporan sulit ditelusuri.
> - ERP terasa terlalu rumit; adopsi teknologi rendah.
>
> *Sumber: survei 10 pelaku usaha, 29 Oktober 2026. Angka adalah baseline, bukan hasil implementasi.*

**VISUAL:**

- Tiga angka besar dalam satu baris, masing-masing dengan label kecil.
- Gunakan angka sebagai fokus utama; jangan beri kotak berlebihan.
- Di bawah: tiga *pain point* dengan ikon garis sederhana.
- Catatan sumber 10–11 pt, warna `#64748B`.

**PRESENTASI:**

> Latar belakangnya berasal dari survei terhadap sepuluh pelaku usaha. Tujuh dari sepuluh masih mencatat stok di buku tulis, spreadsheet, atau grup chat.
>
> Dampaknya terlihat pada tiga angka. Median beban administratif mencapai **35,6 jam per bulan**. Untuk mengecek sisa satu produk saja, median-nya **6,3 menit**. Dan saat *stock opname*, median selisih stok mencapai **2,75 persen**.
>
> Masalah utamanya bukan sekadar alat. Sistem yang ada terasa terlalu rumit, sehingga ditinggalkan. Di sisi lain, pemilik usaha sudah nyaman dengan chat.

**CUE:** Tekankan angka dengan tangan, bukan dengan membaca ulang. Jeda satu detik setelah “2,75 persen”.

---

# SLIDE 03 — SOLUSI

- **ACTOR:** A
- **DURASI:** 50 detik

**PPT:**

> # Satu sistem. Dua antarmuka.
>
> **WMS Web** — untuk Admin dan Super Admin  
> Master data, transaksi stok, Purchase Order, Surat Jalan, laporan, knowledge base.
>
> **AI Assistant** — untuk Owner dan Manager  
> Telegram. Cek stok, rekap pengiriman, draft PO, draft Surat Jalan, tanya SOP.
>
> **Backend + PostgreSQL**  
> Satu sumber kebenaran data. AI tidak menulis langsung ke tabel bisnis.
>
> *Admin tetap punya kontrol. Owner cukup bertanya.*

**VISUAL:**

- Layout split 50:50.
- Kiri: kartu browser dengan screenshot dashboard.
- Kanan: mockup ponsel dengan tiga bubble chat Telegram.
- Tengah: garis vertikal tipis atau panah dua arah.
- Bawah: strip navy berisi kalimat “Backend = satu-satunya penulis data bisnis”.

**PRESENTASI:**

> Solusinya kami bagi menjadi dua antarmuka sesuai peran.
>
> Admin dan Super Admin memakai **WMS web** untuk mengelola data master, transaksi, Purchase Order, Surat Jalan, dan laporan.
>
> Owner dan Manager memakai **asisten AI di Telegram**. Mereka bisa bertanya stok, meminta rekap pengiriman, membuat draft dokumen, atau bertanya SOP.
>
> Keduanya terhubung ke satu backend dan satu database. Ini penting: AI tidak pernah menulis langsung ke tabel bisnis. Keputusan akhir tetap di tangan admin.

**CUE:** Gerakkan tangan dari kiri ke kanan saat menyebut “dua antarmuka”, lalu ke bawah saat menyebut “satu backend”.

---

# SLIDE 04 — FITUR WMS

- **ACTOR:** B
- **DURASI:** 50 detik

**PPT:**

> # Operasional gudang dalam satu dashboard.
>
> 1. **Dashboard dan stok multi-gudang** — ringkasan stok, transaksi terbaru, stok kritis.
> 2. **Barang masuk dan keluar** — stok dihitung otomatis dan atomik.
> 3. **Purchase Order** — `DRAFT → CONFIRMED → COMPLETED / CANCELLED`.
> 4. **Surat Jalan** — pengiriman ke customer, edit saat DRAFT, cetak.
> 5. **Laporan enam tab** — ringkasan, persediaan, pembelian, pengiriman, mutasi, analitik.
> 6. **RBAC, audit log, knowledge base** — tiga peran dan jejak perubahan.
>
> **13 modul backend · 17 model data · 15 halaman · 6 tab laporan**

**VISUAL:**

- Grid 2 × 3 kartu. Setiap kartu: nomor, judul, satu kalimat.
- Gunakan `[SS-01]` sampai `[SS-05]` sebagai thumbnail kecil di kartu terkait.
- Angka ringkasan di bagian bawah dengan warna teal.
- Jangan tampilkan lebih dari enam kartu.

**PRESENTASI:**

> Dari sisi WMS, ada enam kemampuan utama.
>
> Pertama, dashboard dan stok multi-gudang. Kedua, transaksi masuk dan keluar yang stoknya dihitung otomatis. Ketiga, Purchase Order dengan alur status yang jelas. Keempat, Surat Jalan yang bisa dicetak. Kelima, laporan enam tab, dari persediaan sampai analitik. Dan keenam, kontrol akses, audit log, serta knowledge base.
>
> Secara ukuran, ini mencakup **13 modul backend, 17 model data, 15 halaman, dan 6 tab laporan**.
>
> Satu hal yang perlu ditekankan: stok bukan diisi manual. Stok adalah konsekuensi dari transaksi yang tercatat.

**CUE:** Setelah “enam kemampuan utama”, sebutkan dengan tempo cepat; jangan berhenti di setiap kartu.

---

# SLIDE 05 — ASISTEN AI

- **ACTOR:** C
- **DURASI:** 1 menit 10 detik

**PPT:**

> # 18 tools. Satu percakapan.
>
> **Contoh percakapan**
>
> > Owner: “Berapa sisa stok Dimsum Ayam ukuran sedang?”  
> > AI: “Stok Dimsum Ayam Ukuran Sedang 120 pack.”
>
> > Owner: “Buat PO untuk CV Sumber Frozen, 50 pack Dimsum.”  
> > AI: “Draft PO-202609-002 dibuat. Status DRAFT. Admin sudah dinotifikasi.”
>
> > Owner: “Apa SOP penerimaan barang retur?”  
> > AI: “[Jawaban dari knowledge base] · Sumber: SOP Penerimaan Barang Retur.”
>
> **Kelompok tool:** baca data · tulis terbatas · RAG
>
> **18 AI tools · maksimal 8 langkah · temperature 0**
>
> *Contoh percakapan ilustratif; angka pada mockup bukan hasil pengukuran.*

**VISUAL:**

- Kiri: mockup ponsel Telegram dengan tiga bubble chat.
- Kanan: tiga kelompok tool dalam kartu vertikal.
- Badge `18 TOOLS` di pojok kanan atas.
- Angka “120 pack” diberi label kecil “contoh ilustrasi”.
- Gunakan `[SS-06]` jika screenshot asli tersedia.

**PRESENTASI:**

> Bagian yang paling membedakan proyek ini adalah asisten AI-nya.
>
> Ada **18 tools** yang dibagi menjadi tiga kelompok. Pertama, tool baca: stok, katalog, transaksi, PO, Surat Jalan, dan ringkasan. Kedua, tool tulis terbatas: hanya membuat draft PO dan draft Surat Jalan. Ketiga, tool RAG untuk mencari SOP dan kebijakan.
>
> Perhatikan contoh kedua. Saat owner meminta PO, AI tidak langsung mengubah data. Ia hanya membuat **draft** berstatus DRAFT, lalu admin menerima notifikasi dan mengonfirmasi di web.
>
> Agen juga dibatasi maksimal delapan langkah dan memakai *temperature* nol. Jika nama produk ambigu, AI menampilkan kandidat dan meminta klarifikasi, bukan menebak.

**CUE:** Tunjuk bubble chat kedua saat menyebut “draft”. Tekankan kata “draft” dan “admin yang mengonfirmasi”.

---

# SLIDE 06 — ARSITEKTUR

- **ACTOR:** D
- **DURASI:** 50 detik

**PPT:**

> # Backend memegang kebenaran data.
>
> **4 layanan:** Frontend · Backend · AI Agent · PostgreSQL + pgvector
>
> - **Backend** adalah satu-satunya penulis data bisnis.
> - **AI Agent** membaca data lewat API internal dan hanya punya akses baca ke `document_chunks`.
> - **Frontend** dipakai admin dan super admin; **Telegram** dipakai owner.
>
> **Kunci internal · RBAC tiga peran · audit log · least privilege**

**VISUAL:**

- Gunakan `gambar-2.png` (`capstone/karil/figures/gambar-2.png`) full-width.
- Beri judul di atas diagram, bukan menimpa diagram.
- Tiga chip prinsip di bawah diagram: “Single writer”, “Read-only AI”, “Human confirmation”.
- Pastikan teks diagram tetap terbaca; jangan diperkecil di bawah 70% lebar slide.

**PRESENTASI:**

> Arsitekturnya terdiri dari empat layanan: frontend React, backend Express, AI Agent berbasis LangChain dan Telegraf, serta PostgreSQL dengan pgvector.
>
> Prinsip utamanya satu: **backend adalah satu-satunya penulis data bisnis**.
>
> AI Agent tidak punya akses tulis ke tabel transaksional. Ia membaca lewat API internal yang divalidasi, dan hanya punya hak baca ke indeks pengetahuan. Frontend dipakai admin; Telegram dipakai owner.
>
> Lapisan ini juga dilengkapi kunci internal antar layanan, RBAC tiga peran, audit log, dan prinsip *least privilege*.

**CUE:** Gunakan pointer atau animasi panah. Jangan membaca setiap kotak di diagram; jelaskan alurnya.

---

# SLIDE 07 — RAG DAN ANTI-HALUSINASI

- **ACTOR:** C
- **DURASI:** 50 detik

**PPT:**

> # Jawaban dibumikan, bukan ditebak.
>
> **Alur RAG**
>
> `knowledge_documents` → potong teks → embedding 1536 dimensi → pgvector + full-text search → hybrid retrieval (RRF) → ambang skor 0,3 → jawaban + sumber
>
> **Tiga guardrail**
>
> - Data transaksional dibaca *live* lewat API, tidak di-embed.
> - RAG hanya untuk SOP, kebijakan, runbook, dan FAQ.
> - Jika konteks tidak relevan, AI mengatakan tidak menemukan SOP — bukan mengarang.
>
> **18 tools · hybrid retrieval · ambang skor · sumber jawaban**

**VISUAL:**

- Kiri: pipeline lima langkah horizontal atau vertikal.
- Kanan: tiga kartu guardrail.
- Gunakan `gambar-3.png` sebagai ilustrasi pendukung, tetapi jangan dua diagram besar dalam satu slide.
- Sorot “ambang skor 0,3” dan “jawaban + sumber” dengan warna teal.

**PRESENTASI:**

> Untuk pertanyaan SOP, AI memakai RAG.
>
> Dokumen aktif dipotong, diubah menjadi embedding 1536 dimensi, lalu disimpan di pgvector. Saat ada pertanyaan, sistem menggabungkan pencarian vektor dan pencarian teks, menyaring hasil dengan ambang skor, lalu menyusun jawaban dengan konteks dan sumber.
>
> Ada tiga pengaman. Data transaksi tidak di-embed; ia dibaca langsung dari database. RAG hanya untuk dokumen statis. Dan jika tidak ada konteks yang relevan, AI harus mengatakan tidak menemukan SOP.
>
> Jadi, angka stok selalu datang dari database. SOP selalu datang dari dokumen yang bisa ditelusuri.

**CUE:** Ucapkan “angka dari database, SOP dari dokumen” sebagai kalimat penutup slide. Jeda.

---

# SLIDE 08 — DEMO

- **ACTOR:** B
- **DURASI:** 1 menit 30 detik

**PPT:**

> # Dari chat ke dokumen. Dari dokumen ke keputusan.
>
> **LIVE DEMO**
>
> 1. Login admin → dashboard.
> 2. Catat barang masuk → stok berubah.
> 3. Owner cek stok lewat Telegram.
> 4. Owner minta draft PO → admin dapat notifikasi → konfirmasi → terima barang.
> 5. Owner tanya SOP → jawaban + sumber.
>
> *Fallback: video demo atau screenshot jika koneksi bermasalah.*

**VISUAL:**

- Timeline horizontal lima langkah.
- Di bawah: tiga thumbnail `[SS-01]`, `[SS-06]`, `[SS-07]`.
- Badge merah kecil “LIVE” di pojok.
- Jangan tampilkan terlalu banyak teks; slide ini adalah peta demo, bukan dokumentasi.

**PRESENTASI:**

> Sekarang kami tunjukkan alurnya secara singkat.
>
> **[Buka dashboard]** Ini dashboard admin. Saya catat barang masuk. Perhatikan stok langsung berubah.
>
> **[Buka Telegram]** Dari sisi owner, saya tanya stok produk yang sama. Jawabannya berasal dari database, bukan dari tebakan model.
>
> **[Kirim perintah draft PO]** Saya minta draft PO untuk supplier. AI membuat draft, lalu admin menerima notifikasi. **[Buka notifikasi]** Admin membuka detail, mengonfirmasi, dan mencatat penerimaan. Status PO berubah menjadi COMPLETED.
>
> **[Tanya SOP]** Terakhir, saya tanya SOP penerimaan barang retur. Jawaban datang dari knowledge base dan menyebut sumbernya.
>
> Alur ini menunjukkan hal yang sama dari dua sisi: owner mendapat kecepatan chat, admin tetap memegang kontrol.

**CUE:** Latih demo maksimal 90 detik. Jika satu langkah gagal, langsung bilang “Saya lanjutkan dengan rekaman” dan jangan men-debug.

**Persiapan Demo:**

- Jalankan `make dev`, `make seed`, dan pastikan bot Telegram aktif.
- Buka tab: dashboard, daftar PO, detail PO, laporan, Telegram Web.
- Gunakan data seed yang sudah dikenal.
- Siapkan video cadangan 60–90 detik.
- Tutup notifikasi pribadi dan aplikasi lain.

---

# SLIDE 09 — BUKTI PENGUJIAN

- **ACTOR:** D
- **DURASI:** 50 detik

**PPT:**

> # Apa yang sudah terbukti, apa yang belum.
>
> **117 / 117**  
> Tes unit dan komponen lulus · 17 berkas
>
> **79**  
> Tes integrasi belum dijalankan · memerlukan PostgreSQL
>
> **22**  
> Skenario penerimaan dipetakan · 10 bukti unit · 9 menunggu · 3 belum diuji
>
> **Lint dan typecheck tiga layanan lulus.**
>
> *Kelayakan logika terbukti terbatas. Kelayakan integrasi penuh dan dampak operasional belum.*

**VISUAL:**

- Tiga kolom angka besar: 117, 79, 22.
- Gunakan warna berbeda: teal untuk 117, amber untuk 79, navy untuk 22.
- Di bawah: satu baris status dan satu kalimat batasan.
- Jangan menampilkan tabel lengkap; simpan untuk Q&A.

**PRESENTASI:**

> Kami ingin menyampaikan bukti pengujian secara jujur.
>
> Yang sudah lulus: **117 tes unit dan komponen dari 17 berkas**, tanpa kegagalan. Lint dan typecheck tiga layanan juga lulus.
>
> Yang belum: **79 tes integrasi** pada enam berkas belum dijalankan karena lingkungan evaluasi tidak menyediakan PostgreSQL. Dari 22 skenario penerimaan, 10 punya bukti di tingkat unit, 9 menunggu uji integrasi, dan 3 belum diuji.
>
> Artinya, kelayakan logika sudah terbukti terbatas. Kelayakan integrasi penuh dan dampak operasional belum bisa kami klaim.

**CUE:** Jangan terburu-buru di bagian ini. Berhenti setelah “belum bisa kami klaim”.

---

# SLIDE 10 — KEUNGGULAN DAN TARGET

- **ACTOR:** C
- **DURASI:** 50 detik

**PPT:**

> # Mengapa pendekatan ini berbeda.
>
> 1. **Chat-first** — kurva pembelajaran mendekati nol.
> 2. **Single source of truth** — backend satu-satunya penulis data.
> 3. **Draft-only AI** — manusia tetap mengonfirmasi dokumen.
> 4. **RAG yang bisa ditelusuri** — jawaban menyebut sumber.
> 5. **Self-hosted** — empat layanan dalam Docker Compose.
>
> **Target pilot:**  
> `<10 detik` info stok · `≤1%` selisih stok · `<1 menit` draft PO
>
> *Target, bukan hasil yang sudah terukur.*

**VISUAL:**

- Lima baris bernomor dengan judul tebal dan satu kalimat penjelas.
- Strip target di bagian bawah, latar navy, teks putih.
- Beri label kecil “TARGET PILOT” agar tidak disalahartikan sebagai hasil.
- Jangan menambahkan lebih dari lima keunggulan.

**PRESENTASI:**

> Ada lima alasan mengapa pendekatan ini berbeda.
>
> Satu, chat-first: owner tidak perlu belajar dashboard baru. Dua, single source of truth: backend menjadi satu-satunya penulis data. Tiga, draft-only AI: model tidak pernah menjadi penulis akhir dokumen. Empat, RAG yang bisa ditelusuri: jawaban menyebut sumber. Lima, self-hosted: seluruh sistem bisa dijalankan dengan Docker Compose.
>
> Target pilotnya: info stok di bawah sepuluh detik, selisih stok maksimal satu persen, dan draft PO di bawah satu menit. Ini target yang akan diukur, bukan klaim hasil.

**CUE:** Tunjuk strip target saat menyebut tiga angka. Tekankan kata “target pilot”.

---

# SLIDE 11 — PENUTUP

- **ACTOR:** A
- **DURASI:** 30 detik

**PPT:**

> # Data benar. Bahasa manusiawi.
>
> **Langkah berikutnya**
>
> 1. Menjalankan 79 tes integrasi dan uji end-to-end.
> 2. Pilot 4–8 minggu pada satu atau dua UMKM.
> 3. Menambahkan WhatsApp dan mengukur kualitas RAG.
>
> Terima kasih.  
> [NAMA] · [EMAIL] · [LINK DEMO / QR]

**VISUAL:**

- Latar navy `#0B1220`, teks putih, aksen teal.
- Kalimat utama besar di tengah.
- Tiga langkah kecil di bawah.
- QR code hanya jika link demo benar-benar aktif.

**PRESENTASI:**

> Sebagai penutup: sistem ini menunjukkan bahwa integrasi WMS, *tool calling*, dan RAG bisa dirancang dengan memisahkan kebenaran data dari bahasa.
>
> Langkah berikutnya adalah menjalankan tes integrasi, uji end-to-end, dan pilot 4–8 minggu pada UMKM. Setelah itu, WhatsApp dan pengukuran kualitas RAG menjadi prioritas.
>
> Data benar, bahasa manusiawi. Terima kasih.

**CUE:** Berhenti, tersenyum, buka sesi tanya jawab. Jangan menambahkan slide baru setelah ini.

---

# ANTISIPASI PERTANYAAN

## 1. Apa bedanya dengan ERP atau WMS biasa?

ERP biasa kuat, tetapi berat dan menuntut pelatihan. Sistem ini memisahkan dua kebutuhan: dashboard web untuk staf, chat untuk owner. Owner tidak perlu membuka dashboard untuk pertanyaan sederhana.

## 2. Bagaimana mencegah AI berhalusinasi?

Tiga lapis. Data transaksi dibaca langsung dari database lewat tool, bukan dari pengetahuan model. RAG memakai ambang skor dan menyebut sumber. Jika konteks tidak relevan, AI harus mengatakan tidak menemukan SOP. Model juga memakai temperature 0 dan maksimal 8 langkah.

## 3. Apakah AI bisa mengubah stok atau mengonfirmasi PO?

Tidak. AI hanya punya tool tulis terbatas untuk membuat draft PO dan draft Surat Jalan. Konfirmasi, penerimaan barang, dan perubahan stok tetap dilakukan admin di web.

## 4. Kenapa Telegram, bukan WhatsApp?

Telegram dipilih untuk MVP karena API-nya stabil dan cepat diimplementasikan. Survei menunjukkan 9 dari 10 responden memilih WhatsApp, jadi ini risiko adopsi yang kami catat. WhatsApp menjadi prioritas tahap lanjut.

## 5. Apakah sudah diuji ke UMKM?

Belum. Evaluasi yang dilakukan bersifat formatif. Survei melibatkan 10 responden, tetapi pilot lapangan 4–8 minggu belum dilaksanakan. Karena itu, klaim dampak belum bisa diajukan.

## 6. Apa keterbatasan terbesar?

79 tes integrasi belum dijalankan karena lingkungan evaluasi tidak menyediakan PostgreSQL. Uji end-to-end juga belum penuh. Selain itu, kualitas RAG belum diukur dengan metrik seperti *faithfulness* dan *answer relevance*.

## 7. Apakah sistem bisa dipakai banyak perusahaan?

Saat ini dirancang *single tenant*. Multi-tenant adalah pengembangan lanjutan, bukan bagian dari MVP.

## 8. Bagaimana biaya dan latensi LLM?

Belum diukur. Sistem memakai API model eksternal, sehingga biaya dan latensi perlu dipantau pada pilot. Ini salah satu rekomendasi kami.

## 9. Bagaimana keamanan data?

Ada RBAC tiga peran, kunci internal antar layanan, audit log, validasi Zod, pembatasan laju pesan, dan hak baca saja untuk agen AI. Namun, pengujian *prompt injection* dan penetrasi belum dilakukan.

## 10. Apa kontribusi ilmiahnya?

Kontribusi utamanya adalah pola integrasi yang memisahkan hak tulis backend dan hak baca agen AI, serta menempatkan RAG sebagai pelengkap data transaksional, bukan pengganti database. Pola *draft-only write* juga bisa menjadi acuan untuk sistem serupa.

---

# CHECKLIST SEBELUM PRESENTASI

- [ ] Placeholder nama, NIM, institusi, dan pembimbing sudah diganti.
- [ ] `[SS-01]` sampai `[SS-07]` sudah diganti screenshot asli.
- [ ] `gambar-2.png` dan `gambar-3.png` sudah ditempatkan dan terbaca.
- [ ] Angka 35,6 / 6,3 / 2,75 sudah diberi label “baseline”.
- [ ] Angka 117 / 79 / 22 sudah sesuai laporan.
- [ ] Tidak ada klaim “berhasil menurunkan” atau “mencapai target”.
- [ ] Demo sudah dilatih maksimal 90 detik.
- [ ] Video cadangan sudah disiapkan.
- [ ] Font, kontras, dan ukuran teks sudah dicek di proyektor.
- [ ] File PPT disimpan sebagai `.pptx` dan `.pdf`.
- [ ] Naskah dicetak atau dibuka di tablet, bukan di layar yang sama dengan slide.

---

# CATATAN RETORIKA

- Gunakan jeda satu detik setelah angka penting.
- Jangan membaca bullet; jelaskan satu ide per slide.
- Gunakan kata “kami” jika berkelompok, “saya” jika sendiri.
- Saat demo, bicara lebih lambat dan jelaskan tujuan setiap klik.
- Jika pertanyaan tidak bisa dijawab, katakan “itu belum kami ukur” — jangan mengarang.
- Akhiri dengan tenang: “Data benar, bahasa manusiawi.”
