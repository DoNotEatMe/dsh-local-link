import { request } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { apply as applyConnection } from '@deepseek-ai/dsh-client-connection'
import { afterEach, describe, expect, it } from 'vitest'

const contexts: Context[] = []
afterEach(async () => {
  for (const context of contexts.splice(0).reverse()) await context.fiber.dispose()
})

async function rpcStatus(port: number, authority: string, method: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const body = JSON.stringify({ type: 'client-request', rpcId: 'trust-test', method, payload: {} })
    const outgoing = request({
      hostname: '127.0.0.1',
      port,
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        host: authority,
        origin: `http://${authority}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, response => {
      response.resume()
      response.once('end', () => resolve(response.statusCode ?? 0))
    })
    outgoing.once('error', reject)
    outgoing.end(body)
  })
}

describe('Harness connection trust boundary', () => {
  it('allows a declared LAN authority through the normal fence but keeps privileged RPC loopback-only', async () => {
    const context = new Context()
    contexts.push(context)
    await context.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await context.plugin(Object.assign(applyConnection, { inject: ['webServer'] }), {
      trustedHosts: ['gateway.test:3088'],
    })

    expect(await rpcStatus(context.webServer.port, 'gateway.test:3088', 'session.list')).toBe(404)
    expect(await rpcStatus(context.webServer.port, 'gateway.test:3088', 'settings.describe')).toBe(403)
    expect(await rpcStatus(context.webServer.port, 'gateway.test:3088', 'credentials.describe')).toBe(403)
    expect(await rpcStatus(context.webServer.port, 'gateway.test:3088', 'host.openPath')).toBe(403)
    expect(await rpcStatus(context.webServer.port, 'gateway.test:3088', 'agentPreset.read')).toBe(403)
  })

  it('wires gateway authorities into the public trustedHosts config without mutating client loopback state', async () => {
    const [patch, client] = await Promise.all([
      readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'),
      readFile(new URL('../src/client.tsx', import.meta.url), 'utf8'),
    ])
    expect(patch).toContain('inject: [webRuntime, localLinkGateway]')
    expect(patch).toContain('...ctx.localLinkGateway.trustedHosts')
    expect(client).not.toMatch(/isLoopback\s*=/u)
  })
})
