# Proposal

## Why

Tester web app harus bolak-balik ke DevTools untuk mengumpulkan bukti bug (network, console, screenshot), lalu menyusunnya manual menjadi laporan. Kasus yang paling sering lolos adalah response **HTTP 200 yang sebenarnya gagal** (mis. error validasi di body), karena tidak terlihat sebagai error. BRINSPECTOR (Chrome extension, dibawakan untuk hackathon) mengotomasi pengumpulan bukti tersebut dan memakai AI (Azure AI Foundry) untuk menandai kegagalan tersembunyi serta memberi saran perbaikan di setiap laporan PDF.

## What Changes

- Chrome extension baru (Manifest V3) bernama BRINSPECTOR — greenfield, belum ada kode sebelumnya.
- Monitoring **opt-in per situs**: tester menyalakan toggle "Monitor situs ini" dari popup; extension meminta izin host secara dinamis hanya untuk origin tersebut. Tanpa tombol Scan — setelah aktif, capture berjalan otomatis setiap situs dibuka.
- Capture otomatis **network (fetch/XHR, termasuk response body)**, **console error**, **uncaught exception**, dan **unhandled rejection** pada situs yang dimonitor, tanpa `chrome.debugger`.
- Klasifikasi saat capture murni berbasis status: **non-2xx dan request gagal (status 0) = error**; response 2xx tetap dicatat untuk dianalisis AI.
- **Screenshot berbasis kejadian** (viewport): dipicu oleh error network, console error/exception, selesainya request POST/PUT/PATCH/DELETE, dan tombol manual "Capture now"; di-debounce dan menunggu network idle. URL dipakai sebagai label pengelompokan, bukan pemicu.
- **Redaction saat capture** untuk header, field JSON, dan pola data sensitif sebelum apa pun disimpan.
- **Siklus hidup sesi per tab** yang ephemeral: berlanjut lintas navigasi, masa tenggang singkat setelah tab ditutup, ring buffer, dan pembersihan total saat browser restart.
- **Generate Report**: mengirim data sesi (sudah diredaksi, volume dibatasi) ke Azure AI Foundry dengan structured output untuk saran perbaikan per issue dan deteksi "200 tapi gagal", lalu menghasilkan **PDF** yang dapat diunduh.
- Popup sebagai viewer (timeline issue, status monitoring, Capture now, Generate Report, Clear), mengikuti design system di `docs/DESIGN.md` dan mockup Stitch.

## Capabilities

### New Capabilities
- `site-monitoring`: Opt-in monitoring per origin via toggle popup, izin host dinamis, registrasi content script, prompt reload saat pertama aktif, dan daftar situs yang dimonitor.
- `runtime-capture`: Penangkapan fetch/XHR (request, status, response body), console error, uncaught exception, dan unhandled rejection; klasifikasi error berbasis status code; bridge aman dari page ke extension.
- `screenshot-capture`: Screenshot viewport berbasis trigger (error, mutating request, manual) dengan debounce, tunggu network idle, dan penanganan saat tab tidak aktif.
- `data-redaction`: Penyamaran data sensitif (header, key JSON, pola kartu/NIK/email/telepon) pada saat capture sebelum penyimpanan.
- `session-management`: Sesi per tab, state ACTIVE/RECENT, ring buffer, Clear, dan pembersihan data saat browser restart.
- `ai-fix-suggestion`: Integrasi Azure AI Foundry dari extension, pembatasan volume data, structured output (root cause, saran fix, severity, penanda hidden failure).
- `pdf-report`: Pembuatan dan unduhan laporan PDF yang dikelompokkan per URL, memuat issue, screenshot, catatan tester, dan saran AI.

### Modified Capabilities
<!-- Tidak ada: belum ada spec yang ada di openspec/specs/. -->

## Impact

- **Kode**: proyek baru — extension MV3 (TypeScript) dengan popup UI, service worker, dan content script (MAIN + ISOLATED world).
- **Dependensi**: framework build extension (mis. WXT/Vite), UI library + Tailwind, penyimpanan IndexedDB, library PDF.
- **Sistem eksternal**: Azure AI Foundry (deployment model chat dengan dukungan structured output). API key dibaca dari env saat build — hanya untuk build yang tetap di laptop tim; memerlukan resource khusus hackathon dengan kuota terbatas dan rotasi key setelah acara.
- **Izin Chrome**: `storage`, `scripting`, `tabs`, `optional_host_permissions` untuk situs target, dan host permission ke endpoint Foundry.
- **Keamanan & privasi**: memproses data aplikasi yang dites (termasuk potensi data nasabah) — redaction, render data capture sebagai teks (anti-XSS), dan retensi data minimal adalah syarat, bukan opsi.
- **Batasan yang diketahui**: screenshot hanya viewport; iframe lintas origin tidak tertangkap kecuali origin-nya juga dimonitor; request yang terjadi sebelum monitoring aktif pertama kali tidak tertangkap (butuh reload).
