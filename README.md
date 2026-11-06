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
