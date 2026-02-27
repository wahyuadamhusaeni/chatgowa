import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { prisma } from '../lib/prisma.js'

export const webhookRoute = new Hono()

// Limit body size to 1MB to prevent DoS via large payloads
webhookRoute.use('/', bodyLimit({
  maxSize: 1 * 1024 * 1024, // 1 MB
  onError: (c) => {
    console.warn('[WEBHOOK] Rejected: payload too large (>1MB)')
    return c.json({ error: 'Payload too large' }, 413)
  }
}))

webhookRoute.post('/', async (c) => {
  const timestamp = new Date().toISOString()

  try {
    const body = await c.req.json()

    // Log raw event type if available
    const event = body.event ?? 'unknown'
    console.log(`[WEBHOOK] [${timestamp}] Received event="${event}"`)

    // Chatwoot sends inbox_id nested inside body.inbox.id (not body.inbox_id at root).
    // Fallback to body.inbox_id for any non-standard senders.
    const rawInboxId: unknown =
      (body.inbox && typeof body.inbox === 'object' ? (body.inbox as Record<string, unknown>).id : undefined)
      ?? body.inbox_id

    console.log(`[WEBHOOK] [${timestamp}] Extracted inbox_id=${rawInboxId} (type=${typeof rawInboxId})`)

    // Null/undefined check — inbox_id = 0 is falsy but may be valid, so use strict check
    if (rawInboxId === undefined || rawInboxId === null) {
      console.warn(`[WEBHOOK] [${timestamp}] Missing inbox_id — ignoring payload. body.inbox=${JSON.stringify(body.inbox)}, body.inbox_id=${body.inbox_id}`)
      return c.json({ received: true }, 200)
    }

    // Validate inbox_id is a number
    const inboxId = typeof rawInboxId === 'number'
      ? rawInboxId
      : parseInt(String(rawInboxId), 10)

    if (isNaN(inboxId)) {
      console.warn(`[WEBHOOK] [${timestamp}] Invalid inbox_id value: "${rawInboxId}" (cannot parse as number)`)
      return c.json({ received: true }, 200)
    }

    console.log(`[WEBHOOK] [${timestamp}] Looking up route for inboxId=${inboxId}`)

    // Look up route by inbox_id
    const route = await prisma.webhookRoute.findUnique({
      where: { inboxId }
    })

    if (!route) {
      console.warn(`[WEBHOOK] [${timestamp}] No route configured for inboxId=${inboxId} — ignoring`)
      return c.json({ received: true }, 200)
    }

    console.log(`[WEBHOOK] [${timestamp}] Found route id=${route.id} name="${route.name ?? ''}" → ${route.webhookUrl}`)

    // Add timeout via AbortController so a slow/unresponsive target
    // does not block indefinitely and cause Chatwoot retries
    const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || '10000')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      console.log(`[WEBHOOK] [${timestamp}] Forwarding event="${event}" inboxId=${inboxId} → ${route.webhookUrl}`)

      const response = await fetch(route.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (response.ok) {
        console.log(`[WEBHOOK] [${timestamp}] Forward success → ${route.webhookUrl} (HTTP ${response.status})`)
      } else {
        console.error(`[WEBHOOK] [${timestamp}] Forward failed → ${route.webhookUrl} (HTTP ${response.status} ${response.statusText})`)
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[WEBHOOK] [${timestamp}] Forward timeout after ${timeoutMs}ms → ${route.webhookUrl}`)
      } else {
        console.error(`[WEBHOOK] [${timestamp}] Forward error → ${route.webhookUrl}:`, fetchError instanceof Error ? fetchError.message : fetchError)
      }
    } finally {
      clearTimeout(timer)
    }

    return c.json({ received: true, forwarded: true }, 200)
  } catch (error) {
    console.error(`[WEBHOOK] [${timestamp}] Unhandled error:`, error instanceof Error ? error.message : error)
    // Always return 200 to prevent Chatwoot retries
    return c.json({ received: true }, 200)
  }
})
