# Chatwoot Webhook Router Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a webhook router that forwards Chatwoot webhooks to multiple Gowa WhatsApp instances based on inbox_id mapping.

**Architecture:** Single Hono.js server receives webhooks from Chatwoot, looks up target URL by inbox_id in SQLite (via Prisma), and forwards the payload. Admin panel with Basic Auth manages route mappings.

**Tech Stack:** Node.js, TypeScript, Hono.js, SQLite, Prisma, Basic Auth

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize npm project**

Run: `cd E:/chatgowa && npm init -y`

Expected: `package.json` created

**Step 2: Install dependencies**

Run: `cd E:/chatgowa && npm install hono @hono/node-server @prisma/client && npm install -D typescript tsx prisma @types/node`

Expected: All packages installed successfully

**Step 3: Create tsconfig.json**

Create file `E:/chatgowa/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .env.example**

Create file `E:/chatgowa/.env.example`:

```env
PORT=3000
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=yourpassword
DATABASE_URL="file:./prisma/dev.db"
```

**Step 5: Create .gitignore**

Create file `E:/chatgowa/.gitignore`:

```
node_modules/
dist/
.env
*.db
*.db-journal
```

**Step 6: Update package.json scripts**

Modify `E:/chatgowa/package.json`, add to `scripts`:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

**Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: initialize project with dependencies"
```

---

## Task 2: Prisma Schema and Client Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

**Step 1: Initialize Prisma**

Run: `cd E:/chatgowa && npx prisma init --datasource-provider sqlite`

Expected: `prisma/` directory created with `schema.prisma`

**Step 2: Define WebhookRoute model**

Modify `E:/chatgowa/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model WebhookRoute {
  id         Int      @id @default(autoincrement())
  inboxId    Int      @unique
  webhookUrl String
  name       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Step 3: Create .env file**

Run: `cp E:/chatgowa/.env.example E:/chatgowa/.env`

**Step 4: Generate Prisma client and create database**

Run: `cd E:/chatgowa && npx prisma migrate dev --name init`

Expected: Database created with `WebhookRoute` table

**Step 5: Create Prisma client singleton**

Create file `E:/chatgowa/src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add Prisma schema and client setup"
```

---

## Task 3: Basic Auth Middleware

**Files:**
- Create: `src/middleware/basicAuth.ts`

**Step 1: Create Basic Auth middleware**

Create file `E:/chatgowa/src/middleware/basicAuth.ts`:

```typescript
import { Context, Next } from 'hono'

export const basicAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Chatgowa Admin"'
      }
    })
  }

  const [scheme, credentials] = authHeader.split(' ')

  if (scheme !== 'Basic' || !credentials) {
    return new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Chatgowa Admin"'
      }
    })
  }

  const decoded = atob(credentials)
  const [username, password] = decoded.split(':')

  const validUser = process.env.BASIC_AUTH_USER || 'admin'
  const validPass = process.env.BASIC_AUTH_PASS || 'password'

  if (username !== validUser || password !== validPass) {
    return new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Chatgowa Admin"'
      }
    })
  }

  await next()
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add Basic Auth middleware"
```

---

## Task 4: Webhook Route Handler

**Files:**
- Create: `src/routes/webhook.ts`

**Step 1: Create webhook route handler**

Create file `E:/chatgowa/src/routes/webhook.ts`:

```typescript
import { Hono } from 'hono'
import { prisma } from '../lib/prisma'

export const webhookRoute = new Hono()

webhookRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()

    // Extract inbox_id from payload
    const inboxId = body.inbox_id

    if (!inboxId) {
      // Return 200 OK even without inbox_id (silent ignore)
      return c.json({ received: true }, 200)
    }

    // Look up route by inbox_id
    const route = await prisma.webhookRoute.findUnique({
      where: { inboxId: inboxId }
    })

    if (!route) {
      // Silent ignore - return 200 OK
      return c.json({ received: true }, 200)
    }

    // Forward payload to target webhook URL
    const response = await fetch(route.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error(`Forward failed: ${response.status} ${response.statusText}`)
    }

    return c.json({ received: true, forwarded: true }, 200)
  } catch (error) {
    console.error('Webhook error:', error)
    // Still return 200 to avoid Chatwoot retries
    return c.json({ received: true }, 200)
  }
})
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add webhook route handler"
```

---

## Task 5: Admin Routes API

**Files:**
- Create: `src/routes/admin.ts`

**Step 1: Create admin routes**

Create file `E:/chatgowa/src/routes/admin.ts`:

```typescript
import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { basicAuth } from '../middleware/basicAuth'

export const adminRoute = new Hono()

// Apply Basic Auth to all admin routes
adminRoute.use('/*', basicAuth)

