import { createServer, type IncomingHttpHeaders } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResolvedConfig } from '../src/config.js'
import { LocalGateway, supportedWebSocketTarget } from '../src/gateway/local-gateway.js'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function availablePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no TCP address')
  await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)))
  return address.port
}

describe('LocalGateway', () => {
  it('allows only the exact stock stream transports used by supported Harness versions', () => {
    expect(supportedWebSocketTarget(new URL('http://gateway.test/api/events.mux'))).toBe(true)
    expect(supportedWebSocketTarget(new URL('http://gateway.test/api/events.host'))).toBe(true)
    expect(supportedWebSocketTarget(new URL('http://gateway.test/api/remote.mux'))).toBe(true)
    expect(supportedWebSocketTarget(new URL('http://gateway.test/api/remote.mux?token=bad'))).toBe(false)
    expect(supportedWebSocketTarget(new URL('http://gateway.test/api/arbitrary'))).toBe(false)
  })

  it('pairs once, protects the root, and proxies an authenticated browser', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-gateway-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const upstreamPort = await availablePort()
    const gatewayPort = await availablePort()
    const boot = { rev: 'test', entries: [
      { id: 'dsh-local-link', inject: [] },
      { id: '@deepseek-ai/dsh-client-ui-settings', inject: ['connection'] },
      {
        id: '@deepseek-ai/dsh-client-ui-layout',
        url: '/plugins/layout.js',
        rev: 'stock-layout',
        inject: ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-theme'],
      },
    ] }
    let observedHeaders: IncomingHttpHeaders | undefined
    const upstream = createServer((request, response) => {
      observedHeaders = request.headers
      const body = `<html><script>window.__DSH_BOOT__ = ${JSON.stringify(boot)};</script><main>Harness</main></html>`
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(body) })
      response.end(body)
    })
    await new Promise<void>((resolve, reject) => upstream.listen(upstreamPort, '127.0.0.1', resolve).once('error', reject))
    cleanups.push(() => new Promise<void>((resolve, reject) => upstream.close(error => error === undefined ? resolve() : reject(error))))

    const config: ResolvedConfig = {
      listenHost: '127.0.0.1',
      listenPort: gatewayPort,
      upstreamOrigin: new URL(`http://127.0.0.1:${upstreamPort}`),
      accessMode: 'pairing',
      pairingTtlMs: 300_000,
      deviceTtlMs: 86_400_000,
      diagnosticsEnabled: true,
      diagnosticsMaxEntries: 200,
      diagnosticsFile: join(root, 'diagnostics.json'),
      stateFile: join(root, 'devices.json'),
    }
    const gateway = new LocalGateway(config)
    await gateway.start()
    cleanups.push(() => gateway.close())
    const origin = `http://127.0.0.1:${gatewayPort}`

    expect((await fetch(origin)).status).toBe(401)
    expect((await fetch(origin, {
      headers: { cookie: 'dsh_local_link_device=%E0%A4%A' },
    })).status).toBe(401)
    const targetedPairing = gateway.issuePairing('session-123')
    const targetedHash = new URLSearchParams(new URL(targetedPairing.url).hash.slice(1))
    expect(targetedHash.get('session')).toBe('session-123')
    expect(targetedHash.get('token')).toBeTruthy()
    const pairing = gateway.issuePairing()
    expect(gateway.pairingStatus(pairing.id)).toBe('active')
    const token = new URL(pairing.url).hash.slice('#token='.length)
    const pairPage = await fetch(`${origin}/__dsh-local-link/pair`)
    expect(pairPage.status).toBe(200)
    expect(await pairPage.text()).toContain('Connecting this device')
    const paired = await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, device: { type: 'Phone', browser: 'Chrome' } }),
    })
    expect(paired.status).toBe(204)
    expect(gateway.pairingStatus(pairing.id)).toBe('consumed')
    expect(gateway.diagnosticEvents()).toHaveLength(1)
    expect(gateway.diagnosticEvents()[0]).toMatchObject({ level: 'warn', code: 'AUTH_REQUIRED' })
    const cookie = paired.headers.get('set-cookie')?.split(';', 1)[0]
    expect(cookie).toContain('dsh_local_link_device=')
    const legacyConnect = await fetch(`${origin}/__dsh-local-link/connect`, {
      redirect: 'manual', headers: { cookie: cookie ?? '' },
    })
    expect(legacyConnect.status).toBe(303)
    expect(legacyConnect.headers.get('location')).toBe('/')
    expect((await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    })).status).toBe(410)
    expect(gateway.diagnosticEvents()[0]).toMatchObject({ level: 'warn', code: 'PAIRING_REJECTED' })

    const repeatToken = new URL(gateway.issuePairing().url).hash.slice('#token='.length)
    expect((await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ token: repeatToken, device: { type: 'Phone', browser: 'Chrome' } }),
    })).status).toBe(204)
    expect(gateway.pairedDevices()).toHaveLength(1)
    expect(gateway.pairedDevices()[0]).toMatchObject({ name: 'My device', deviceType: 'Phone', browser: 'Chrome' })
    expect(await gateway.renameDevice(gateway.pairedDevices()[0]?.id ?? '', 'QA phone')).toMatchObject({ name: 'QA phone' })

    const response = await fetch(origin, {
      headers: {
        cookie: cookie ?? '',
        origin,
        referer: `${origin}/session/test`,
        'sec-fetch-site': 'cross-site',
      },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const proxiedHtml = await response.text()
    expect(proxiedHtml).toContain('window.crypto.getRandomValues')
    expect(proxiedHtml).not.toContain('__DSH_LOCAL_LINK_MOBILE__')
    expect(proxiedHtml).toContain('"url":"/plugins/layout.js"')
    expect(observedHeaders?.host).toBe(`127.0.0.1:${gatewayPort}`)
    expect(observedHeaders?.origin).toBe(origin)
    expect(observedHeaders?.referer).toBe(`${origin}/session/test`)
    expect(observedHeaders?.['sec-fetch-site']).toBe('cross-site')
    expect(observedHeaders?.cookie).toBeUndefined()
    expect(gateway.trustedAuthorities()).toEqual([`127.0.0.1:${gatewayPort}`])

  })

  it('uses the native Harness browser-authentication handoff without forwarding its device cookie', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-browser-auth-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const upstreamPort = await availablePort()
    const gatewayPort = await availablePort()
    let observedCookie: string | undefined
    const upstream = createServer((request, response) => {
      if (request.url === '/?token=harness-process') {
        response.writeHead(303, { location: '/', 'set-cookie': 'dsh_browser_session=signed; HttpOnly; SameSite=Strict; Path=/' })
        response.end()
        return
      }
      observedCookie = request.headers.cookie
      const body = '<html><main>Harness</main></html>'
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(body) })
      response.end(body)
    })
    await new Promise<void>((resolve, reject) => upstream.listen(upstreamPort, '127.0.0.1', resolve).once('error', reject))
    cleanups.push(() => new Promise<void>((resolve, reject) => upstream.close(error => error === undefined ? resolve() : reject(error))))

    const gateway = new LocalGateway({
      listenHost: '127.0.0.1', listenPort: gatewayPort,
      upstreamOrigin: new URL(`http://127.0.0.1:${upstreamPort}`), accessMode: 'pairing',
      pairingTtlMs: 300_000, deviceTtlMs: 86_400_000,
      diagnosticsEnabled: true, diagnosticsMaxEntries: 15,
      diagnosticsFile: join(root, 'diagnostics.json'), stateFile: join(root, 'devices.json'),
    })
    await gateway.start()
    cleanups.push(() => gateway.close())
    const origin = `http://127.0.0.1:${gatewayPort}`
    const detach = gateway.attachBrowserAuthentication(baseUrl => `${baseUrl}?token=harness-process`)
    cleanups.push(async () => { detach() })

    const pairing = gateway.issuePairing()
    const paired = await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: new URL(pairing.url).hash.slice('#token='.length), device: { type: 'Phone', browser: 'Chrome' } }),
    })
    const deviceCookie = paired.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
    const handoff = await fetch(`${origin}/__dsh-local-link/connect`, {
      redirect: 'manual', headers: { cookie: deviceCookie },
    })
    expect(handoff.status).toBe(303)
    expect(handoff.headers.get('location')).toBe('/?token=harness-process')

    const exchange = await fetch(`${origin}${handoff.headers.get('location') ?? ''}`, {
      redirect: 'manual', headers: { cookie: deviceCookie },
    })
    expect(exchange.status).toBe(303)
    expect(exchange.headers.get('location')).toBe('/')
    const harnessCookie = exchange.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
    expect(harnessCookie).toBe('dsh_browser_session=signed')

    const index = await fetch(origin, { headers: { cookie: `${deviceCookie}; ${harnessCookie}` } })
    expect(index.status).toBe(200)
    expect(observedCookie).toBe(harnessCookie)
  })
})
