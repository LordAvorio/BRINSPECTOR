# Design

## Context

Proyek greenfield: repo baru berisi `docs/DESIGN.md` (design system "Cyber Diagnostic Minimal") dan mockup Stitch untuk popup. Motivasi dan scope ada di proposal.md. Batasan utama yang membentuk desain:

- Chrome Manifest V3: service worker bisa dihentikan kapan saja, popup tertutup saat user mengklik halaman, `chrome.webRequest` tidak bisa membaca response body.
- Tidak ada backend: extension memanggil Azure AI Foundry langsung.
- Build hanya dipakai di laptop tim (tidak didistribusikan).
- Aplikasi yang dites dapat memuat data sensitif (konteks perbankan).

```
 +------------------------- CHROME EXTENSION (MV3) --------------------------------+
 |                                                                                 |
 |  POPUP (viewer)                                                                 |
 |   [x] Monitor situs ini | timeline issue | [Capture now] | [Generate] | [Clear] |
 |            |                                                    |               |
 |            v (permissions.request)                              |               |
 |  CONTENT SCRIPTS (origin yang dimonitor, document_start)        |               |
 |   MAIN     : hook fetch/XHR, console.error, onerror, rejection  |               |
 |   ISOLATED : relay + validasi nonce                             |               |
 |            | runtime message                                    |               |
 |            v                                                    v               |
 |  SERVICE WORKER                                                                 |
 |   redact --> classify --> trigger? --> captureVisibleTab                        |
 |      |                                                                          |
 |      v                                                                          |
 |   IndexedDB (event, body, screenshot)  +  storage.session (meta sesi)           |
 |                                                                                 |
 |   Generate: pilih & potong data --> Foundry (structured output) --> PDF         |
 +---------------------------------------------------------------------------------+
```

## Goals / Non-Goals

**Goals:**
- Capture tanpa banner debugger dan tanpa langkah manual setelah situs diaktifkan.
- Data sensitif tidak pernah tersimpan dalam bentuk mentah.
- Tahan terhadap service worker yang dihentikan MV3 (tidak ada state penting hanya di memori).
- Satu klik dari popup menghasilkan PDF berisi bukti + saran AI.

**Non-Goals:**
- Screenshot full-page (hanya viewport).
- Capture dari iframe lintas origin yang tidak dimonitor, WebSocket, Server-Sent Events, dan request dari Service Worker milik halaman.
- Deteksi "halaman baru" berbasis route SPA.
- Klasifikasi isi body saat capture (diserahkan ke AI saat Generate).
- Distribusi publik (Chrome Web Store) dan manajemen kredensial per user.
- Sinkronisasi atau penyimpanan laporan di server.

## Decisions

### D1. Capture lewat hook di MAIN world, bukan `chrome.debugger`
Content script di MAIN world (didaftarkan dengan `chrome.scripting.registerContentScripts`, `runAt: document_start`, `persistAcrossSessions: true`) membungkus `fetch`, `XMLHttpRequest`, `console.error`, `window.onerror`, dan `unhandledrejection`.
- **Alternatif**: `chrome.debugger` (CDP) memberi body, console, dan screenshot full-page, tetapi memunculkan banner "debugging" permanen dan bisa dibatalkan user. `chrome.webRequest` tidak memberi response body. `chrome.devtools.network` mengharuskan DevTools terbuka.
- **Konsekuensi**: request sebelum script aktif tidak tertangkap, maka prompt reload saat monitoring pertama kali dinyalakan (lihat D3).

### D2. Bridge MAIN → ISOLATED → service worker dengan nonce
MAIN world tidak punya akses `chrome.runtime`, jadi event dikirim via `window.postMessage` ke script ISOLATED, lalu diteruskan dengan `chrome.runtime.sendMessage`. Script ISOLATED membuat nonce acak per halaman dan menyerahkannya ke MAIN world saat inisialisasi; pesan tanpa nonce yang cocok atau dengan bentuk tidak valid dibuang.
- **Alternatif**: `CustomEvent` di DOM — sama-sama bisa dipalsukan oleh halaman, tidak lebih aman.
- **Catatan**: halaman tetap bisa memalsukan event karena berbagi MAIN world; nonce mencegah spam dari skrip pihak ketiga yang tidak tahu protokolnya, bukan jaminan penuh. Data capture selalu diperlakukan sebagai input tidak tepercaya (D10).

