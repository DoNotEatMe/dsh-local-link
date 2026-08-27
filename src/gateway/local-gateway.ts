import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import httpProxy from 'http-proxy'
import { DeviceStore, type DeviceView } from '../auth/device-store.js'
import { PairingTokens } from '../auth/pairing.js'
import type { ResolvedConfig } from '../config.js'
import { allowedGatewayHost, isPrivateAddress, privateInterfaceAddresses } from '../network.js'
import { rewriteAuthenticatedIndex } from './html.js'
import { PAIR_PAGE, PAIR_PATH } from './pair-page.js'

const COOKIE_NAME = 'dsh_local_link_device'
const MAX_PAIR_BODY = 4096

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

function rewriteProxyHeaders(headers: IncomingMessage['headers'], upstream: URL): void {
  headers.host = upstream.host
  if (headers.origin !== undefined) headers.origin = upstream.origin
  if (headers.referer !== undefined) headers.referer = `${upstream.origin}/`
  headers['sec-fetch-site'] = 'same-origin'
  delete headers['x-forwarded-for']
  delete headers['x-forwarded-host']
  delete headers['x-forwarded-proto']
}

export interface GatewayStatus {
  readonly running: boolean
  readonly accessMode: ResolvedConfig['accessMode']
  readonly addresses: readonly string[]
  readonly devices: readonly DeviceView[]
  readonly insecureHttp: true
}

export class LocalGateway {
  private readonly devices: DeviceStore
  private readonly pairing: PairingTokens
  private readonly proxy = httpProxy.createProxyServer({ changeOrigin: true, xfwd: false })
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

    this.proxy.on('proxyRes', (proxyResponse, request, response) => {
      if (request.url !== '/' || !String(proxyResponse.headers['content-type'] ?? '').includes('text/html')) return
      const chunks: Buffer[] = []
      proxyResponse.on('data', chunk => chunks.push(Buffer.from(chunk)))
      proxyResponse.on('end', () => {
        try {
          const body = rewriteAuthenticatedIndex(Buffer.concat(chunks).toString('utf8'))
          const outgoing = response as ServerResponse
          outgoing.statusCode = proxyResponse.statusCode ?? 502
          for (const [name, value] of Object.entries(proxyResponse.headers)) {
            if (value !== undefined && name !== 'content-length' && name !== 'content-encoding' && name !== 'transfer-encoding') {
              outgoing.setHeader(name, value)
            }
          }
          outgoing.setHeader('content-length', Buffer.byteLength(body))
          outgoing.setHeader('cache-control', 'no-store')
          outgoing.end(body)
        } catch (error) {
          const outgoing = response as ServerResponse
          if (!outgoing.headersSent) send(outgoing, 502, error instanceof Error ? error.message : 'index rewrite failed')
          else outgoing.destroy()
        }
      })
    })

    const server = createServer((request, response) => { void this.handle(request, response) })
    server.on('upgrade', (request, socket, head) => {
      if (!this.requestTrusted(request) || !this.authorized(request)) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        return
      }
      rewriteProxyHeaders(request.headers, this.config.upstreamOrigin)
      this.proxy.ws(request, socket, head, { target: this.config.upstreamOrigin.origin })
    })
    this.proxy.on('error', (_error, _request, response) => {
      if ('writeHead' in response && !response.headersSent) send(response, 502, 'DeepSeek Harness is unavailable')
      else response.destroy()
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

  status(): GatewayStatus {
    return {
      running: this.server?.listening ?? false,
      accessMode: this.config.accessMode,
      addresses: this.addresses.map(address => `http://${address}:${this.config.listenPort}`),
      devices: this.devices.list(),
      insecureHttp: true,
    }
  }

  issuePairing(): { readonly url: string; readonly expiresAt: string } {
    const address = this.addresses[0]
    if (address === undefined) throw new Error('gateway is not running')
    const issued = this.pairing.issue()
    return {
      url: `http://${address}:${this.config.listenPort}${PAIR_PATH}#token=${encodeURIComponent(issued.token)}`,
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
    this.proxy.close()
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
        const created = await this.devices.add(body.label)
        response.setHeader('set-cookie', `${COOKIE_NAME}=${encodeURIComponent(created.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.config.deviceTtlMs / 1000)}`)
        send(response, 204, '')
      } catch {
        send(response, 400, 'Invalid pairing request')
      }
      return
    }
    if (!this.authorized(request)) {
      send(response, 401, 'This browser is not paired. Create a QR code in Settings → Local Link on the computer.')
      return
    }
    rewriteProxyHeaders(request.headers, this.config.upstreamOrigin)
    const interceptIndex = request.method === 'GET' && url.pathname === '/'
    if (interceptIndex) delete request.headers['accept-encoding']
    this.proxy.web(request, response, {
      target: this.config.upstreamOrigin.origin,
      selfHandleResponse: interceptIndex,
    })
  }
}
