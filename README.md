<div align="center">

# Aniverse PRO

![Next.js](https://img.shields.io/badge/Next.js%2014-App%20Router-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Auth](https://img.shields.io/badge/next-auth-Google%20%2B%20Demo-green)
![DB](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![Player](https://img.shields.io/badge/Plyr%20%2B%20hls.js-Player-orange)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8)
![License](https://img.shields.io/badge/Edukasi%2FDemo-MIT-blue)

**Streaming anime demo fullstack dengan sistem kunci atomik, XP/level anti-farming, multi-server failover, dan login instan zero-setup.**

</div>

---

## ⚠️ Disclaimer (Penting)

Project ini dibuat **untuk tujuan edukasi dan demo**. Sumber video berasal dari API pihak ketiga (provider gaya Consumet) yang dikonfigurasi sendiri oleh pengguna; **semua hak cipta konten anime tetap milik pemiliknya masing-masing**. Aniverse PRO **tidak menyimpan, meng-host, maupun mendistribusikan** konten anime — aplikasi hanya mem-proxy metadata dari [AniList](https://anilist.co) (GraphQL, tanpa API key) dan meneruskan sumber video dari upstream yang dipilih pengguna.

**Server Demo** bawaan menggunakan video sample **bebas royalti** (*Big Buck Bunny*, *Elephants Dream* — lisensi Creative Commons) dari bucket publik Google (`gtv-videos-bucket`), sehingga aplikasi **selalu bisa dicoba** tanpa bergantung pada upstream mana pun.

Streaming atau distribusi konten berhak cipta tanpa izin adalah tanggung jawab pengguna. Gunakan hanya konten yang Anda miliki haknya atau yang berlisensi bebas.

---

## ✨ Fitur Utama

- 🔑 **Sistem kunci atomik anti double-spend** — 1 episode = 1 kunci, dipotong via `UPDATE ... WHERE keys > 0` (transaksi SQLite); request paralel tidak mungkin menghabiskan kunci yang sama. Semua mutasi tercatat di `key_ledger`.
- 📈 **XP & Level anti-farming** — XP hanya bertambah saat video *playing* **dan** tab aktif (divalidasi server via heartbeat 5 detik). Ada *daily cap* (default 7200 XP/hari, reset tengah malam), kurva level `100 × L²`, reward **+1 kunci setiap 5 level**, dan badge progresif.
- 🎬 **Login Demo zero-setup + Google OAuth** — klik "Login Demo" langsung masuk (user `Tamu Demo`, `isDemo=true`) tanpa konfigurasi apa pun. Google OAuth aktif otomatis jika `GOOGLE_CLIENT_ID/SECRET` diisi.
- 🔀 **Multi-server failover + Server Demo** — upstream dicoba berurutan dengan timeout 5 detik; jika semua gagal, otomatis jatuh ke **Server Demo yang selalu aktif**. Ada tombol "Ganti Server" manual + health check berkala.
- 🎞️ **Player profesional** — Plyr + hls.js (mendukung HLS `.m3u8` dan MP4), subtitle, kualitas, keyboard shortcut, dark UI.
- 🛡️ **Security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy di `next.config.mjs`; cookie HttpOnly+SameSite; tidak ada secret di frontend.
- 🚦 **Rate limit** — 30 request/menit per (IP + user), in-memory sliding window (opsional Redis via `REDIS_URL`).
- 📱 **PWA** — `manifest.json`, service worker (cache-first aset, network-first navigasi, halaman offline), installable.
- 🌙 **Dark mode** UI modern dengan aksen pink→cyan.
- 🔒 **Semua API anime di-proxy lewat backend** — frontend tidak pernah menyentuh AniList atau upstream secara langsung.

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (PWA)                            │
│  UI Next.js · Plyr+hls.js · sonner toasts · service worker      │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTPS (semua request lewat /api/* proxy)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js 14 (App Router)                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ /api/auth  │  │ /api/keys/*  │  │ /api/xp/* /api/history  │  │
│  │ (next-auth)│  │ (spend/iklan)│  │ /api/user /api/health   │  │
│  └────────────┘  └──────────────┘  └─────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/anime/*  →  proxy metadata & resolusi sumber video  │   │
│  └──────┬───────────────────────────┬───────────────────────┘   │
└─────────┼───────────────────────────┼───────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐      ┌──────────────────────────────────────┐
│  AniList GraphQL │      │  Upstream video providers (failover) │
│  (metadata,      │      │  Primary → Backup 1 → Backup 2 → …   │
│   tanpa API key) │      │  (Consumet-style, timeout 5 detik)   │
└──────────────────┘      └──────────────┬───────────────────────┘
                                         │ semua gagal → fallback
                                         ▼
                              ┌──────────────────────┐
                              │  Server Demo (built-in)│
                              │  sample MP4 bebas     │
                              │  royalti (selalu aktif)│
                              └──────────────────────┘
          ┌──────────────────────────────────────────────┐
          │  SQLite (better-sqlite3)  ./data/aniverse.db │
          │  users · keys_balance · key_ledger · xp      │
          │  watch_history · ad_watches                  │
          └──────────────────────────────────────────────┘
```

---

## 🚀 Cara Menjalankan (Langkah demi Langkah)

> **Login Demo adalah jalur default — Anda tidak perlu mengatur API key, Google OAuth, maupun provider video apa pun.** Aplikasi langsung bisa dipakai dengan Server Demo.

```bash
# 1. Salin konfigurasi (boleh diedit atau langsung dipakai apa adanya)
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev

# 4. Buka di browser
#    http://localhost:3000

# 5. Klik tombol "Login Demo / Guest" di halaman login
#    → Langsung masuk sebagai "Tamu Demo" dengan 3 kunci awal.
#    → Pilih anime → tonton episode (1 episode = 1 kunci).
#    → Jika kunci habis, wajib nonton iklan penuh (30 detik) → +3 kunci.
```

Database SQLite (`./data/aniverse.db`) dan folder `data/` dibuat **otomatis** saat pertama kali jalan.

---

## 🔐 Setup Google OAuth (Opsional)

Jika ingin login via akun Google (selain Login Demo):

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project.
2. **APIs & Services → OAuth consent screen** → isi app name & email (mode *Testing* cukup untuk demo).
3. **Credentials → Create Credentials → OAuth client ID** → tipe *Web application*.
4. Di **Authorized redirect URIs**, tambahkan:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   (Untuk production, tambahkan juga `https://domain-anda.com/api/auth/callback/google`.)
5. Salin **Client ID** dan **Client Secret** ke `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   ```
6. Restart server. Tombol "Sign in with Google" akan muncul otomatis di halaman login.

Kosongkan kedua variabel tersebut untuk kembali ke mode Login Demo saja.

---

## 🔑 Sistem Kunci & Iklan

| Konsep | Keterangan |
|---|---|
| **Harga** | 1 episode = **1 kunci**, dipotong atomik setelah sumber video siap (`spendKey`). |
| **Anti double-spend** | `UPDATE keys_balance SET keys = keys - 1 WHERE user_id = ? AND keys > 0` dalam transaksi; `changes !== 1` → gagal. |
| **Kunci habis** | Endpoint spend mengembalikan `402 { ok:false, needAd:true, keys:0 }` → client memunculkan `AdModal`. |
| **Nonton iklan** | Default **30 detik** (`AD_DURATION`). Anti-bypass: pindah tab/minimize (`visibilitychange` → `hidden`) atau skip → **progress direset** ke 0. Server memvalidasi via heartbeat. |
| **Reward** | Setelah iklan selesai penuh → klaim `completeAd` → **+3 kunci** (`AD_REWARD_KEYS`), tercatat di ledger dengan reason `ad_reward`. |

---

## 📈 XP & Level

- **Heartbeat** setiap 5 detik dari client, hanya saat `playing === true` **dan** `document.hidden === false`. Server menolak heartbeat yang terlalu cepat atau saat tab tidak aktif.
- **Pendapatan**: `XP_PER_SECOND` (default 1) × detik dalam satu interval heartbeat.
- **Daily cap**: `XP_DAILY_CAP` (default 7200 = ±2 jam nonstop), reset otomatis pada tengah malam.
- **Kurva level**: untuk naik dari level `L` ke `L+1` dibutuhkan `100 × L²` XP (kumulatif). Contoh: level 1→2 = 100 XP, 2→3 = 400 XP, 3→4 = 900 XP, …
- **Reward**: **+1 kunci** setiap kali melewati level kelipatan 5 (5, 10, 15, …), dengan reason `level_up_reward`.
- **Badge**: *Pemula* (1) → *Penonton Setia* (5) → *Anime Lover* (10) → *Wibu Sejati* (20) → *Legenda Aniverse* (50).

---

## 🖥️ Catatan Server Cadangan (WAJIB Dibaca)

Urutan server saat memutar video:

1. **Primary** = provider **pertama** di `ANIME_PROVIDERS` (gaya Consumet).
2. **Backup 1, Backup 2, …** = provider urutan berikutnya (jika ada).
3. **Terakhir = Server Demo** (built-in, **selalu aktif**, video sample bebas royalti).

- **Auto-failover < 5 detik**: setiap upstream diberi timeout 5 detik; jika gagal/timeout/lambat, langsung lanjut ke server berikutnya tanpa intervensi user.
- **Health check** berkala (di-cache 2 menit) menampilkan status tiap server di UI.
- **Tombol manual "Ganti Server"** memungkinkan user memaksa server tertentu (`preferServer`); jika server itu gagal, sistem tetap fall back ke urutan normal.
- **Alasan**: mirror upstream pihak ketiga sering tidak stabil, diblokir, atau mati. Server Demo menjamin aplikasi **selalu bisa dicoba/demo** dalam kondisi apa pun.
- **Batasan hukum**: Aniverse PRO tidak menyediakan konten. Pemilihan upstream dan streaming konten berhak cipta adalah tanggung jawab pengguna. Untuk produksi, gunakan hanya sumber yang Anda miliki izinnya.

---

## 🧪 Testing

```bash
# Unit test (Vitest) — logika kunci, XP, auth, rate-limit, providers
npm run test

# E2E (Playwright) — install browser sekali, lalu jalankan
npm run e2e:install   # install chromium
npm run e2e           # jalankan e2e/flow.spec.ts
```

Laporan Playwright tersedia di `playwright-report/` (HTML).

---

## 🏭 Production Build

```bash
# 1. Pastikan NEXTAUTH_SECRET di .env (WAJIB di production!)
#    openssl rand -base64 32

# 2. Build
npm run build

# 3. Start (default port 3000)
npm start
```

Untuk production di balik reverse proxy (Nginx/Cloudflare):
- Set `NEXTAUTH_URL=https://domain-anda.com`.
- Pastikan `X-Forwarded-For` diteruskan (agar rate limit berbasis IP akurat).
- Aktifkan HTTPS (HSTS di `next.config.mjs` mengharapkan koneksi aman).

---

## 🐳 Docker

```bash
# Build & jalankan (data SQLite persist di ./data host)
docker compose up --build

# Akses: http://localhost:3000
```

- `Dockerfile` multi-stage (builder → runner), user non-root `node`, `better-sqlite3` dikompilasi dengan `python3 make g++ libc6-compat`.
- Volume `./data:/app/data` mem-persist database. Jika permission denied: `mkdir -p data && sudo chown -R 1000:1000 data`.
- Redis (opsional untuk rate limit terdistribusi) sudah disediakan sebagai komentar di `docker-compose.yml`.

---

## 📡 API Docs (Ringkas)

| Endpoint | Method | Auth | Deskripsi |
|---|---|---|---|
| `/api/auth/*` | GET/POST | — | NextAuth: sign in (Google & Demo), callback, session, sign out |
| `/api/health` | GET | Publik | Health check + status/latency tiap server upstream |
| `/api/anime/browse?sort=&page=` | GET | Publik | Daftar anime (trending/populer/top/upcoming) — proxy AniList |
| `/api/anime/search?q=&page=` | GET | Publik | Pencarian anime — proxy AniList |
| `/api/anime/[id]` | GET | Publik | Detail anime + daftar episode + relasi/rekomendasi |
| `/api/anime/watch?animeId=&ep=&server=` | GET | Ya | Resolusi sumber video dengan multi-server failover |
| `/api/user` | GET | Ya | Profil user + saldo kunci + ringkasan XP |
| `/api/keys` | GET | Ya | Saldo kunci saat ini |
| `/api/keys/spend` | POST | Ya | Potong 1 kunci atomik. `402 {needAd:true}` jika habis |
| `/api/keys/ad/start` | POST | Ya | Mulai sesi iklan → `{watchId, durationSec, rewardKeys}` |
| `/api/keys/ad/heartbeat` | POST | Ya | Progress iklan; tab `hidden` → progress direset |
| `/api/keys/ad/complete` | POST | Ya | Klaim reward iklan penuh → `{granted, keys}` |
| `/api/xp` | GET | Ya | Statistik XP, level, progress, badge |
| `/api/xp/heartbeat` | POST | Ya | Heartbeat XP (hanya saat playing+visible; daily cap) |
| `/api/history` | GET | Ya | Riwayat tontonan (terurut, dengan progress) |
| `/api/history` | POST | Ya | Simpan/update progress tontonan (resume playback) |

Semua response JSON berbentuk `{ ok: true, ...data }` atau `{ ok:false, error, ... }`. Error tidak membocorkan stack trace.

---

## 📁 Struktur Folder

```
aniverse-pro/
├── src/
│   ├── app/                    # Next.js App Router (halaman + API routes)
│   │   ├── (halaman: /, /login, /anime/[id], /watch/[id]/[ep],
│   │   │            /dashboard, /history, /profile, /settings)
│   │   └── api/                 # /api/auth, /api/anime, /api/keys, /api/xp,
│   │                             # /api/history, /api/user, /api/health
│   ├── components/              # ui/ · player/ · home/ · watch/ (Plyr+hls, AdModal…)
│   ├── hooks/                   # usePlayer, useKeys, useXp, useServerSelector…
│   ├── lib/                     # Business logic murni (mudah di-unit-test):
│   │   ├── config.ts            #   semua env + default aman
│   │   ├── db.ts                #   koneksi SQLite + migrasi + getOrCreateUser
│   │   ├── keys.ts              #   spend/grant atomik + sesi iklan anti-bypass
│   │   ├── xp.ts                #   kurva level, heartbeat, badge, reward
│   │   ├── providers.ts         #   resolusi video + failover + health check
│   │   ├── anilist.ts           #   client GraphQL AniList (tanpa key)
│   │   ├── auth.ts              #   konfigurasi next-auth (Demo + Google)
│   │   ├── rate-limit.ts        #   sliding window per (IP+user)
│   │   ├── api-helpers.ts       #   requireSession, apiError/apiOk, IP, body guard
│   │   └── types.ts             #   kontrak tipe bersama (single source of truth)
│   ├── styles/globals.css
│   └── types/next-auth.d.ts     #   ekstensi session.user (id, isDemo)
├── public/                      # manifest.json, icon.svg, sw.js, offline.html
├── e2e/flow.spec.ts             # Playwright E2E (login → iklan → kunci → XP → ganti server)
├── tests/                       # Vitest unit tests
├── data/                        # SQLite (auto-created, di-gitignore)
├── Dockerfile · docker-compose.yml
├── next.config.mjs              # security headers (CSP/HSTS/X-Frame-Options…)
├── playwright.config.ts · vitest.config.ts · tsconfig.json
└── .env.example · .gitignore · .dockerignore
```

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---|---|
| **`better-sqlite3` build error** saat `npm install` | Install build tools: Ubuntu/Debian `sudo apt install build-essential python3`; macOS `xcode-select --install`; Alpine (Docker) sudah disertakan `python3 make g++ libc6-compat`. Pastikan Node.js ≥ 18. |
| **Video tidak mau diputar / upstream error** | Aplikasi otomatis fall back ke Server Demo. Jika ingin upstream tertentu, periksa `ANIME_PROVIDERS` di `.env` dan status via `/api/health`. Gunakan tombol **"Ganti Server"** di halaman tonton. |
| **Login Google error / tombol tidak muncul** | Pastikan `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` terisi dan **Authorized redirect URI** di Google Console persis `http://localhost:3000/api/auth/callback/google` (atau domain production). Restart server setelah mengubah `.env`. |
| **`permission denied` menulis `./data/aniverse.db` di Docker** | `mkdir -p data && sudo chown -R 1000:1000 data` (user `node` di container ber-uid 1000). |
| **Rate limit 429 saat testing** | Default 30 req/menit per (IP+user). Naikkan `RATE_LIMIT_PER_MIN` di `.env` untuk development. |
| **XP tidak bertambah** | Pastikan tab aktif (tidak di-minimize) dan video benar-benar *playing* (tidak pause/buffer). Periksa `XP_DAILY_CAP` — mungkin sudah mencapai batas harian (reset tengah malam). |
| **Iklan selalu reset** | Itu perilaku yang disengaja (anti-bypass): pindah tab/minimize/skip akan mereset progress. Biarkan tab terbuka & terlihat selama durasi iklan. |
| **`NEXTAUTH_URL` mismatch di production** | Set `NEXTAUTH_URL` persis dengan domain publik (termasuk `https://`). Pastikan `NEXTAUTH_SECRET` diisi (wajib). |

---

<div align="center">
<sub>Dibuat untuk tujuan edukasi · Aniverse PRO · Next.js 14 + TypeScript + SQLite</sub>
</div>

---

## 🚀 Deploy ke Vercel (langkah demi langkah)

Project sudah **Vercel-ready**. Catatan penting: Vercel serverless punya filesystem read-only (hanya `/tmp` yang writable & ephemeral) dan default Node-nya bisa lebih baru dari yang didukung `better-sqlite3`. Project ini sudah mengatasinya:

1. **Versi Node dipin ke 20.x** via `package.json` → `"engines": {"node": "20.x"}` dan file `.nvmrc` berisi `20`. Vercel membaca keduanya, sehingga `npm install` memakai prebuilt binary `better-sqlite3` (tidak perlu compile via node-gyp).
2. **Storage adapter otomatis** (`src/lib/storage/`):
   - Jika `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` di-set → pakai **Turso/libSQL** (pure JS, tanpa native module, persisten — direkomendasikan untuk production di Vercel).
   - Jika `DATABASE_PATH` di-set → pakai SQLite di `/tmp/aniverse-pro.db` (ephemeral per instance).
   - Jika berjalan di Vercel tanpa keduanya → fallback **in-memory Map** (data hilang saat cold start, tapi aplikasi tetap berfungsi penuh untuk demo).

### Langkah deploy
1. Push project ke GitHub/GitLab.
2. Di Vercel → **Add New → Project** → import repo. Framework preset: **Next.js** (auto-detect).
3. Buka tab **Environment Variables**, tambahkan:
   | Variabel | Wajib? | Isi |
   |---|---|---|
   | `NEXTAUTH_SECRET` | ✅ wajib | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | ✅ wajib | `https://domain-kamu.vercel.app` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | opsional | isi jika ingin Login Google |
   | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | opsional (disarankan) | dari turso.tech agar data persisten |
   | `ANIME_PROVIDERS` | opsional | provider video upstream (kosongkan = Server Demo) |
4. **Deploy**. Build akan sukses karena Node 20 + Turso adapter tanpa native module.
5. Setelah live, tambahkan **Authorized redirect URI** Google OAuth (jika dipakai): `https://domain-kamu.vercel.app/api/auth/callback/google`.

### Tanpa Turso?
Aplikasi tetap jalan (Login Demo, kunci, XP, iklan, Server Demo semua berfungsi), tapi data user (kunci/XP/riwayat) disimpan **in-memory** dan hilang setiap cold start / instance baru. Cocok untuk demo/penilaian; untuk production wajib tambahkan Turso (gratis tier pemula).

### Troubleshooting khas Vercel
- **Build gagal `better-sqlite3` / node-gyp / V8 API error** → pastikan `engines.node = "20.x"` dan `.nvmrc = 20` ada (sudah disertakan). Jika masih, set Project Settings → Node.js Version → 20.x.
- **Data hilang setelah beberapa menit** → itu in-memory fallback; tambahkan `TURSO_*` untuk persistensi.
- **Login Demo error / redirect loop** → pastikan `NEXTAUTH_URL` persis sama dengan domain Vercel (termasuk https).

---
## 🆕 Changelog v2 (7 fitur pengguna baru)

Semua fitur v2 tersimpan **per-user** via storage adapter yang sama (sqlite / Turso / in-memory) — interface di-extend, tidak di-break. Tidak ada kode placeholder/TODO.

| # | Fitur | Cara kerja |
|---|---|---|
| 1 | **Lanjut Tonton (Continue Watching)** | Progress detik per (user, anime, episode) disimpan via heartbeat history. Baris "Lanjut Tonton" di Home menampilkan poster + progress bar + resume ke posisi terakhir (`/watch/[id]/[ep]?t=<detik>` → player seek otomatis). |
| 2 | **Watchlist / Bookmark** | Tombol di halaman detail & player. Status otomatis: `watching` saat mulai nonton, `completed` saat episode terakhir selesai. Halaman `/watchlist` dengan filter tab (Semua/Sedang Ditonton/Selesai/Rencana). 1 user = 1 baris/anime (upsert). |
| 3 | **Rating & Ulasan** | Widget bintang 1-5 + ulasan teks opsional (maks 500 karakter, disanitasi) di halaman detail. Menampilkan rata-rata rating komunitas Aniverse + jumlah pemberi. 1 user = 1 rating/anime (upsert). |
| 4 | **Komentar per episode** | Section di bawah player. Login wajib, maks 500 karakter, strip-tag sanitasi, rate limit global. Avatar/nama/waktu relatif + badge "Demo". Tanpa balas nested (scope). |
| 5 | **Rekomendasi personal** | Endpoint `/api/recommendations`: algoritma content-based sederhana — genre overlap dari watchlist + rating tinggi user vs katalog AniList, di-score, dedupe yang sudah ditonton. **Bukan ML.** Fallback ke trending jika data user kurang atau AniList gagal. |
| 6 | **Notifikasi episode baru** | Badge lonceng di navbar (poll 60s). Dihitung dari `nextAiringEpisode` AniList untuk anime di watchlist, dibanding timestamp kunjungan terakhir (disimpan di `user_meta`). Halaman `/notifications`. Tanpa push server (in-app saja). |
| 7 | **Download / Tonton Nanti** | **Jujur**: stream HLS/m3u8 pihak ketiga TIDAK bisa di-download dari browser (CORS). Diimplementasikan sebagai **Queue Tonton Nanti** (`/downloads`) + tombol download asli `<a download>` **hanya untuk Server Demo** (mp4 publik). Batasan ini ditampilkan di UI. |

### Migrasi Database (otomatis, idempoten)
- **SQLite & Turso**: 5 tabel baru (`watchlist`, `ratings`, `comments`, `user_meta`, `download_queue`) dibuat via `CREATE TABLE IF NOT EXISTS` saat adapter pertama kali dipakai — **tidak perlu langkah manual**, data lama tetap utuh.
- **In-memory**: tabel dibuat otomatis di Map (ephemeral per cold start).
- Tidak ada perubahan pada tabel v1 — upgrade aman tanpa downtime.

### Endpoint API baru (v2, semua auth kecuali disebut)
| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/watchlist` | GET/POST/DELETE | List (filter ?status=), upsert, hapus |
| `/api/ratings?animeId=` | GET/POST | {avg, count, userRating} + upsert rating |
| `/api/comments?animeId=&ep=` | GET/POST | List + post komentar episode |
| `/api/recommendations` | GET | Rekomendasi personal (fallback trending) |
| `/api/notifications` | GET/POST | List notifikasi + tandai sudah dilihat |
| `/api/download-queue` | GET/POST/DELETE | Queue tonton nanti |

### Testing v2
`tests/v2.test.ts` — 6 test: watchlist add/remove/idempotent, filter status, rating upsert (1 user 1 rating, avg benar), progress/history upsert (tidak duplikat), download queue add/remove, user meta KV. Total 15 test (9 v1 + 6 v2), semua lolos.

### Batasan yang dicatat jujur
- Rekomendasi berbasis genre overlap sederhana, bukan personalisasi ML.
- Notifikasi dihitung saat request (poll), bukan push realtime.
- Download asli hanya untuk Server Demo mp4; stream pihak ketiga hanya bisa di-antri "tonton nanti".
- Di Vercel tanpa Turso, semua data v2 juga in-memory (ephemeral) — sama seperti v1.
