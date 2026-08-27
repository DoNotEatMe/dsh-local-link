import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import QRCode from 'qrcode'
import { Config, parseConfig, type PluginConfig } from './config.js'
import { LocalGateway } from './gateway/local-gateway.js'

export const name = 'dsh-local-link'
export const inject = ['webServer']
export { Config }

const ADMIN_PREFIX = '/__dsh-local-link/admin'

function sendJson(response: Parameters<WebRoute['handler']>[1], status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

function localAdminRequest(request: Parameters<WebRoute['handler']>[0]): boolean {
  const remote = request.socket.remoteAddress?.replace(/^::ffff:/u, '')
  const host = request.headers.host?.toLowerCase()
  return (remote === '127.0.0.1' || remote === '::1')
    && (host?.startsWith('127.') === true || host?.startsWith('localhost:') === true || host?.startsWith('[::1]:') === true)
    && (request.headers.origin === undefined || request.headers.origin.startsWith('http://127.') || request.headers.origin.startsWith('http://localhost:'))
}

async function readBody(request: Parameters<WebRoute['handler']>[0]): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad_json')
  return parsed as Record<string, unknown>
}

export async function apply(ctx: Context, config: PluginConfig): Promise<void> {
  const gateway = new LocalGateway(parseConfig(config))
  await gateway.start()

  const adminRoute: WebRoute = {
    kind: 'prefix',
    path: ADMIN_PREFIX,
    handler: async (request, response) => {
      if (!localAdminRequest(request)) {
        sendJson(response, 403, { error: 'loopback_required' })
        return
      }
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      try {
        if (request.method === 'GET' && url.pathname === `${ADMIN_PREFIX}/devices`) {
          sendJson(response, 200, { devices: gateway.pairedDevices() })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/pairing`) {
          const body = await readBody(request)
          if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || body.sessionId.length > 256)) {
            throw new Error('bad_session_id')
          }
          const pairing = gateway.issuePairing(body.sessionId)
          const qrDataUrl = await QRCode.toDataURL(pairing.url, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
          sendJson(response, 201, { ...pairing, qrDataUrl })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/revoke`) {
          const body = await readBody(request)
          if (typeof body.id !== 'string') throw new Error('bad_device_id')
          sendJson(response, 200, { revoked: await gateway.revoke(body.id) })
          return
        }
        sendJson(response, 404, { error: 'not_found' })
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'bad_request' })
      }
    },
  }

  await ctx.effect(async () => {
    const unregister = ctx.webServer.register(adminRoute)
    return async () => {
      unregister()
      await gateway.close()
    }
  }, 'dsh-local-link: local authenticated mobile gateway')
}
