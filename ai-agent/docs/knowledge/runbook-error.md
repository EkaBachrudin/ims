# Runbook Error Sistem WMS

## Tujuan
Panduan cepat menangani pesan error umum di aplikasi WMS.

## INSUFFICIENT_STOCK
- **Artinya:** jumlah barang keluar melebihi stok tersedia di gudang terkait.
- **Penyebab:** stok fisik kurang, salah pilih gudang, atau transaksi masuk belum dicatat.
- **Solusi:** cek stok per gudang; pastikan transaksi barang masuk sudah dicatat; kurangi jumlah keluar atau pindah gudang.

## INVALID_STATE
- **Artinya:** perubahan status dokumen tidak sesuai alur.
- **Contoh:** mengirim Surat Jalan yang masih DRAFT dari PO yang belum CONFIRMED, atau mengubah dokumen yang sudah CANCELLED.
- **Solusi:** periksa status dokumen; ikuti alur (PO: DRAFT → CONFIRMED → COMPLETED; DN: DRAFT → SHIPPED → DELIVERED).

## VALIDATION_ERROR
- **Artinya:** input tidak lengkap/tidak valid (mis. jumlah negatif, tanggal salah format).
- **Solusi:** perbaiki field yang ditandai; gunakan format tanggal YYYY-MM-DD.

## NOT_FOUND
- **Artinya:** data yang direferensikan tidak ada (produk/partner/gudang/PO/DN).
- **Solusi:** cari nama persis di katalog; buat master data bila memang belum ada.

## CONFLICT
- **Artinya:** data sudah ada (mis. SKU/nomor dokumen duplikat).
- **Solusi:** gunakan kode/nomor lain atau perbarui data yang ada.

## FORBIDDEN
- **Artinya:** pengguna tidak punya hak akses.
- **Solusi:** minta admin/owner menyesuaikan role pengguna.

## Stok negatif
- Stok negatif **tidak diizinkan** pada MVP; transaksi keluar yang melebihi stok akan ditolak sistem.
