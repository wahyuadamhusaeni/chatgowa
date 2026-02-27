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

  // BUG FIX: Use indexOf+slice instead of split(':') so passwords containing
  // ':' are not truncated (RFC 7617 — only the FIRST colon is the separator)
  const colonIndex = decoded.indexOf(':')
  if (colonIndex === -1) {
    return new Response(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Chatgowa Admin"'
      }
    })
  }
  const username = decoded.slice(0, colonIndex)
  const password = decoded.slice(colonIndex + 1)

  const validUser = process.env.BASIC_AUTH_USER || 'admin'
  // BUG FIX: Default matches .env.example and docker-compose.yml default
  const validPass = process.env.BASIC_AUTH_PASS || 'yourpassword'

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
