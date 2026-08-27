import {
  createServer,
  request as requestHttp,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from 'node:http'
import { connect, type Socket } from 'node:net'
import { DeviceStore, type DeviceView } from '../auth/device-store.js'
import { PairingTokens } from '../auth/pairing.js'
import type { ResolvedConfig } from '../config.js'
import { allowedGatewayHost, isPrivateAddress, privateInterfaceAddresses } from '../network.js'
import { rewriteAuthenticatedIndex } from './html.js'
import { PAIR_PAGE, PAIR_PATH } from './pair-page.js'

const COOKIE_NAME = 'dsh_local_link_device'
const MAX_PAIR_BODY = 4096
const EVENT_PATHS = new Set(['/api/events.mux', '/api/events.host'])
const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade',
])

function cookieValue(request: IncomingMessage, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_PAIR_BODY) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad_json')
  return value as Record<string, unknown>
}

function send(response: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8'): void {
  response.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  response.end(body)
}

function proxyRequestHeaders(request: IncomingMessage, upstream: URL, websocket = false): OutgoingHttpHeaders {
  const headers: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase()
    if (value === undefined || lower === 'host' || lower === 'cookie'
      || lower.startsWith('x-forwarded-') || (!websocket && HOP_BY_HOP_HEADERS.has(lower))) continue
    headers[lower] = value
  }
  headers.host = upstream.host
  headers.origin = upstream.origin
  headers['sec-fetch-site'] = 'same-origin'
  if (request.headers.referer !== undefined) headers.referer = `${upstream.origin}/`
  return headers
}

function proxyResponseHeaders(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
  const result: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (value === undefined || HOP_BY_HOP_HEADERS.has(lower) || lower === 'set-cookie') continue
    result[lower] = value
  }
  return result
}

function serializeHeaders(headers: OutgoingHttpHeaders): string[] {
  const lines: string[] = []
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) lines.push(`${name}: ${entry}`)
    } else lines.push(`${name}: ${String(value)}`)
  }
  return lines
}

export class LocalGateway {
  private readonly devices: DeviceStore
  private readonly pairing: PairingTokens
  private readonly upgradedSockets = new Set<Socket>()
  private server: Server | undefined
  private addresses: string[] = []

  constructor(readonly config: ResolvedConfig) {
    this.devices = new DeviceStore(config.stateFile, config.deviceTtlMs)
    this.pairing = new PairingTokens(config.pairingTtlMs)
  }

