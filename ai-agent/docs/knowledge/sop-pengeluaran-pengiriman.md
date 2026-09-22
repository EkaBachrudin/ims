# SOP Pengeluaran Barang & Pengiriman (Outbound)

## Tujuan
Memastikan barang keluar dari gudang tercatat dengan benar dan tidak melebihi stok yang tersedia.

## Prosedur Pengeluaran
1. Pastikan terdapat dokumen pesanan atau Surat Jalan yang sah.
2. Siapkan barang sesuai daftar item pada Surat Jalan.
3. Catat transaksi **Barang Keluar (outbound)** di dashboard WMS (produk, gudang, jumlah, customer).
4. Sistem menolak transaksi jika jumlah keluar melebihi stok tersedia (error INSUFFICIENT_STOCK).
5. Cetak Surat Jalan dan minta tanda terima dari penerima.

## Prosedur Pengiriman via Surat Jalan
1. Surat Jalan hanya dapat dibuat dari PO berstatus CONFIRMED atau COMPLETED.
2. Status Surat Jalan: DRAFT, SHIPPED, DELIVERED, CANCELLED.
3. Saat Surat Jalan diubah dari DRAFT menjadi SHIPPED, sistem otomatis membuat transaksi OUT dan mengurangi stok.
4. Setelah barang diterima customer, ubah status menjadi DELIVERED.

## Larangan
- Dilarang mengeluarkan barang tanpa dokumen.
- Dilarang mengubah stok secara manual di luar transaksi.
