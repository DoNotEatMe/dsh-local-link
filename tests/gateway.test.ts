import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResolvedConfig } from '../src/config.js'
import { LocalGateway } from '../src/gateway/local-gateway.js'

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
  it('pairs once, protects the root, and proxies an authenticated browser', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-gateway-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const upstreamPort = await availablePort()
    const gatewayPort = await availablePort()
    const boot = { rev: 'test', entries: [
      { id: 'dsh-local-link', inject: [] },
      { id: '@deepseek-ai/dsh-client-ui-settings', inject: ['connection'] },
    ] }
    const upstream = createServer((_request, response) => {
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
      stateFile: join(root, 'devices.json'),
    }
    const gateway = new LocalGateway(config)
    await gateway.start()
    cleanups.push(() => gateway.close())
    const origin = `http://127.0.0.1:${gatewayPort}`

    expect((await fetch(origin)).status).toBe(401)
    const pairing = gateway.issuePairing()
    const token = new URL(pairing.url).hash.slice('#token='.length)
    const paired = await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, label: 'Test phone' }),
    })
    expect(paired.status).toBe(204)
    const cookie = paired.headers.get('set-cookie')?.split(';', 1)[0]
    expect(cookie).toContain('dsh_local_link_device=')
    expect((await fetch(`${origin}/__dsh-local-link/pair`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    })).status).toBe(410)

    const response = await fetch(origin, { headers: { cookie: cookie ?? '' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('__DSH_LOCAL_LINK_AUTHENTICATED__')
  })
})
