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
