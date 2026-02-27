import { Hono } from 'hono'
import { prisma } from '../lib/prisma.js'
import { basicAuth } from '../middleware/basicAuth.js'

export const adminRoute = new Hono()

// Apply Basic Auth to all admin routes
adminRoute.use('/*', basicAuth)

// Admin HTML page
adminRoute.get('/', (c) => {
  return c.html(getAdminHtml())
})

// List all routes
adminRoute.get('/routes', async (c) => {
  const routes = await prisma.webhookRoute.findMany({
    orderBy: { createdAt: 'desc' }
  })
  console.log(`[ADMIN] List routes — total=${routes.length}`)
  return c.json({ routes })
})

// Create new route
adminRoute.post('/routes', async (c) => {
  const body = await c.req.json()

  const { inboxId, webhookUrl, name } = body

  if (!inboxId || !webhookUrl) {
    return c.json({ error: 'inboxId and webhookUrl are required' }, 400)
  }

  const parsedInboxId = parseInt(inboxId)
  if (isNaN(parsedInboxId)) {
    return c.json({ error: 'inboxId must be a valid number' }, 400)
  }

  try {
    const route = await prisma.webhookRoute.create({
      data: {
        inboxId: parsedInboxId,
        webhookUrl,
        name: name || null
      }
    })
    console.log(`[ADMIN] Created route id=${route.id} inboxId=${route.inboxId} name="${route.name ?? ''}" url="${route.webhookUrl}"`)
    return c.json({ route }, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.warn(`[ADMIN] Create route conflict: inboxId=${parsedInboxId} already exists`)
      return c.json({ error: 'Route with this inboxId already exists' }, 409)
    }
    console.error('[ADMIN] Create route error:', error)
    return c.json({ error: 'Failed to create route' }, 500)
  }
})

// Update route
adminRoute.put('/routes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: 'Invalid route ID' }, 400)
  }

  const body = await c.req.json()
  const { inboxId, webhookUrl, name } = body

  const updateData: any = {}

  if (inboxId !== undefined) {
    const parsedInboxId = parseInt(inboxId)
    if (isNaN(parsedInboxId)) {
      return c.json({ error: 'inboxId must be a valid number' }, 400)
    }
    updateData.inboxId = parsedInboxId
  }

  if (webhookUrl !== undefined) {
    updateData.webhookUrl = webhookUrl
  }

  if (name !== undefined) {
    updateData.name = name || null
  }

  try {
    const route = await prisma.webhookRoute.update({
      where: { id },
      data: updateData
    })
    console.log(`[ADMIN] Updated route id=${route.id} inboxId=${route.inboxId} name="${route.name ?? ''}" url="${route.webhookUrl}"`)
    return c.json({ route })
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.warn(`[ADMIN] Update route not found: id=${id}`)
      return c.json({ error: 'Route not found' }, 404)
    }
    console.error('[ADMIN] Update route error:', error)
    return c.json({ error: 'Failed to update route' }, 500)
  }
})

// Delete route
adminRoute.delete('/routes/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (isNaN(id)) {
    return c.json({ error: 'Invalid route ID' }, 400)
  }

  try {
    await prisma.webhookRoute.delete({
      where: { id }
    })
    console.log(`[ADMIN] Deleted route id=${id}`)
    return c.json({ success: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.warn(`[ADMIN] Delete route not found: id=${id}`)
      return c.json({ error: 'Route not found' }, 404)
    }
    console.error('[ADMIN] Delete route error:', error)
    return c.json({ error: 'Failed to delete route' }, 500)
  }
})

// Escape HTML to prevent XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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
    .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
          <input type="number" id="inboxId" required min="1">
        </div>
        <div class="form-group">
          <label for="name">Name (optional)</label>
          <input type="text" id="name" placeholder="e.g., Gowa A" maxlength="100">
        </div>
        <div class="form-group">
          <label for="webhookUrl">Webhook URL</label>
          <input type="url" id="webhookUrl" required placeholder="https://example.com/api/webhook" maxlength="500">
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
    // BUG FIX: Replaced manual escapeJs() with a data-attribute approach.
    // Storing route data in data-* attributes avoids all JS string escaping
    // issues (backslash double-escaping, backtick, quotes, XSS via onclick).
    // Data is read back via dataset in editRoute(), which is always safe.

    function escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async function loadRoutes() {
      try {
        const res = await fetch('/admin/routes');
        if (!res.ok) throw new Error('Failed to load routes');
        const data = await res.json();
        const tbody = document.getElementById('routesTable');

        if (data.routes.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No routes configured</td></tr>';
          return;
        }

        tbody.innerHTML = data.routes.map(r => {
          // Store raw values in data-* attributes — no JS string escaping needed.
          // escapeHtml is used only for display text and HTML attribute values.
          return \`
            <tr>
              <td>\${r.id}</td>
              <td>\${r.inboxId}</td>
              <td>\${escapeHtml(r.name) || '-'}</td>
              <td class="url-cell" title="\${escapeHtml(r.webhookUrl)}">\${escapeHtml(r.webhookUrl)}</td>
              <td class="actions">
                <button class="btn-edit"
                  data-id="\${r.id}"
                  data-inbox-id="\${r.inboxId}"
                  data-name="\${escapeHtml(r.name || '')}"
                  data-webhook-url="\${escapeHtml(r.webhookUrl)}"
                  onclick="editRoute(this)">Edit</button>
                <button class="btn-delete"
                  data-id="\${r.id}"
                  onclick="deleteRoute(this)">Delete</button>
              </td>
            </tr>
          \`;
        }).join('');
      } catch (error) {
        console.error('Load routes error:', error);
        alert('Failed to load routes');
      }
    }

    function showAddForm() {
      document.getElementById('formTitle').textContent = 'Add New Route';
      document.getElementById('routeId').value = '';
      document.getElementById('routeForm').reset();
      document.getElementById('addForm').classList.remove('hidden');
    }

    function editRoute(btn) {
      // Read raw values from data-* attributes — safe against any special chars
      const id = btn.dataset.id;
      const inboxId = btn.dataset.inboxId;
      const name = btn.dataset.name;
      const webhookUrl = btn.dataset.webhookUrl;

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
      const inboxIdValue = document.getElementById('inboxId').value;

      if (!inboxIdValue || isNaN(parseInt(inboxIdValue))) {
        alert('Please enter a valid Inbox ID');
        return;
      }

      const data = {
        inboxId: parseInt(inboxIdValue),
        name: document.getElementById('name').value.trim() || null,
        webhookUrl: document.getElementById('webhookUrl').value.trim()
      };

      const url = id ? \`/admin/routes/\${id}\` : '/admin/routes';
      const method = id ? 'PUT' : 'POST';

      try {
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
      } catch (error) {
        console.error('Save route error:', error);
        alert('Failed to save route');
      }
    }

    async function deleteRoute(btn) {
      const id = btn.dataset.id;
      if (!confirm('Are you sure you want to delete this route?')) return;

      try {
        const res = await fetch(\`/admin/routes/\${id}\`, { method: 'DELETE' });
        if (res.ok) {
          loadRoutes();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to delete route');
        }
      } catch (error) {
        console.error('Delete route error:', error);
        alert('Failed to delete route');
      }
    }

    loadRoutes();
  </script>
</body>
</html>`
}
