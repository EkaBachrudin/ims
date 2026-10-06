# Onboarding & Matriks Peran WMS

## Tujuan
Menjelaskan peran pengguna dan alur persetujuan di aplikasi WMS.

## Peran Pengguna
- **SUPER_ADMIN**: akses penuh, termasuk manajemen pengguna, audit log, dan Knowledge Base.
- **ADMIN** (Admin Gudang): operasional harian — produk, partner, gudang, transaksi masuk/keluar, PO, Surat Jalan, laporan. Tidak mengakses Knowledge Base/kontrak.
- **OWNER**: pemantauan & keputusan — melihat laporan dan berinteraksi dengan Asisten AI (Telegram). Boleh mengakses catatan partner & kontrak.

## Alur Persetujuan (Approval)
1. **PO**: dibuat (DRAFT) → dikonfirmasi admin (CONFIRMED) → penerimaan barang → COMPLETED otomatis.
2. **Surat Jalan**: dibuat (DRAFT) → dikirim (SHIPPED, stok berkurang) → diterima pelanggan (DELIVERED).
3. **Void transaksi**: hanya admin; dicatat sebagai ADJUSTMENT kompensasi (bukan menghapus data asli).
4. **Perubahan harga/diskon khusus**: perlu persetujuan owner.

## Onboarding Pengguna Baru
1. SUPER_ADMIN membuat akun (email, nama, role).
2. Untuk akses Asisten AI: isi **Telegram ID** pengguna.
3. Pengguna mengirim `/start` ke bot Telegram agar bisa menerima notifikasi.
4. Role menentukan menu & hak akses di web.

## Prinsip
- Least privilege: beri role sesuai kebutuhan.
- Semua perubahan penting tercatat di Audit Log.
