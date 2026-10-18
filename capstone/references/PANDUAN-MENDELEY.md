# Panduan Mendeley — Laporan Kemajuan Capstone

Dokumen ini menjelaskan cara memasukkan sitasi dan daftar pustaka laporan ke dalam Microsoft Word menggunakan Mendeley, sesuai permintaan pembimbing bahwa penulisan kutipan dan daftar pustaka harus memakai aplikasi Mendeley.

---

## 1. Berkas yang disediakan

| Berkas | Fungsi |
| :--- | :--- |
| `daftar-pustaka.ris` | Berkas referensi format RIS. **Disarankan** untuk diimpor ke Mendeley. |
| `daftar-pustaka.bib` | Berkas referensi format BibTeX. Alternatif bila impor RIS bermasalah. |

Keduanya memuat delapan rujukan yang sama dengan yang dipakai pada `LAPORAN-KEMAJUAN.md` dan `PROPOSAL.md`. Setiap entri diberi kunci sitasi (`Citation Key`) berupa nama belakang penulis pertama dan tahun, misalnya `lewis2020rag`.

---

## 2. Ringkasan langkah

1. Impor berkas referensi ke Mendeley Reference Manager.
2. Pasang add-in **Mendeley Cite** pada Microsoft Word.
3. Tulis naskah di Word dengan menyisipkan sitasi melalui add-in.
4. Pilih gaya **American Psychological Association 7th edition**.
5. Sisipkan daftar pustaka otomatis pada akhir naskah.

---

## 3. Memasukkan referensi ke Mendeley

### 3.1 Impor otomatis dari berkas

1. Buka **Mendeley Reference Manager** (versi desktop).
2. Pilih **Add** atau menu **File → Add Entry Manually**, lalu pilih **Import → RIS/BibTeX**.
   Nama menu dapat berbeda menurut versi; cari opsi impor berkas, bukan penambahan entri manual.
3. Arahkan ke `capstone/references/daftar-pustaka.ris`.
4. Pastikan muncul delapan entri, lalu periksa judul dan tahunnya.

### 3.2 Impor melalui Mendeley Web Importer

Bila belum memasang aplikasi desktop:

1. Buka Mendeley Web, lalu masuk ke **Library**.
2. Buat koleksi baru, misalnya **Capstone WMS-RAG**.
3. Unggah entri melalui opsi impor berkas RIS pada halaman tersebut.

### 3.3 Pemeriksaan setelah impor

Periksa tiga hal berikut, karena kesalahan metadata akan terbawa ke daftar pustaka Word.

- **Nama penulis** tidak terpotong dan tidak tertukar antara nama depan dan nama belakang.
- **Tahun** sesuai, khususnya `lewis2020rag` dan `brown2020fewshot` yang sama-sama terbit 2020 sehingga kunci sitasinya perlu dibedakan.
- **Jenis entri** tepat: artikel konferensi untuk makalah NeurIPS, artikel jurnal untuk dua rujukan UMKM, dan laporan/arXiv untuk survei.

---

## 4. Memasang Mendeley Cite di Word

1. Buka Microsoft Word.
2. Pilih **Insert → Get Add-ins** (atau **My Add-ins**).
3. Cari **Mendeley Cite**, lalu pilih **Add**.
4. Masuk dengan akun Mendeley yang sama dengan tempat referensi diimpor.
5. Buka panel Mendeley Cite; bila perlu, pilih koleksi **Capstone WMS-RAG**.

---

## 5. Menyisipkan sitasi

1. Letakkan kursor pada akhir kalimat yang memerlukan kutipan.
2. Pada panel Mendeley Cite, cari nama penulis atau kata kunci judul.
3. Pilih referensi yang tepat, lalu klik **Insert Citation**.
4. Mendeley akan menuliskan sitasi dalam format kurung, misalnya **(Lewis et al., 2020)**.
5. Untuk sitasi naratif, ketik nama penulis lebih dahulu, lalu sisipkan sitasi dan ubah tampilannya menjadi model naratif melalui opsi tampilan sitasi, sehingga hasilnya menjadi **Lewis et al. (2020)**.

