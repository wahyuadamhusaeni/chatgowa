import 'dotenv/config'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { webhookRoute } from './routes/webhook.js'
import { adminRoute } from './routes/admin.js'

const app = new Hono()

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  await next()
  const status = c.res.status
  const duration = Date.now() - start
  console.log(`[HTTP] ${method} ${path} → ${status} (${duration}ms)`)
})

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