// List all routes
adminRoute.get('/routes', async (c) => {
  const routes = await prisma.webhookRoute.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return c.json({ routes })
})

// Create new route
adminRoute.post('/routes', async (c) => {
  const body = await c.req.json()

  const { inboxId, webhookUrl, name } = body

  if (!inboxId || !webhookUrl) {
    return c.json({ error: 'inboxId and webhookUrl are required' }, 400)
  }

  try {
    const route = await prisma.webhookRoute.create({
      data: {
        inboxId: parseInt(inboxId),
        webhookUrl,
        name: name || null
      }
    })
    return c.json({ route }, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return c.json({ error: 'Route with this inboxId already exists' }, 409)
    }
    return c.json({ error: 'Failed to create route' }, 500)
  }
})

// Update route
adminRoute.put('/routes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const { inboxId, webhookUrl, name } = body

  try {
    const route = await prisma.webhookRoute.update({
      where: { id },
      data: {
        inboxId: inboxId !== undefined ? parseInt(inboxId) : undefined,
        webhookUrl: webhookUrl !== undefined ? webhookUrl : undefined,
        name: name !== undefined ? name : undefined
      }
    })
    return c.json({ route })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return c.json({ error: 'Route not found' }, 404)
    }
    return c.json({ error: 'Failed to update route' }, 500)
  }
})

// Delete route
adminRoute.delete('/routes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  try {
    await prisma.webhookRoute.delete({
      where: { id }
    })
    return c.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return c.json({ error: 'Route not found' }, 404)
    }
    return c.json({ error: 'Failed to delete route' }, 500)
  }
})
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add admin API routes"
```

---

## Task 6: Admin HTML UI

**Files:**
- Modify: `src/routes/admin.ts`

**Step 1: Add HTML admin panel route**

Add to `E:/chatgowa/src/routes/admin.ts` before the API routes:

```typescript
// Admin HTML page
adminRoute.get('/', (c) => {
  return c.html(getAdminHtml())
})

function getAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chatgowa Admin Panel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #333; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9f9f9; font-weight: 600; }
    button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px; }
    .btn-primary { background: #1a73e8; color: white; }
    .btn-edit { background: #fbbc04; color: white; }
    .btn-delete { background: #ea4335; color: white; }
    .btn-primary:hover { background: #1557b0; }
    .btn-edit:hover { background: #e5ab00; }
    .btn-delete:hover { background: #c5221f; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: 500; }
    input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .actions { display: flex; gap: 5px; }
    .hidden { display: none; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Chatgowa Admin Panel</h1>
      <button class="btn-primary" onclick="showAddForm()">+ Add New Route</button>
    </div>

    <div id="addForm" class="card hidden">
      <h2 id="formTitle">Add New Route</h2>
      <form id="routeForm" onsubmit="saveRoute(event)">
        <input type="hidden" id="routeId">
        <div class="form-group">
          <label for="inboxId">Inbox ID</label>
          <input type="number" id="inboxId" required>
        </div>
        <div class="form-group">
          <label for="name">Name (optional)</label>
          <input type="text" id="name" placeholder="e.g., Gowa A">
        </div>
        <div class="form-group">
          <label for="webhookUrl">Webhook URL</label>
          <input type="url" id="webhookUrl" required placeholder="https://example.com/api/webhook">
        </div>
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" onclick="hideForm()">Cancel</button>
      </form>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Inbox ID</th>
            <th>Name</th>
            <th>Webhook URL</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="routesTable"></tbody>
      </table>
    </div>
  </div>

  <script>
    async function loadRoutes() {
      const res = await fetch('/admin/routes');
      const data = await res.json();
      const tbody = document.getElementById('routesTable');
      tbody.innerHTML = data.routes.map(r => \`
        <tr>
          <td>\${r.id}</td>
          <td>\${r.inboxId}</td>
          <td>\${r.name || '-'}</td>
          <td>\${r.webhookUrl}</td>
          <td class="actions">
            <button class="btn-edit" onclick="editRoute(\${r.id}, \${r.inboxId}, '\${r.name || ''}', '\${r.webhookUrl}')">Edit</button>
            <button class="btn-delete" onclick="deleteRoute(\${r.id})">Delete</button>
          </td>
        </tr>
      \`).join('');
    }

    function showAddForm() {
      document.getElementById('formTitle').textContent = 'Add New Route';
      document.getElementById('routeId').value = '';
      document.getElementById('routeForm').reset();
      document.getElementById('addForm').classList.remove('hidden');
    }

    function editRoute(id, inboxId, name, webhookUrl) {
      document.getElementById('formTitle').textContent = 'Edit Route';
      document.getElementById('routeId').value = id;
      document.getElementById('inboxId').value = inboxId;
      document.getElementById('name').value = name;
      document.getElementById('webhookUrl').value = webhookUrl;
      document.getElementById('addForm').classList.remove('hidden');
    }

    function hideForm() {
      document.getElementById('addForm').classList.add('hidden');
    }

    async function saveRoute(e) {
      e.preventDefault();
      const id = document.getElementById('routeId').value;
      const data = {
        inboxId: parseInt(document.getElementById('inboxId').value),
        name: document.getElementById('name').value || null,
        webhookUrl: document.getElementById('webhookUrl').value
      };

      const url = id ? \`/admin/routes/\${id}\` : '/admin/routes';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        hideForm();
        loadRoutes();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save route');
      }
    }

    async function deleteRoute(id) {
      if (!confirm('Are you sure you want to delete this route?')) return;

      const res = await fetch(\`/admin/routes/\${id}\`, { method: 'DELETE' });
      if (res.ok) {
        loadRoutes();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete route');
      }
    }

    loadRoutes();
  </script>
</body>
</html>`
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add admin HTML panel"
```

---

## Task 7: Entry Point and Server Setup

**Files:**
- Create: `src/index.ts`

**Step 1: Create main entry point**

Create file `E:/chatgowa/src/index.ts`:

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { webhookRoute } from './routes/webhook'
import { adminRoute } from './routes/admin'

const app = new Hono()

// Mount routes
app.route('/webhook', webhookRoute)
app.route('/admin', adminRoute)

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'chatgowa' }))

// Start server
const port = parseInt(process.env.PORT || '3000')

console.log(`Chatgowa server running on http://localhost:${port}`)
console.log(`Webhook endpoint: http://localhost:${port}/webhook`)
console.log(`Admin panel: http://localhost:${port}/admin`)

serve({
  fetch: app.fetch,
  port
})
```

**Step 2: Test server starts**

Run: `cd E:/chatgowa && npm run dev`

Expected: Server starts without errors, displays startup messages

Press Ctrl+C to stop

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add entry point and server setup"
```

---

## Task 8: Integration Testing

**Files:**
- None (manual testing)

**Step 1: Start the server**

Run: `cd E:/chatgowa && npm run dev`

**Step 2: Test health check**

Run: `curl http://localhost:3000/`

Expected: `{"status":"ok","service":"chatgowa"}`

**Step 3: Test webhook endpoint (no route)**

Run: `curl -X POST http://localhost:3000/webhook -H "Content-Type: application/json" -d '{"inbox_id": 1, "message": "test"}'`

Expected: `{"received":true}`

**Step 4: Test admin panel (should prompt for auth)**

Run: `curl http://localhost:3000/admin`

Expected: HTTP 401 with `WWW-Authenticate` header

**Step 5: Test admin with correct credentials**

Run: `curl -u admin:yourpassword http://localhost:3000/admin/routes`

Expected: `{"routes":[]}`

**Step 6: Create a route via API**

Run: `curl -u admin:yourpassword -X POST http://localhost:3000/admin/routes -H "Content-Type: application/json" -d '{"inboxId": 1, "name": "Test Route", "webhookUrl": "https://httpbin.org/post"}'`

Expected: Route created with ID 1

**Step 7: Verify route exists**

Run: `curl -u admin:yourpassword http://localhost:3000/admin/routes`

Expected: Array with one route

**Step 8: Test webhook forwarding**

Run: `curl -X POST http://localhost:3000/webhook -H "Content-Type: application/json" -d '{"inbox_id": 1, "message": "hello"}'`

Expected: `{"received":true,"forwarded":true}` (check httpbin.org for the posted data)

**Step 9: Commit final state**

```bash
git add .
git commit -m "test: verify all endpoints work correctly"
```

---

## Summary

**Files Created:**
```
chatgowa/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/
│   │   ├── webhook.ts        # Webhook receiver & forwarder
│   │   └── admin.ts          # Admin panel (HTML + API)
│   ├── lib/
│   │   └── prisma.ts         # Prisma client singleton
│   └── middleware/
│       └── basicAuth.ts      # Basic Auth middleware
├── prisma/
│   └── schema.prisma         # Database schema
├── package.json
├── tsconfig.json
├── .env
├── .env.example
└── .gitignore
```

**Key Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Health check |
| POST | `/webhook` | None | Receive Chatwoot webhook |
| GET | `/admin` | Basic | Admin HTML panel |
| GET | `/admin/routes` | Basic | List routes (JSON) |
| POST | `/admin/routes` | Basic | Create route |
| PUT | `/admin/routes/:id` | Basic | Update route |
| DELETE | `/admin/routes/:id` | Basic | Delete route |
