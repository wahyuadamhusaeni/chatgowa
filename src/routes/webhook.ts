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
