# Chatgowa - Chatwoot Webhook Router Design

## Overview

Aplikasi routing webhook dari Chatwoot ke multiple Gowa WhatsApp instances berdasarkan `inbox_id`.

## Flow

```
Chatwoot Webhook → Chatgowa (this app) → Gowa (by inbox_id mapping)
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Hono.js |
| Database | SQLite |
| ORM | Prisma |
| Auth | Basic Auth (browser popup) |

## Project Structure

```
chatgowa/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/
│   │   ├── webhook.ts    # Webhook receiver & forwarder
│   │   └── admin.ts      # Admin panel (Basic Auth + CRUD)
│   ├── lib/
│   │   └── prisma.ts     # Prisma client instance
│   └── middleware/
│       └── basicAuth.ts  # Basic Auth middleware
├── prisma/
│   └── schema.prisma     # Database schema
├── package.json
└── tsconfig.json
```

## Database Schema

```prisma
model WebhookRoute {
  id          Int      @id @default(autoincrement())
  inboxId     Int      @unique  // inbox_id from Chatwoot
  webhookUrl  String            // Target Gowa webhook URL
  name        String?           // Descriptive name (e.g., "Gowa A")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## API Endpoints

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | Receive webhook from Chatwoot |

### Webhook Flow

1. Receive full payload from Chatwoot
2. Extract `inbox_id` from payload
3. Look up `webhookUrl` in database by `inbox_id`
4. If found → Forward full payload to target URL
5. If not found → Silent ignore (return 200 OK)

### Admin Endpoints (Protected - Basic Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin` | Admin panel HTML page |
| GET | `/admin/routes` | List all routes (JSON) |
| POST | `/admin/routes` | Create new route |
| PUT | `/admin/routes/:id` | Update route |
| DELETE | `/admin/routes/:id` | Delete route |

### Admin UI

Simple HTML page with:
- Table listing all routes
- Add/Edit/Delete forms
- Basic Auth via browser popup

```
+---------------------------------------------------------+
|  Chatgowa Admin Panel                                   |
+---------------------------------------------------------+
|  [+ Add New Route]                                      |
|                                                         |
|  +---------------------------------------------------+  |
|  | ID | Inbox ID | Name    | Webhook URL    | Action |  |
|  +----+----------+---------+----------------+--------+  |
|  | 1  | 1        | Gowa A  | https://gowa.a | Edit   |  |
|  |    |          |         | /api/webhook   | Delete |  |
|  +----+----------+---------+----------------+--------+  |
+---------------------------------------------------------+
```

## Environment Variables

```env
PORT=3000
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=yourpassword
DATABASE_URL="file:./dev.db"
```

## Key Decisions

1. **SQLite** - Simple, no external database server needed
2. **Full payload forwarding** - No transformation needed
3. **Silent ignore** - Return 200 even if route not found (Chatwoot doesn't retry unnecessarily)
4. **No logging** - Keep it simple, rely on server logs if needed
5. **Basic Auth** - Simple browser popup authentication for admin panel
