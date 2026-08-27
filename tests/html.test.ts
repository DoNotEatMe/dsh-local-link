import { describe, expect, it } from 'vitest'
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
    expect(PAIR_PAGE).toContain("localStorage.setItem('dsh.sessions.current'")
    expect(PAIR_PAGE).toContain("location.replace('/')")
    expect(PAIR_PAGE).not.toContain('<form')
    expect(PAIR_PAGE).not.toContain('Pair this device')
  })
})
