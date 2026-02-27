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