### D3. Opt-in per origin dengan izin dinamis
`optional_host_permissions` + `chrome.permissions.request` untuk origin persis dari tab aktif, dipanggil dari klik toggle di popup (user gesture). Setelah izin diberikan, content script didaftarkan untuk origin itu dan popup menawarkan reload. Mematikan toggle mencabut registrasi script dan izin (`chrome.permissions.remove`). Daftar origin disimpan di `chrome.storage.local`.
- **Alternatif**: host permission `<all_urls>` statis (menangkap situs pribadi tester, risiko privasi), daftar domain di Settings (lebih banyak friksi), hardcode domain (tidak fleksibel).

### D4. Klasifikasi berbasis status code saja
`status` di luar 200–299 atau request gagal (status 0: CORS, timeout, offline, abort) → `error`. Lainnya → `ok`. Console error, uncaught exception, dan unhandled rejection → `error`. Tidak ada heuristik body saat capture.
- **Alternatif**: aturan body (mis. `success:false`, `errors` tidak kosong, `responseCode != "00"`) — ditolak karena konvensi antar aplikasi berbeda dan rawan false positive; peran ini dipindah ke AI (D8).

### D5. Screenshot berbasis trigger dengan debounce + network idle
Trigger: event `error` (D4), selesainya request POST/PUT/PATCH/DELETE (apa pun statusnya), dan tombol "Capture now". Setelah trigger, service worker menunggu network idle (tidak ada request fetch/XHR yang pending ~500 ms, batas maksimum ~2 s), lalu memanggil `chrome.tabs.captureVisibleTab` (JPEG, kualitas ~70). Trigger yang datang selama jendela tunggu digabung ke satu screenshot. Jika tab tidak aktif/terlihat, event ditandai `screenshot: unavailable`.
- **Alternatif**: screenshot per halaman — butuh deteksi route SPA yang tidak andal; screenshot saat load — belum menampilkan pesan error/validasi.
- **Konsekuensi**: `captureVisibleTab` dibatasi ~2 panggilan/detik; debounce menjaga di bawah batas.

### D6. Redaction saat ingest, di service worker
Setiap event diredaksi sebelum ditulis ke storage. Tiga lapis:
1. Header: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`, dan header yang mengandung `token`/`secret`.
2. Key JSON (case-insensitive, rekursif) yang mengandung: `password`, `pass`, `pin`, `otp`, `token`, `secret`, `cvv`, `cvc`, dan identitas sensitif.
3. Pola nilai: nomor kartu (13–19 digit, lolos Luhn), NIK (16 digit), email, nomor telepon.
Nilai diganti penanda seperti `[REDACTED:card]`; jumlah redaksi dicatat per event untuk ditampilkan di UI. Body dipotong ke batas ukuran sebelum redaksi.
- **Alternatif**: redaksi saat Generate — ditolak karena data mentah akan tersimpan di IndexedDB.

### D7. Penyimpanan dan siklus hidup sesi
- `chrome.storage.session`: metadata sesi per tab (id, origin, status, hitungan).
- IndexedDB (via wrapper kecil seperti Dexie/idb): event, body, screenshot (Blob).
- Setiap event langsung ditulis (tidak di-buffer di memori) karena service worker dapat dihentikan.

State sesi:
```
 ACTIVE --(tab ditutup)--> RECENT --(TTL 30 mnt / >3 sesi)--> dihapus
   |                          |
   +--(Clear)--> dihapus      +--(Generate)--> PDF, lalu dihapus
   +--(Generate)--> PDF, prompt "Mulai sesi baru?"
 browser startup (runtime.onStartup) --> hapus semua
