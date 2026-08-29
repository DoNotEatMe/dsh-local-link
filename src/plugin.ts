import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import QRCode from 'qrcode'
import { Config, parseConfig, type PluginConfig } from './config.js'
import { isLoopbackAdminSource } from './gateway/admin-auth.js'
import { LocalGateway } from './gateway/local-gateway.js'

export interface LocalLinkGatewayService {
  readonly trustedHosts: readonly string[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    localLinkGateway: LocalLinkGatewayService
  }
}

export const name = 'dsh-local-link'
export const inject = ['webServer']
export { Config }

const ADMIN_PREFIX = '/__dsh-local-link/admin'
const CLIENT_DIAGNOSTIC_CODES = new Set(['CLIPBOARD_COPY_FAILED', 'DEVICE_REVOKE_FAILED', 'DEVICE_RENAME_FAILED'])

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
  return isLoopbackAdminSource(
    request.socket.remoteAddress,
    request.headers.host,
    request.headers.origin,
  )
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
  ctx.provide('localLinkGateway', Object.freeze({ trustedHosts: gateway.trustedAuthorities() }))

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
        if (request.method === 'GET' && url.pathname === `${ADMIN_PREFIX}/diagnostics`) {
          sendJson(response, 200, {
            version: 1,
            events: gateway.diagnosticEvents(),
            privacy: 'No tokens, cookies, IP addresses, device IDs, session IDs, device names, or request paths.',
          })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/diagnostics/clear`) {
          await gateway.clearDiagnostics()
          sendJson(response, 200, { cleared: true })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/diagnostics/event`) {
          const body = await readBody(request)
          if (typeof body.code !== 'string' || !CLIENT_DIAGNOSTIC_CODES.has(body.code)) throw new Error('bad_diagnostic_code')
          gateway.recordActionError(body.code as 'CLIPBOARD_COPY_FAILED' | 'DEVICE_REVOKE_FAILED' | 'DEVICE_RENAME_FAILED')
          sendJson(response, 202, { recorded: true })
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
        if (request.method === 'GET' && url.pathname === `${ADMIN_PREFIX}/pairing/status`) {
          sendJson(response, 200, { status: gateway.pairingStatus(url.searchParams.get('id')) })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/revoke`) {
          const body = await readBody(request)
          if (typeof body.id !== 'string') throw new Error('bad_device_id')
          sendJson(response, 200, { revoked: await gateway.revoke(body.id) })
          return
        }
        if (request.method === 'POST' && url.pathname === `${ADMIN_PREFIX}/rename`) {
          const body = await readBody(request)
          if (typeof body.id !== 'string') throw new Error('bad_device_id')
          const device = await gateway.renameDevice(body.id, body.name)
          if (device === undefined) {
            sendJson(response, 404, { error: 'device_not_found' })
            return
          }
          sendJson(response, 200, { device })
          return
        }
        sendJson(response, 404, { error: 'not_found' })
      } catch (error) {
        if (url.pathname === `${ADMIN_PREFIX}/pairing`) gateway.recordActionError('PAIRING_GENERATION_FAILED')
        else if (url.pathname === `${ADMIN_PREFIX}/revoke`) gateway.recordActionError('DEVICE_REVOKE_FAILED')
        else if (url.pathname === `${ADMIN_PREFIX}/rename`) gateway.recordActionError('DEVICE_RENAME_FAILED')
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
