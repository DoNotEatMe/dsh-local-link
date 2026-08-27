import { describe, expect, it } from 'vitest'
import { rewriteAuthenticatedIndex } from '../src/gateway/html.js'

function index(entries: unknown[]): string {
  return `<html><script>window.__DSH_BOOT__ = ${JSON.stringify({ rev: 'test', entries })};</script></html>`
}

describe('rewriteAuthenticatedIndex', () => {
  it('adds the trust marker and orders Settings after the client plugin', () => {
    const result = rewriteAuthenticatedIndex(index([
      { id: 'dsh-local-link', inject: [] },
      { id: '@deepseek-ai/dsh-client-ui-settings', inject: ['connection'] },
    ]))
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