```
Ring buffer per sesi: ~300 event network, ~30 screenshot; yang tertua dibuang. Semua angka adalah konstanta yang mudah diubah.

### D8. AI: panggilan langsung ke Foundry dengan structured output
Service worker memanggil endpoint chat completions Foundry via `fetch` (host Foundry ada di `host_permissions`, sehingga tidak terkena CORS). Endpoint, nama deployment, dan API key dibaca dari env saat build (`import.meta.env`). Response diminta dalam JSON schema, per item:
```
{ issueId, isHiddenFailure, rootCause, suggestedFix, severity }
```
Payload yang dikirim dibatasi: semua event `error`, request mutating 2xx (kandidat hidden failure), GET 2xx di-dedup per URL+status, body dipotong, ditambah catatan insiden dari tester. AI hanya dipanggil saat Generate Report.
- **Alternatif**: proxy Azure Function (lebih aman, tapi menambah deploy), BYOK via Options page, Entra ID + `chrome.identity` (tanpa key, butuh App Registration). Env dipilih karena build tidak keluar dari laptop tim.
- **Konsekuensi**: key tertanam di bundle — dimitigasi di Risks.

### D9. PDF dengan pdfmake
Dokumen dibangun secara deklaratif (teks bisa dipilih, tabel, gambar JPEG) dan diunduh dengan satu klik via `chrome.downloads` atau anchor download dari halaman extension. Struktur: ringkasan sesi → dikelompokkan per URL → tiap issue (detail request/console, screenshot, saran AI). Tema PDF memakai versi terang dari palet DESIGN.md agar layak cetak.
- **Alternatif**: halaman report HTML + `window.print()` (paling cepat, tetapi butuh langkah "Save as PDF" manual); jsPDF + html2canvas (hasil raster, teks tidak bisa dipilih).

### D10. Data capture = input tidak tepercaya
Semua data dari halaman (URL, body, pesan console, stack) dirender sebagai teks di popup dan PDF — tidak pernah lewat `innerHTML`/`dangerouslySetInnerHTML`. CSP bawaan MV3 (tanpa remote code) dipertahankan. Hal ini penting karena extension memegang API key AI.

### D11. Stack
TypeScript + WXT (entrypoint MV3, content script MAIN world, HMR) untuk extension; React/Preact + Tailwind untuk popup, dengan token warna dari mockup Stitch/DESIGN.md; Vitest untuk unit test (redaction, classifier, ring buffer); Playwright untuk E2E dengan extension ter-load.
- **Alternatif**: Vite + CRXJS (lebih manual untuk MAIN world), Plasmo (kurang aktif).

## Risks / Trade-offs

- [API key tertanam di bundle] → `.env` dan output build di `.gitignore` sejak commit pertama; resource Foundry khusus hackathon; batas kuota/TPM di deployment; rotasi key setelah acara; build tidak dibagikan.
- [Halaman bisa memalsukan event ke bridge] → nonce + validasi skema; data diperlakukan tidak tepercaya (D10); dampak terbatas pada isi laporan sesi itu sendiri.
- [Hook `fetch`/XHR bisa bentrok dengan aplikasi atau library lain yang juga membungkusnya] → pertahankan semantik asli (clone response, jangan konsumsi body asli), bungkus sekali, tangani error hook tanpa memengaruhi request.
- [Body besar / streaming membebani memori] → hanya baca body bertipe teks/JSON, batasi ukuran, lewati tipe biner.
- [Redaction tidak menangkap semua data sensitif] → pola konservatif, jumlah redaksi ditampilkan ke tester, catatan di laporan bahwa redaksi bersifat best-effort.
- [Hidden failure bergantung pada kualitas AI] → sertakan body terpotong dan konteks request; tandai hasil AI sebagai saran, bukan vonis.
- [Screenshot tidak tersedia saat tab tidak aktif] → event tetap tercatat dengan status `unavailable`; "Capture now" sebagai cadangan.
- [Popup maks 800×600 dan tertutup saat klik halaman] → popup hanya viewer; seluruh capture berjalan di background.
- [Request awal terlewat saat monitoring pertama kali aktif] → prompt reload.

## Open Questions

- Nilai final batas (ring buffer, TTL RECENT, ukuran body, jendela idle) — disetel saat uji dengan aplikasi target.
- Lebar popup: DESIGN.md menyebut 400px sedangkan mockup Stitch 720px; pilih salah satu dan selaraskan dokumen desain.
- Pilihan React vs Preact untuk popup (tidak memengaruhi spec maupun struktur tugas).