### 5.1 Pilihan gaya sitasi

1. Pada panel Mendeley Cite, buka **Citation Style**.
2. Pilih **American Psychological Association 7th edition**.
3. Seluruh sitasi dalam dokumen akan menyesuaikan gaya tersebut secara otomatis.

### 5.2 Mengubah tampilan menjadi "et al."

Untuk rujukan dengan tiga penulis atau lebih, APA 7 memakai bentuk "et al.". Setelan ini dikendalikan gaya sitasi; pastikan gaya yang dipilih sudah APA 7, lalu periksa satu contoh sitasi.

---

## 6. Menyisipkan daftar pustaka

1. Letakkan kursor pada halaman daftar pustaka, di posisi alfabetis yang benar.
2. Pada panel Mendeley Cite, pilih **Insert Bibliography**.
3. Daftar pustaka akan terbentuk otomatis dan diperbarui setiap kali sitasi di badan naskah berubah.

---

## 7. Pemetaan dengan dokumen Markdown

Dokumen `LAPORAN-KEMAJUAN.md` sudah memakai sitasi gaya APA 7 author-date, sehingga pemetaan ke Mendeley langsung.

| Kunci sitasi | Sitasi dalam naskah | Nomor pada PROPOSAL.md |
| :--- | :--- | :--- |
| `lewis2020rag` | (Lewis et al., 2020) | [1] |
| `schick2023toolformer` | (Schick et al., 2023) | [2] |
| `mialon2023alm` | (Mialon et al., 2023) | [3] |
| `purnomo2024digital` | (Purnomo et al., 2024) | [4] |
| `hasanah2024erp` | (Hasanah et al., 2024) | [5] |
| `vaswani2017attention` | (Vaswani et al., 2017) | [6] |
| `brown2020fewshot` | (Brown et al., 2020) | [7] |
| `gao2023ragsurvey` | (Gao et al., 2023) | [8] |

**Keterangan:** `PROPOSAL.md` memakai gaya angka, sedangkan `LAPORAN-KEMAJUAN.md` memakai gaya author-date. Tabel di atas memudahkan penelusuran ketika naskah dari kedua dokumen digabungkan di Word.

---

## 8. Alur kerja yang disarankan untuk Word

1. Buka Word, atur gaya APA 7 melalui Mendeley Cite.
2. Salin isi `LAPORAN-KEMAJUAN.md` ke Word. Judul, tabel, dan diagram perlu ditata ulang sesuai format institusi; tabel yang berasal dari Markdown akan tersalin sebagai tabel biasa.
3. Hapus blok **Daftar Pustaka** pada naskah Markdown, karena daftar pustaka akan dibentuk oleh Mendeley.
4. Sisipkan sitasi pada setiap tempat yang sebelumnya memuat sitasi bentuk teks.
5. Sisipkan daftar pustaka melalui Mendeley Cite.
6. Perbarui nomor tabel dan gambar setelah penataan, lalu periksa agar setiap rujukan "Tabel x" dan "Gambar x" masih menunjuk objek yang benar.

---

## 9. Hal yang perlu diperhatikan

- **Jangan mengetik sitasi secara manual** setelah Mendeley dipakai. Sitasi manual tidak akan dikenali Mendeley dan dapat tertinggal dari daftar pustaka saat diperbarui.
- **Sitasi bukan pengganti verifikasi.** Mendeley hanya menyusun format. Pastikan setiap rujukan benar-benar dibaca dan relevan dengan pernyataan yang dikutip.
- **Periksa tautan DOI dan arXiv** pada kedelapan rujukan sebelum pengumpulan, agar tidak ada tautan yang mati.
- **Dua blok peringatan `⚠️ DATA SIMULASI`** pada subbagian 1.1.2 dan 1.1.3 harus dihapus setelah data primer menggantikan data simulasi. Jangan lupa memperbarui baris **Status Data** pada header dokumen.
- **Bila institusi mewajibkan gaya angka** (IEEE atau Vancouver), ubah gaya pada Mendeley Cite; tidak perlu mengetik ulang sitasi.
