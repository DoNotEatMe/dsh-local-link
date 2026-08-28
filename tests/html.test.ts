import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { rewriteAuthenticatedIndex } from '../src/gateway/html.js'
import { PAIR_PAGE } from '../src/gateway/pair-page.js'

function index(entries: unknown[]): string {
  return `<html><script>window.__DSH_BOOT__ = ${JSON.stringify({ rev: 'test', entries })};</script></html>`
}

describe('rewriteAuthenticatedIndex', () => {
  it('adds the LAN crypto fallback, trust marker, and Settings ordering', () => {
    const result = rewriteAuthenticatedIndex(index([
      { id: 'dsh-local-link', inject: [] },
      { id: '@deepseek-ai/dsh-client-ui-settings', inject: ['connection'] },
    ]))
    expect(result).toContain('window.crypto.getRandomValues')
    expect(result.indexOf('window.crypto.getRandomValues')).toBeLessThan(result.indexOf('window.__DSH_BOOT__'))
    expect(result).toContain('window.__DSH_LOCAL_LINK_AUTHENTICATED__=true')
    expect(result).toContain('"inject":["connection","dsh-local-link"]')
  })

  it('fails closed when the client plugin is missing', () => {
    expect(() => rewriteAuthenticatedIndex(index([
      { id: '@deepseek-ai/dsh-client-ui-settings', inject: ['connection'] },
    ]))).toThrow(/absent/u)
  })

  it('leaves unrelated HTML untouched', () => {
    expect(rewriteAuthenticatedIndex('<html>plain</html>')).toBe('<html>plain</html>')
  })
})

describe('automatic connection page', () => {
  it('connects immediately without a confirmation form', () => {
    expect(PAIR_PAGE).toContain("void (async()=>")
    expect(PAIR_PAGE).toContain('new XMLHttpRequest()')
    expect(PAIR_PAGE).toContain('request.timeout=12000')
    expect(PAIR_PAGE).toContain('request.ontimeout=')
    expect(PAIR_PAGE).toContain("localStorage.setItem('dsh.sessions.current'")
    expect(PAIR_PAGE).toContain("location.replace('/')")
    expect(PAIR_PAGE).toContain("device:{type,browser}")
    expect(PAIR_PAGE).not.toContain('await fetch(')
    expect(PAIR_PAGE).not.toContain('<form')
    expect(PAIR_PAGE).not.toContain('Pair this device')
  })

  it('still pairs and redirects when History API cleanup is unavailable', async () => {
    const script = PAIR_PAGE.match(/<script>([\s\S]+)<\/script>/u)?.[1]
    expect(script).toBeTruthy()
    const output = { textContent: '' }
    let redirected = ''
    let stored = ''
    class SuccessfulRequest {
      status = 204
      timeout = 0
      onload: (() => void) | undefined
      onerror: (() => void) | undefined
      ontimeout: (() => void) | undefined
      open(): void {}
      setRequestHeader(): void {}
      send(): void { this.onload?.() }
    }
    runInNewContext(script ?? '', {
      document: {
        getElementById: () => output,
        querySelector: () => ({ remove: () => undefined }),
      },
      location: {
        hash: '#token=test-token&session=session-123',
        pathname: '/__dsh-local-link/pair',
        replace: (value: string) => { redirected = value },
      },
      history: { replaceState: () => { throw new Error('unavailable') } },
      navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile' },
      localStorage: { setItem: (_key: string, value: string) => { stored = value } },
      XMLHttpRequest: SuccessfulRequest,
      URLSearchParams,
    })
    await new Promise(resolve => setImmediate(resolve))
    expect({ redirected, stored, status: output.textContent }).toEqual({
      redirected: '/',
      stored: expect.stringContaining('session-123'),
      status: '',
    })
  })
})
