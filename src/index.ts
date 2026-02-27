import 'dotenv/config'
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
