# FAQ Operasional WMS

## Umum
**Apa itu ADJUSTMENT?**
Transaksi koreksi stok, termasuk pembatalan (void) transaksi. Void tidak menghapus transaksi asli, melainkan mencatat ADJUSTMENT kompensasi.

**Kenapa stok tidak bisa diubah manual?**
Stok selalu dihitung dari transaksi agar akurat dan dapat diaudit.

**Apa bedanya IN dan OUT?**
IN = barang masuk (stok bertambah). OUT = barang keluar (stok berkurang).

## Produk & Stok
**Apa itu stok tipis?**
Produk dengan stok ≤ `minStock` (batas minimum), perlu restock.

**Apa itu SKU?**
Kode unik produk. Varian/ukuran biasanya dibedakan pada nama produk.

## Dokumen
**Apa perbedaan PO dan Surat Jalan?**
PO = pesanan pembelian ke supplier. Surat Jalan = dokumen pengiriman ke customer.

**Kapan stok berkurang saat pengiriman?**
Saat Surat Jalan berubah dari DRAFT menjadi SHIPPED.

**Bisakah Surat Jalan dibuat tanpa PO?**
Ya, Surat Jalan dapat dibuat langsung; namun dapat juga dari PO berstatus CONFIRMED/COMPLETED.

## Asisten AI
**Kenapa akun saya belum bisa chat?**
Pastikan akun aktif dan `telegramId` sudah diisi serta pernah mengirim `/start`.

**Apakah AI bisa membuat PO/surat jalan langsung?**
Hanya membuat **draft** (status DRAFT); konfirmasi/pengiriman tetap oleh admin di web.

**Berapa batas pesan ke Asisten AI?**
Maksimum 12 pesan per menit per chat.
