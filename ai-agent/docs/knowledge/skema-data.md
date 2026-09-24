# Skema & Istilah Data Sistem WMS

## Tujuan
Menjelaskan arti entitas, istilah, dan aturan bisnis pada sistem WMS agar Asisten AI memahami konteks data yang dibacanya. Dokumen ini **bukan** sumber data transaksional; angka stok/transaksi selalu diambil lewat tool ke Backend API.

## Entitas Master
- **Produk**: barang yang diperdagangkan. Memiliki `SKU` (kode unik), `nama`, `satuan` (unit, mis. pack/dus/bal), `stok` (akumulasi otomatis), `minStock` (batas minimum), dan `kategori`. Varian/ukuran biasanya dibedakan pada nama produk (mis. "Air Mineral Botol 1 Liter").
- **Kategori**: pengelompokan produk (mis. Frozen, Minuman).
- **Partner**: pihak eksternal. Tipe `SUPPLIER` (pemasok, untuk Purchase Order) dan `CUSTOMER` (pelanggan, untuk Surat Jalan).
- **Gudang**: lokasi penyimpanan, punya `kode` unik dan status aktif. Contoh: Gudang Utama.
- **Inventory**: jumlah stok per kombinasi produk + gudang. Total `Produk.stok` adalah agregat dari seluruh Inventory.

## Transaksi Stok (`StockTransaction`)
Mencatat setiap pergerakan stok. Tipe:
- **IN (Barang Masuk)**: stok bertambah. Bisa bertaut Purchase Order.
- **OUT (Barang Keluar)**: stok berkurang (pengiriman/penjualan). Bisa bertaut Surat Jalan.
- **ADJUSTMENT (Penyesuaian)**: koreksi stok, termasuk pembatalan (void) transaksi. Void tidak menghapus transaksi asli, melainkan mencatat ADJUSTMENT kompensasi.

Aturan: **stok tidak boleh diubah manual**; selalu dihitung dari transaksi. Setiap transaksi punya tanggal, produk, gudang, jumlah, dan opsional partner/PO/Surat Jalan.

## Purchase Order (PO)
Pesanan pembelian ke supplier. Status:
- **DRAFT**: baru dibuat (termasuk dari chat AI), belum dikonfirmasi.
- **CONFIRMED**: sudah dikonfirmasi admin, siap menerima barang.
- **COMPLETED**: seluruh item sudah diterima penuh (otomatis).
- **CANCELLED**: dibatalkan.

Aturan: PO **hanya untuk partner bertipe SUPPLIER**. PO tidak mengubah stok; stok bertambah saat penerimaan (IN) dicatat. Penerimaan IN bertaut PO **tidak boleh melebihi sisa pesanan**. Sumber PO bisa `WEB` atau `AI_CHAT`.

## Surat Jalan / Delivery Note (DN)
Dokumen pengiriman ke customer. Status:
- **DRAFT**: dibuat, stok belum berkurang.
- **SHIPPED**: dikirim; sistem otomatis membuat transaksi OUT per item.
- **DELIVERED**: diterima customer.
- **CANCELLED**: dibatalkan.

Aturan: Surat Jalan **hanya untuk partner bertipe CUSTOMER**, dan dapat dibuat dari PO berstatus CONFIRMED/COMPLETED.

## Istilah Laporan
- **Stok tipis**: produk dengan stok <= minStock (perlu restock).
- **Rekap pengiriman**: daftar transaksi OUT pada satu tanggal tertentu.
- **Barang masuk/keluar**: transaksi IN/OUT; untuk rentang tanggal dan filter gunakan daftar transaksi, bukan rekap pengiriman.
- **Ringkasan dashboard**: total produk, PO aktif, jumlah transaksi masuk/keluar hari ini, jumlah stok tipis.

## Cara AI Mengambil Data
Semua angka diambil lewat tool ke Backend API, bukan dari dokumen ini. Ringkasan tool:
- Katalog/varian produk: `cari_produk`; stok satu barang: `cek_stok_barang`; stok per gudang: `stok_per_gudang`.
- Kategori: `list_kategori`; partner: `list_partner`; gudang: `list_gudang`.
- Transaksi masuk/keluar/penyesuaian: `list_transaksi`; rekap keluar satu tanggal: `rekap_pengiriman`.
- PO: `list_po`, `detail_po`; surat jalan: `list_surat_jalan`.
- Stok tipis: `stok_tipis`; ringkasan: `ringkasan_dashboard`.

## Kemampuan Menulis
AI hanya dapat membuat **draft** (belum mengubah stok):
- `buat_draft_po`: draft Purchase Order, hanya untuk partner bertipe SUPPLIER.
- `buat_draft_surat_jalan`: draft Surat Jalan (Delivery Note), hanya untuk partner bertipe CUSTOMER. Stok baru berkurang saat surat jalan berstatus SHIPPED.

Keduanya selalu berstatus DRAFT dan wajib dikonfirmasi/dikirim oleh admin di aplikasi web.
