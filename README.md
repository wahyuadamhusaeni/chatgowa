# 🚀 Chatgowa

> **Webhook forwarder dari Chatwoot ke GoWA (WhatsApp)**
> Setiap webhook route dipetakan berdasarkan Inbox ID Chatwoot.

---

## 📋 Daftar Isi

- [Deskripsi Aplikasi](#-deskripsi-aplikasi)
- [Arsitektur Singkat](#-arsitektur-singkat)
- [Cara Setup & Menjalankan](#-cara-setup--menjalankan)
- [Variabel Environment](#-variabel-environment)
- [Endpoint API](#-endpoint-api)
- [Daftar Bug & Kemungkinan Bug](#-daftar-bug--kemungkinan-bug)

---

## 📖 Deskripsi Aplikasi

**Chatgowa** adalah layanan webhook forwarder ringan yang menjembatani **Chatwoot** (platform customer support) dengan **GoWA** (WhatsApp gateway berbasis Go).

Ketika Chatwoot mengirimkan webhook event (misalnya pesan masuk dari pelanggan), Chatgowa menerima event tersebut dan meneruskannya ke endpoint GoWA yang sesuai. Pemetaan dilakukan berdasarkan **Inbox ID** Chatwoot — setiap inbox bisa diarahkan ke URL GoWA yang berbeda.

**Kegunaan utama:**
- Meneruskan event Chatwoot secara real-time ke GoWA
- Mendukung banyak inbox dengan routing yang berbeda-beda
- Menyediakan admin panel sederhana untuk mengelola route via web

---

## 🏗️ Arsitektur Singkat

### Stack Teknologi

| Komponen | Teknologi |
|---|---|
| Web Framework | [Hono](https://hono.dev/) — lightweight, edge-ready |
| ORM & Database | [Prisma](https://www.prisma.io/) + SQLite |
| Runtime | Node.js (via `tsx` untuk dev, atau dikompilasi dengan `tsc`) |
| Containerisasi | Docker + Docker Compose |
| Auth Admin | HTTP Basic Auth |

### Flow Data

```
Chatwoot
   │
   │  POST /webhook
   ▼
Chatgowa (Hono)
   │
   │  1. Baca body JSON
   │  2. Ekstrak inbox_id dari payload
   │  3. Lookup route di SQLite (via Prisma)
   │  4. Forward payload ke webhookUrl yang terdaftar
   ▼
GoWA (WhatsApp Gateway)
```

### Struktur Direktori

```
chatgowa/
├── src/
│   ├── index.ts            # Entry point, setup Hono app
│   ├── routes/
│   │   ├── webhook.ts      # POST /webhook — terima & forward dari Chatwoot
│   │   └── admin.ts        # Admin panel HTML + API CRUD route
│   ├── middleware/
│   │   └── basicAuth.ts    # HTTP Basic Auth middleware
│   └── generated/
│       └── prisma/         # Prisma generated client (auto-generated)
├── prisma/
│   ├── schema.prisma       # Definisi model database
│   └── dev.db              # SQLite database file (runtime)
├── prisma.config.ts        # Konfigurasi Prisma 7 (DATABASE_URL dsb.)
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

---

## ⚙️ Cara Setup & Menjalankan

### Prasyarat

- Node.js >= 18
- npm >= 9
- Docker & Docker Compose (opsional, untuk deployment)

---

### 🖥️ Local Development

**1. Clone repository**

```bash
git clone https://github.com/your-org/chatgowa.git
cd chatgowa
```

**2. Install dependencies**

```bash
npm install
```

**3. Salin dan konfigurasi environment**

```bash
cp .env.example .env
# Edit .env sesuai kebutuhan
```

**4. Inisialisasi database**

```bash
npx prisma db push
# atau jika menggunakan migrations:
npx prisma migrate dev
```

**5. Jalankan aplikasi**

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000` (atau port yang dikonfigurasi via `PORT`).

---

### 🐳 Docker / Production

**Menggunakan Docker Compose (rekomendasi):**

```bash
# Salin dan konfigurasi environment
cp .env.example .env

# Build dan jalankan
docker compose up -d --build

# Cek log
docker compose logs -f
```

**Menggunakan Docker manual:**

```bash
# Build image
docker build -t chatgowa .

# Jalankan container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="file:/app/prisma/dev.db" \
  -e BASIC_AUTH_USER="admin" \
  -e BASIC_AUTH_PASS="supersecret" \
  -v chatgowa_data:/app/prisma \
  --name chatgowa \
  chatgowa
```

---

## 🔐 Variabel Environment

Salin `.env.example` menjadi `.env` dan isi nilai yang sesuai.

| Variabel | Wajib | Default | Deskripsi |
|---|---|---|---|
| `PORT` | Tidak | `3000` | Port HTTP yang didengarkan aplikasi |
| `DATABASE_URL` | Ya | — | Path ke file SQLite, contoh: `file:/app/prisma/dev.db` |
| `BASIC_AUTH_USER` | Ya | — | Username untuk akses admin panel |
| `BASIC_AUTH_PASS` | Ya | `password` ⚠️ | Password untuk akses admin panel |

> ⚠️ **Peringatan:** Selalu set `BASIC_AUTH_PASS` secara eksplisit di production. Jangan andalkan nilai default.

**Contoh `.env`:**

```env
PORT=3000
DATABASE_URL=file:/app/prisma/dev.db
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=ganti_dengan_password_kuat
```

---

## 📡 Endpoint API

### Webhook (Publik)

#### `POST /webhook`

Menerima webhook dari Chatwoot dan meneruskannya ke GoWA berdasarkan `inbox_id`.

**Request Body** (dikirim otomatis oleh Chatwoot):

```json
{
  "inbox_id": 42,
  "event": "message_created",
  "data": { "...": "..." }
}
```

**Response:**

| Status | Kondisi |
|---|---|
| `200 OK` | Webhook berhasil diteruskan ke GoWA |
| `404 Not Found` | Tidak ada route yang terdaftar untuk `inbox_id` tersebut |
| `502 Bad Gateway` | GoWA merespons dengan status error |

---

### Admin Panel (Dilindungi Basic Auth)

Semua endpoint admin memerlukan header `Authorization: Basic <base64(user:pass)>`.

#### `GET /admin`

Menampilkan halaman HTML admin panel untuk mengelola route.

---

#### `GET /admin/routes`

Mengambil daftar semua route yang terdaftar.

**Response:**

```json
[
  {
    "id": 1,
    "inboxId": 42,
    "webhookUrl": "http://gowa-host:3000/send",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### `POST /admin/routes`

Membuat route baru.

**Request Body:**

```json
{
  "inboxId": 42,
  "webhookUrl": "http://gowa-host:3000/send"
}
```

**Response:** `201 Created` dengan objek route yang baru dibuat.

---

#### `PUT /admin/routes/:id`

Memperbarui route yang sudah ada.

**Request Body:**

```json
{
  "inboxId": 42,
  "webhookUrl": "http://gowa-host-baru:3000/send"
}
```

**Response:** `200 OK` dengan objek route yang telah diperbarui.

---

#### `DELETE /admin/routes/:id`

Menghapus route berdasarkan ID.

**Response:** `200 OK` atau `404 Not Found` jika route tidak ditemukan.

---

## 🐛 Daftar Bug & Kemungkinan Bug

Berikut adalah daftar bug dan potensi masalah yang ditemukan dari analisis kode. Bagian ini sangat penting untuk diperhatikan sebelum deployment ke production.

---

### 🔴 BUG 1 — `dotenv` ada di `devDependencies`, bukan `dependencies`

**File:** `package.json`

**Masalah:**
`import 'dotenv/config'` digunakan di `src/index.ts` untuk memuat environment variables, namun paket `dotenv` terdaftar di `devDependencies`. Ketika Docker image dibangun dengan `npm ci --omit=dev` (praktik umum di production), `dotenv` tidak akan terinstall. Akibatnya, environment variables tidak akan terbaca dan aplikasi akan crash saat startup dengan error `Cannot find module 'dotenv/config'`.

**Saran Perbaikan:**

Pindahkan `dotenv` dari `devDependencies` ke `dependencies` di `package.json`:

```json
{
  "dependencies": {
    "dotenv": "^16.x.x",
    "@hono/node-server": "...",
    "hono": "...",
    "@prisma/client": "..."
  },
  "devDependencies": {
    // dotenv TIDAK boleh ada di sini
    "tsx": "...",
    "typescript": "...",
    "prisma": "..."
  }
}
```

Kemudian jalankan:
```bash
npm install
```

---

### 🔴 BUG 2 — `src/generated/prisma` tidak di-copy secara eksplisit ke runner stage

**File:** `Dockerfile`

**Masalah:**
`npx prisma generate` dijalankan di builder stage dan menghasilkan Prisma client ke `src/generated/prisma/`. Runner stage melakukan `COPY --from=builder /app/src ./src` yang secara kebetulan menyertakan folder generated tersebut. Namun, jika ada `.dockerignore` yang mengecualikan subfolder tertentu, atau jika path berubah di versi Prisma mendatang, folder generated tidak akan tersalin dan runtime akan melempar error `Cannot find module '.../generated/prisma'`.

**Saran Perbaikan:**

Tambahkan copy eksplisit untuk folder generated di Dockerfile:

```dockerfile
# Di runner stage, tambahkan baris ini secara eksplisit:
COPY --from=builder /app/src/generated ./src/generated
# Atau alternatif, copy node_modules Prisma client:
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
```

Dengan copy eksplisit, tidak ada ambiguitas dan lebih tahan terhadap perubahan konfigurasi.

---

### 🟡 BUG 3 — `schema.prisma` tidak punya field `url` di datasource

**File:** `prisma/schema.prisma`

**Masalah:**
Datasource di `schema.prisma` hanya mendefinisikan `provider = "sqlite"` tanpa `url`. URL database dikonfigurasi via `prisma.config.ts` (pola baru Prisma 7). Jika developer lain (atau CI/CD pipeline) menjalankan `prisma migrate dev` atau `prisma db push` secara langsung tanpa `prisma.config.ts` aktif, Prisma akan menggunakan lokasi default yang tidak terduga atau gagal dengan error konfigurasi.

**Saran Perbaikan:**

Tambahkan `url` sebagai fallback di `schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Ini memastikan perintah Prisma CLI standar tetap bekerja selama `DATABASE_URL` di-set di environment.

---

### 🟡 BUG 4 — Default password tidak konsisten antara code dan dokumentasi

**File:** `src/middleware/basicAuth.ts`

**Masalah:**
Terdapat inkonsistensi nilai default password:
- Di `basicAuth.ts`: `process.env.BASIC_AUTH_PASS || 'password'`
- Di `.env.example`: `BASIC_AUTH_PASS=yourpassword`
- Di `docker-compose.yml`: `BASIC_AUTH_PASS=yourpassword`

Operator yang tidak mengatur env var ini akan mengira password defaultnya adalah `"yourpassword"` (sesuai dokumentasi), padahal password aktual yang berlaku di kode adalah `"password"`. Ini menciptakan kebingungan dan potensi masalah keamanan.

**Saran Perbaikan:**

Pilih salah satu pendekatan:

**Opsi A:** Samakan semua default menjadi satu nilai:
```typescript
// basicAuth.ts
const validPass = process.env.BASIC_AUTH_PASS || 'yourpassword'
```

**Opsi B (lebih aman):** Hapus hardcoded default dan wajibkan env var:
```typescript
// basicAuth.ts
const validPass = process.env.BASIC_AUTH_PASS
if (!validPass) {
  throw new Error('BASIC_AUTH_PASS environment variable is required')
}
```

---

### 🔴 BUG 5 — Password dengan karakter `:` akan terpotong (truncated)

**File:** `src/middleware/basicAuth.ts`

**Masalah:**
Parsing Basic Auth credentials dilakukan dengan:
```typescript
const [username, password] = decoded.split(':')
```

Standar Basic Auth (RFC 7617) menyatakan bahwa hanya karakter `:` **pertama** yang menjadi pemisah antara username dan password. Password boleh mengandung karakter `:`. Dengan `split(':')` dan array destructuring, password seperti `p:a:s:s` hanya akan mengambil `"p"` sebagai password, karena hanya index `[0]` dan `[1]` yang diambil.

**Saran Perbaikan:**

Gunakan `indexOf` dan `slice` untuk memisahkan hanya pada `:` pertama:

```typescript
const colonIndex = decoded.indexOf(':')
if (colonIndex === -1) {
  return c.text('Unauthorized', 401)
}
const username = decoded.slice(0, colonIndex)
const password = decoded.slice(colonIndex + 1)
```

---

### 🟡 BUG 6 — `inbox_id = 0` di-ignore karena falsy check

**File:** `src/routes/webhook.ts`

**Masalah:**
Pengecekan keberadaan `inbox_id` dilakukan dengan:
```typescript
if (!inboxId) {
  return c.json({ error: 'Missing inbox_id' }, 400)
}
```

Angka `0` adalah nilai falsy di JavaScript, sehingga jika Chatwoot mengirimkan `inbox_id: 0` (edge case yang valid secara teknis), webhook akan ditolak dengan respons 400 tanpa ada pesan error yang jelas atau log yang memadai. Event tersebut akan di-silent-drop tanpa bisa di-debug.

**Saran Perbaikan:**

Gunakan pengecekan eksplisit untuk `null` dan `undefined`:

```typescript
if (inboxId === undefined || inboxId === null) {
  return c.json({ error: 'Missing inbox_id' }, 400)
}
```

Atau lebih aman, gunakan pemeriksaan tipe:
```typescript
if (typeof inboxId !== 'number') {
  return c.json({ error: 'Invalid or missing inbox_id' }, 400)
}
```

---

### 🔴 BUG 7 — Tidak ada timeout pada outgoing `fetch` ke GoWA

**File:** `src/routes/webhook.ts`

**Masalah:**
Permintaan HTTP ke GoWA dilakukan tanpa timeout:
```typescript
const response = await fetch(route.webhookUrl, { method: 'POST', body: ... })
```

Jika GoWA lambat merespons atau server mati, `fetch` ini akan menggantung (hang) tanpa batas waktu. Akibatnya:
1. Chatwoot akan timeout menunggu respons dari Chatgowa
2. Chatwoot akan mencoba mengirim ulang (retry) webhook yang sama
3. Terjadi akumulasi request yang menggantung → memory leak
4. Potensi duplikasi pengiriman pesan ke WhatsApp

**Saran Perbaikan:**

Tambahkan timeout menggunakan `AbortController`:

```typescript
const controller = new AbortController()
const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || '10000')
const timeout = setTimeout(() => controller.abort(), timeoutMs)

try {
  const response = await fetch(route.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
  // handle response...
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    return c.json({ error: 'Upstream timeout' }, 504)
  }
  throw err
} finally {
  clearTimeout(timeout)
}
```

---

### 🟡 BUG 8 — Dockerfile CMD menggunakan `tsx` (devDependency) di production

**File:** `Dockerfile`

**Masalah:**
Runner stage di Dockerfile menggunakan:
```dockerfile
CMD ["npx", "tsx", "src/index.ts"]
```

`tsx` adalah tool untuk menjalankan TypeScript secara langsung dan terdaftar sebagai `devDependency`. Ini bekerja saat ini karena `node_modules` di-copy dari builder stage yang menginstall semua dependencies (termasuk dev). Namun ini adalah praktik yang fragile:
- Semantically salah: production image seharusnya tidak bergantung pada devDependency
- Jika runner stage dikonfigurasi ulang untuk menjalankan `npm ci --omit=dev`, `tsx` tidak akan tersedia
- `tsx` menambah overhead transpilasi TypeScript di setiap startup yang tidak perlu di production

**Saran Perbaikan:**

**Opsi A:** Kompilasi TypeScript dan jalankan JavaScript hasil kompilasi:
```dockerfile
# Builder stage
RUN npm run build  # tsc → output ke dist/

# Runner stage
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

**Opsi B:** Pindahkan `tsx` ke `dependencies` jika memang ingin tetap pakai tsx di production:
```json
{
  "dependencies": {
    "tsx": "^4.x.x"
  }
}
```

Opsi A lebih direkomendasikan untuk production karena lebih performant dan tidak membawa tooling development ke runtime.

---

### 🔴 BUG 9 — `npx prisma db push` di Dockerfile membuat database "baked" ke image layer

**File:** `Dockerfile`

**Masalah:**
Build step berikut di Dockerfile:
```dockerfile
RUN npx prisma db push
```

Perintah ini membuat file `dev.db` di dalam image layer saat waktu build. Masalah yang ditimbulkan:

1. **Schema drift:** Jika schema database berubah (ada migrasi baru), volume Docker yang sudah ada tetap menggunakan schema lama. Tidak ada mekanisme otomatis untuk menerapkan migrasi terbaru saat container restart.
2. **State baked ke image:** Database kosong yang dibuat saat build tersimpan di image layer, bukan di volume yang persisten. Ini bertentangan dengan prinsip immutable infrastructure.
3. **Tidak ada `prisma migrate deploy`:** Tidak ada entrypoint yang menjalankan migrasi sebelum server start, sehingga schema di database bisa tidak sinkron dengan kode.

**Saran Perbaikan:**

Buat file `entrypoint.sh`:
```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node dist/index.js
```

Update Dockerfile:
```dockerfile
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Hapus: RUN npx prisma db push
CMD ["./entrypoint.sh"]
```

Pastikan juga migrations folder ada dan ter-generate dengan benar:
```bash
npx prisma migrate dev --name init  # buat migration awal
```

---

### 🟡 BUG 10 — Client-side `escapeJs` di admin HTML punya regex escaping error

**File:** `src/routes/admin.ts` (bagian inline `<script>`)

**Masalah:**
Terdapat dua implementasi fungsi `escapeJs` — satu di server-side (TypeScript) dan satu di client-side (embedded JavaScript dalam HTML):

```typescript
// Server-side (TypeScript) — BENAR
function escapeJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')   // match satu backslash → ganti dua backslash
    .replace(/'/g, "\\'")
}
```

```javascript
// Client-side (embedded dalam HTML string) — SALAH
function escapeJs(str) {
  return str
    .replace(/\\\\/g, '\\\\\\\\')  // match DUA backslash, bukan satu!
    .replace(/'/g, "\\'")
}
```

Karena regex di-embed di dalam string template JavaScript di TypeScript, terjadi double-escaping saat string di-render ke HTML. Regex `/\\\\/g` dalam source TypeScript menjadi `/\\/g` di HTML (match dua backslash), bukan `/\\/g` (match satu backslash). Akibatnya, URL webhook yang mengandung satu backslash tidak akan di-escape dengan benar di sisi client, berpotensi menyebabkan JavaScript syntax error atau celah XSS.

**Saran Perbaikan:**

Perbaiki regex di client-side embedded JavaScript agar konsisten dengan server-side:

```javascript
// Di dalam template string HTML di admin.ts
// Pastikan regex yang ter-render di HTML adalah /\\/g (match satu backslash)
function escapeJs(str) {
  return str
    .replace(/\\/g, '\\\\')   // ini yang benar di HTML output
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003C')  // tambahan: cegah </script> injection
}
```

Atau solusi yang lebih robust: gunakan `JSON.stringify` untuk encoding data dari server ke client alih-alih escaping manual, karena `JSON.stringify` sudah handle semua edge case dengan benar:

```typescript
// Di server-side, inject data sebagai JSON
const routesJson = JSON.stringify(routes)
const html = `<script>const routes = ${routesJson};</script>`
```

---

### ⚠️ MINOR — Tidak ada limit ukuran body pada `/webhook`

**File:** `src/routes/webhook.ts`

**Masalah:**
Endpoint `POST /webhook` tidak memiliki batasan ukuran request body. Payload besar dari Chatwoot yang salah konfigurasi, atau dari pihak yang tidak bertanggung jawab yang menemukan endpoint ini, dapat menguras memori server dan menjadi vektor serangan Denial of Service (DoS).

**Saran Perbaikan:**

Tambahkan middleware pembatas ukuran body. Contoh dengan Hono:

```typescript
import { bodyLimit } from 'hono/body-limit'

app.use('/webhook', bodyLimit({
  maxSize: 1 * 1024 * 1024, // 1 MB
  onError: (c) => {
    return c.json({ error: 'Payload too large' }, 413)
  },
}))
```

---

### ⚠️ MINOR — Build script `tsc` tidak digunakan di Docker workflow

**File:** `Dockerfile`, `package.json`

**Masalah:**
`package.json` mendefinisikan:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Namun Dockerfile tidak pernah memanggil `npm run build` maupun `npm start`. Docker langsung menjalankan TypeScript source via `tsx`, membuat script `build` dan `start` menjadi menyesatkan (misleading) — developer baru akan mengira production menggunakan `dist/index.js` padahal tidak.

**Saran Perbaikan:**

Selaraskan Dockerfile dengan npm scripts:

```dockerfile
# Builder stage
RUN npm run build  # panggil tsc, output ke dist/

# Runner stage
CMD ["npm", "start"]  # jalankan node dist/index.js
```

Atau hapus script `build` dan `start` dari `package.json` jika memang tidak digunakan, untuk menghindari kebingungan.

---

## 📊 Ringkasan Bug

| # | Severity | File | Deskripsi Singkat |
|---|---|---|---|
| 1 | 🔴 Critical | `package.json` | `dotenv` di devDependencies → crash di production |
| 2 | 🔴 Critical | `Dockerfile` | Generated Prisma client tidak di-copy eksplisit |
| 3 | 🟡 Medium | `prisma/schema.prisma` | Tidak ada `url` fallback di datasource |
| 4 | 🟡 Medium | `basicAuth.ts` | Default password inkonsisten antara code & docs |
| 5 | 🔴 Critical | `basicAuth.ts` | Password dengan karakter `:` terpotong |
| 6 | 🟡 Medium | `webhook.ts` | `inbox_id = 0` di-ignore karena falsy check |
| 7 | 🔴 Critical | `webhook.ts` | Tidak ada timeout pada fetch ke GoWA → hang |
| 8 | 🟡 Medium | `Dockerfile` | CMD pakai `tsx` devDependency di production |
| 9 | 🔴 Critical | `Dockerfile` | `db push` di build time → schema drift di production |
| 10 | 🟡 Medium | `admin.ts` | Client-side `escapeJs` regex salah → potensi XSS |
| M1 | ⚠️ Minor | `webhook.ts` | Tidak ada body size limit → vektor DoS |
| M2 | ⚠️ Minor | `Dockerfile` + `package.json` | Build script tidak dipakai → misleading |

---

## 📄 Lisensi

MIT License — lihat file [LICENSE](./LICENSE) untuk detail.

---

*Dokumentasi ini dibuat berdasarkan analisis kode Chatgowa. Pastikan semua bug di atas diperbaiki sebelum deployment ke production.*
