import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { DiagnosticStore } from '../src/diagnostics.js'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))))

describe('DiagnosticStore', () => {
  it('persists a bounded newest-first report and drops unapproved context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-diagnostics-'))
    roots.push(root)
    const file = join(root, 'diagnostics.json')
    const store = new DiagnosticStore(file, 2, true)
    await store.load()
    await store.record('error', 'PAIRING_GENERATION_FAILED', { token: 'must-not-persist' })
    await store.record('warn', 'PAIRING_REJECTED', { reason: 'expired_or_used' })
    await store.record('error', 'HTTP_UPSTREAM_ERROR', { requestKind: 'api' })

    expect(store.list().map(event => event.code)).toEqual(['HTTP_UPSTREAM_ERROR', 'PAIRING_REJECTED'])
    const persisted = await readFile(file, 'utf8')
    expect(persisted).not.toContain('must-not-persist')
    expect(persisted).not.toContain('token')

    const tampered = JSON.parse(persisted) as { events: Array<Record<string, unknown>> }
    tampered.events[tampered.events.length - 1] = {
      ...tampered.events[tampered.events.length - 1],
      context: { requestKind: 'api', token: 'injected-secret' },
    }
    tampered.events.push({ id: 'unknown', at: new Date().toISOString(), level: 'info', code: 'UNKNOWN_CODE' })
    await writeFile(file, JSON.stringify(tampered))

    const reloaded = new DiagnosticStore(file, 2, true)
    await reloaded.load()
    expect(reloaded.list()).toHaveLength(2)
    expect(JSON.stringify(reloaded.list())).not.toContain('injected-secret')
    expect(reloaded.list().map(event => event.code)).not.toContain('UNKNOWN_CODE')
    expect(await readFile(file, 'utf8')).not.toContain('UNKNOWN_CODE')
    await reloaded.clear()
    expect(reloaded.list()).toEqual([])
  })

  it('coalesces an identical burst instead of persisting polling-like noise', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-diagnostics-'))
    roots.push(root)
    const store = new DiagnosticStore(join(root, 'diagnostics.json'), 20, true)
    await store.record('error', 'HTTP_UPSTREAM_ERROR', { requestKind: 'api' })
    await store.record('error', 'HTTP_UPSTREAM_ERROR', { requestKind: 'api' })
    await store.record('error', 'HTTP_UPSTREAM_ERROR', { requestKind: 'asset' })
    expect(store.list().map(event => event.context?.requestKind)).toEqual(['asset', 'api'])
  })

  it('recovers from an unreadable state without blocking the plugin', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-diagnostics-'))
    roots.push(root)
    const file = join(root, 'diagnostics.json')
    await writeFile(file, '{broken')
    const store = new DiagnosticStore(file, 20, true)
    await expect(store.load()).resolves.toBeUndefined()
    expect(store.list()[0]).toMatchObject({ level: 'warn', code: 'DIAGNOSTICS_STATE_RESET' })
  })

  it('keeps background writes fail-soft but reports an explicit clear failure and recovers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-diagnostics-'))
    roots.push(root)
    const file = join(root, 'diagnostics.json')
    await mkdir(file)
    const store = new DiagnosticStore(file, 20, true)
    await expect(store.record('error', 'HTTP_UPSTREAM_ERROR')).resolves.toBeUndefined()
    await expect(store.clear()).rejects.toBeDefined()

    await rm(file, { recursive: true, force: true })
    await expect(store.clear()).resolves.toBeUndefined()
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ version: 1, events: [] })
  })
})
