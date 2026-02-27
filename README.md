# Chatgowa

Jembatan webhook antara [Chatwoot](https://github.com/chatwoot/chatwoot) dan [GoWA (go-whatsapp-web-multidevice)](https://github.com/aldinokemal/go-whatsapp-web-multidevice).

Ketika Chatwoot mengirimkan webhook event, Chatgowa meneruskannya ke instance GoWA yang sesuai berdasarkan **Inbox ID** Chatwoot. Setiap inbox bisa diarahkan ke URL GoWA yang berbeda, sehingga satu server Chatgowa dapat mengelola banyak nomor WhatsApp sekaligus.

---

## Cara Kerja

```
Chatwoot  ──POST /webhook──►  Chatgowa  ──forward──►  GoWA Instance A
                                  │
                                  └──────────────────►  GoWA Instance B
                                  │
                                  └──────────────────►  GoWA Instance C
```

1. Chatwoot mengirim webhook ke endpoint `POST /webhook` setiap kali ada event (pesan masuk, status berubah, dll.)
2. Chatgowa membaca `inbox_id` dari payload
3. Chatgowa mencari URL tujuan di database berdasarkan `inbox_id` tersebut
4. Payload diteruskan secara utuh ke URL GoWA yang terdaftar

Pemetaan inbox ke URL dikelola lewat admin panel berbasis web yang dilindungi HTTP Basic Auth.

---

## Tentang Chatwoot dan GoWA

**[Chatwoot](https://github.com/chatwoot/chatwoot)** adalah platform customer support open-source yang mendukung banyak channel komunikasi termasuk WhatsApp, email, live chat, Telegram, dan lainnya. Chatwoot dapat dikonfigurasi untuk mengirimkan webhook setiap kali ada event percakapan.

**[GoWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice)** adalah WhatsApp REST API yang dibangun dengan Go. GoWA menyediakan API HTTP untuk mengirim pesan WhatsApp, mengelola grup, menerima webhook dari WhatsApp, dan mendukung multi-device dalam satu instance.

---

## Stack Teknologi

| Komponen | Teknologi | Keterangan |
|---|---|---|
| Web framework | [Hono](https://hono.dev/) v4 | Lightweight, TypeScript-native |
| Runtime | Node.js 20 | Dijalankan via compiled `dist/` |
| Database | SQLite | File-based, tanpa server tambahan |
| ORM | [Prisma](https://www.prisma.io/) v7 | Driver adapter `better-sqlite3` |
| Autentikasi | HTTP Basic Auth | Melindungi admin panel |
| Container | Docker + Docker Compose | Production-ready |

---

## Struktur Direktori

```
chatgowa/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/
│   │   ├── webhook.ts        # POST /webhook — terima & forward dari Chatwoot
│   │   └── admin.ts          # Admin panel (HTML + REST API CRUD)
│   ├── middleware/
│   │   └── basicAuth.ts      # HTTP Basic Auth middleware
│   └── lib/
│       └── prisma.ts         # Prisma client singleton
├── prisma/
│   ├── schema.prisma         # Definisi model WebhookRoute
│   └── migrations/           # Migration SQL
├── prisma.config.ts          # Konfigurasi Prisma 7
├── entrypoint.sh             # Jalankan migrasi lalu start server
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Menjalankan Aplikasi

### Prasyarat

- Node.js >= 18
- npm >= 9
- Docker & Docker Compose (untuk deployment)

### Development

```bash
# Clone dan masuk ke direktori
git clone <repo-url>
cd chatgowa

# Install dependencies
npm install

# Salin konfigurasi
cp .env.example .env

# Inisialisasi database
npx prisma migrate dev

# Jalankan dalam mode watch
npm run dev
```

Server berjalan di `http://localhost:3000`.

### Production dengan Docker

```bash
# Salin dan sesuaikan konfigurasi
cp .env.example .env

# Build dan jalankan
docker compose up -d --build

# Cek log
docker compose logs -f
```

Docker akan:
1. Compile TypeScript ke `dist/` menggunakan `tsc`
2. Install hanya production dependencies
3. Menjalankan `prisma migrate deploy` setiap container start
4. Menjalankan server via `node dist/index.js`

Database SQLite disimpan di Docker volume `chatgowa-db` sehingga persisten saat container restart atau rebuild.

---

## Konfigurasi Environment

Salin `.env.example` menjadi `.env` dan sesuaikan:

```env
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=yourpassword
FETCH_TIMEOUT_MS=10000
```

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port HTTP server |
| `DATABASE_URL` | `file:./prisma/dev.db` | Path file SQLite. Untuk Docker: `file:/app/prisma/dev.db` |
| `BASIC_AUTH_USER` | `admin` | Username admin panel |
| `BASIC_AUTH_PASS` | `yourpassword` | Password admin panel |
| `FETCH_TIMEOUT_MS` | `10000` | Timeout (ms) saat meneruskan webhook ke GoWA |

---

## Endpoint

### `POST /webhook`

Menerima webhook dari Chatwoot. Endpoint ini didaftarkan di pengaturan webhook Chatwoot.

```
https://chatgowa.yourdomain.com/webhook
```

Chatwoot akan mengirim payload JSON yang berisi `inbox_id`. Chatgowa mencari route yang sesuai dan meneruskan payload secara utuh ke URL GoWA terdaftar.

Selalu merespons `200 OK` agar Chatwoot tidak melakukan retry, meskipun inbox tidak terdaftar atau terjadi error saat forward.

### `GET /admin`

Membuka admin panel berbasis web. Dilindungi HTTP Basic Auth.

### `GET /admin/routes`

Mengambil semua route yang terdaftar dalam format JSON.

### `POST /admin/routes`

Mendaftarkan route baru.

```json
{
  "inboxId": 42,
  "webhookUrl": "http://gowa-instance-a:3000/chatwoot/webhook",
  "name": "Nomor Utama"
}
```

### `PUT /admin/routes/:id`

Memperbarui route yang sudah ada.

### `DELETE /admin/routes/:id`

Menghapus route.

---

## Integrasi dengan Chatwoot

1. Buka **Settings → Integrations → Webhook** di Chatwoot
2. Tambahkan webhook URL: `https://chatgowa.yourdomain.com/webhook`
3. Centang event yang ingin dikirimkan (misalnya `message_created`, `conversation_created`, dll.)
4. Catat **Inbox ID** dari setiap inbox WhatsApp di Chatwoot (**Settings → Inboxes**)
5. Buka admin panel Chatgowa dan daftarkan mapping `Inbox ID → GoWA webhook URL`

---

## Integrasi dengan GoWA

GoWA menyediakan endpoint webhook receiver untuk Chatwoot. Sesuai dokumentasi GoWA, URL tujuan yang didaftarkan di Chatgowa umumnya mengikuti format:

```
http://<gowa-host>:<port>/chatwoot/webhook
```

Pastikan GoWA dikonfigurasi dengan `CHATWOOT_ENABLED=true` dan parameter Chatwoot yang sesuai (`CHATWOOT_URL`, `CHATWOOT_API_TOKEN`, `CHATWOOT_INBOX_ID`).

---

## npm Scripts

| Script | Perintah | Keterangan |
|---|---|---|
| `npm run dev` | `tsx watch src/index.ts` | Development dengan hot-reload |
| `npm run build` | `tsc` | Compile TypeScript ke `dist/` |
| `npm start` | `node dist/index.js` | Jalankan hasil build |
| `npm run db:generate` | `prisma generate` | Regenerate Prisma client |
| `npm run db:migrate` | `prisma migrate dev` | Buat dan jalankan migrasi baru |
| `npm run db:studio` | `prisma studio` | Buka Prisma Studio (GUI database) |

---

## Lisensi

ISC