  async start(): Promise<void> {
    if (this.server !== undefined) return
    await this.devices.load()
    this.addresses = this.config.listenHost === '0.0.0.0' ? privateInterfaceAddresses() : [this.config.listenHost]
    if (this.addresses.length === 0) throw new Error('no private IPv4 interface is available')

    const server = createServer((request, response) => { void this.handle(request, response) })
    server.on('upgrade', (request, socket, head) => {
      if (!this.requestTrusted(request) || !this.authorized(request)) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        return
      }
      void this.proxyWebSocket(request, socket as Socket, head)
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.config.listenPort, this.config.listenHost, () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.server = server
  }

  pairedDevices(): readonly DeviceView[] {
    return this.devices.list()
  }

  issuePairing(sessionId?: string): { readonly url: string; readonly expiresAt: string } {
    const address = this.addresses[0]
    if (address === undefined) throw new Error('gateway is not running')
    const issued = this.pairing.issue()
    return {
      url: `http://${address}:${this.config.listenPort}${PAIR_PATH}#token=${encodeURIComponent(issued.token)}${sessionId === undefined ? '' : `&session=${encodeURIComponent(sessionId)}`}`,
      expiresAt: issued.expiresAt,
    }
  }

  revoke(id: string): Promise<boolean> {
    return this.devices.revoke(id)
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    if (server === undefined) return
    for (const socket of this.upgradedSockets) socket.destroy()
    this.upgradedSockets.clear()
    await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)))
  }

  private requestTrusted(request: IncomingMessage): boolean {
    return isPrivateAddress(request.socket.remoteAddress)
      && allowedGatewayHost(request.headers.host, this.config.listenHost, this.config.listenPort, this.addresses)
  }

  private authorized(request: IncomingMessage): boolean {
    return this.config.accessMode === 'trusted-lan'
      || this.devices.authorize(cookieValue(request, COOKIE_NAME)) !== undefined
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.requestTrusted(request)) {
      send(response, 403, 'Local-network request rejected')
      return
    }
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
    if (url.pathname.startsWith('/__dsh-local-link/admin')) {
      send(response, 404, 'Not found')
      return
    }
    if (url.pathname === PAIR_PATH && request.method === 'GET') {
      send(response, 200, PAIR_PAGE, 'text/html; charset=utf-8')
      return
    }
    if (url.pathname === PAIR_PATH && request.method === 'POST') {
      try {
        const body = await readJson(request)
        if (!this.pairing.consume(body.token)) {
          send(response, 410, 'Pairing token expired or already used')
          return
        }
        const credential = cookieValue(request, COOKIE_NAME)
        if (this.devices.authorize(credential) === undefined) {
          const created = await this.devices.add(body.label)
          response.setHeader('set-cookie', `${COOKIE_NAME}=${encodeURIComponent(created.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.config.deviceTtlMs / 1000)}`)
        }
        send(response, 204, '')
      } catch {
        send(response, 400, 'Invalid pairing request')
      }
      return
    }
    if (!this.authorized(request)) {
      send(response, 401, 'This browser is not paired. Open Local access in the computer sidebar and scan its QR code.')
      return
    }
    this.proxyHttp(request, response, request.method === 'GET' && url.pathname === '/')
  }

  private proxyHttp(request: IncomingMessage, response: ServerResponse, interceptIndex: boolean): void {
    const headers = proxyRequestHeaders(request, this.config.upstreamOrigin)
    if (interceptIndex) headers['accept-encoding'] = 'identity'
    const upstreamRequest = requestHttp({
      hostname: this.config.upstreamOrigin.hostname,
      port: Number(this.config.upstreamOrigin.port),
      method: request.method,
      path: request.url,
      headers,
      agent: false,
    }, (upstreamResponse) => {
      if (!interceptIndex || !String(upstreamResponse.headers['content-type'] ?? '').includes('text/html')) {
        response.writeHead(upstreamResponse.statusCode ?? 502, proxyResponseHeaders(upstreamResponse.headers))
        upstreamResponse.pipe(response)
        return
      }
      const chunks: Buffer[] = []
      upstreamResponse.on('data', chunk => chunks.push(Buffer.from(chunk)))
      upstreamResponse.on('end', () => {
        try {
          const body = rewriteAuthenticatedIndex(Buffer.concat(chunks).toString('utf8'))
          const outgoing = proxyResponseHeaders(upstreamResponse.headers)
          delete outgoing['content-length']
          delete outgoing['content-encoding']
          outgoing['content-length'] = Buffer.byteLength(body)
          outgoing['cache-control'] = 'no-store'
          response.writeHead(upstreamResponse.statusCode ?? 502, outgoing)
          response.end(body)
        } catch (error) {
          if (!response.headersSent) send(response, 502, error instanceof Error ? error.message : 'index rewrite failed')
          else response.destroy()
        }
      })
    })
    upstreamRequest.once('error', () => {
      if (!response.headersSent) send(response, 502, 'DeepSeek Harness is unavailable')
      else response.destroy()
    })
    request.pipe(upstreamRequest)
  }

  private async proxyWebSocket(request: IncomingMessage, client: Socket, head: Buffer): Promise<void> {
    const target = new URL(request.url ?? '/', this.config.upstreamOrigin)
    if (target.search !== '' || !EVENT_PATHS.has(target.pathname)) {
      client.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      return
    }
    const upstream = connect(Number(this.config.upstreamOrigin.port), this.config.upstreamOrigin.hostname)
    this.upgradedSockets.add(client)
    this.upgradedSockets.add(upstream)
    const cleanup = (): void => {
      this.upgradedSockets.delete(client)
      this.upgradedSockets.delete(upstream)
    }
    client.once('close', cleanup)
    upstream.once('close', cleanup)
    client.once('error', () => upstream.destroy())
    upstream.once('error', () => {
      if (!client.destroyed) client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
    })
    upstream.once('connect', () => {
      const headers = proxyRequestHeaders(request, this.config.upstreamOrigin, true)
      upstream.write([
        `${request.method ?? 'GET'} ${request.url ?? '/'} HTTP/1.1`,
        ...serializeHeaders(headers),
        '',
        '',
      ].join('\r\n'))
      if (head.length > 0) upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
      client.resume()
    })
  }
}
