import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { prisma } from '../lib/prisma.js'

export const webhookRoute = new Hono()

// M1 FIX: Limit body size to 1MB to prevent DoS via large payloads
webhookRoute.use('/', bodyLimit({
  maxSize: 1 * 1024 * 1024, // 1 MB
  onError: (c) => c.json({ error: 'Payload too large' }, 413)
}))

webhookRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()

    // Extract inbox_id from payload
    const inboxId = body.inbox_id

    // BUG FIX: Use explicit null/undefined check instead of falsy check.
    // inbox_id = 0 is falsy in JS but may be a valid value — do not silent-drop it.
    if (inboxId === undefined || inboxId === null) {
      return c.json({ received: true }, 200)
    }

    // Validate inboxId is a number
    if (typeof inboxId !== 'number') {
      console.warn(`Invalid inbox_id type: ${typeof inboxId}`)
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

    // BUG FIX: Add timeout via AbortController so a slow/unresponsive GoWA
    // instance does not block indefinitely, preventing Chatwoot retries and
    // memory accumulation from hung fetch promises.
    const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || '10000')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(route.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        console.error(`Forward failed to ${route.webhookUrl}: ${response.status} ${response.statusText}`)
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`Forward timeout after ${timeoutMs}ms to ${route.webhookUrl}`)
      } else {
        console.error(`Forward error to ${route.webhookUrl}:`, fetchError instanceof Error ? fetchError.message : fetchError)
      }
    } finally {
      clearTimeout(timer)
    }

    return c.json({ received: true, forwarded: true }, 200)
  } catch (error) {
    console.error('Webhook error:', error instanceof Error ? error.message : error)
    // Still return 200 to avoid Chatwoot retries
    return c.json({ received: true }, 200)
  }
})
