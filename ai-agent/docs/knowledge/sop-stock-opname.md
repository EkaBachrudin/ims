# SOP Stock Opname & Kebijakan Stok

## Tujuan
Menjaga akurasi data stok antara catatan sistem dengan kondisi fisik di gudang.

## Jadwal
- Stock opname penuh dilakukan setiap akhir bulan.
- Stock opname parsial (sampling) dilakukan setiap minggu untuk produk fast-moving.

## Prosedur Stock Opname
1. Bekukan sementara transaksi masuk/keluar pada area yang dihitung.
2. Cetak laporan stok terkini dari menu Laporan.
3. Hitung fisik barang per SKU dan per gudang.
4. Bandingkan hasil hitung fisik dengan sistem.
5. Jika terdapat selisih, buat transaksi ADJUSTMENT dengan alasan "stock opname" dan cantumkan nomor berita acara.
6. Target selisih stok maksimal 1% per periode opname.

## Kebijakan Low-Stock
- Setiap produk memiliki ambang `minStock`.
- Sistem menandai produk sebagai stok kritis jika stok <= minStock.
- Produk stok kritis harus segera diisi melalui PO ke supplier.

## Kebijakan Stok Negatif
- Stok negatif tidak diizinkan pada MVP.
- Transaksi keluar yang melebihi stok akan ditolak oleh sistem.
