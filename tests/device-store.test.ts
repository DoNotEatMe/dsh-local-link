import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { DeviceStore } from '../src/auth/device-store.js'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))))

describe('DeviceStore', () => {
  it('stores only a credential hash and supports revocation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-'))
    roots.push(root)
    const file = join(root, 'devices.json')
    const store = new DeviceStore(file, 86_400_000)
    await store.load()
    const created = await store.add('My phone')
    expect(store.authorize(created.token)?.label).toBe('My phone')
    expect(await readFile(file, 'utf8')).not.toContain(created.token)
    expect(await store.revoke(created.device.id)).toBe(true)
    expect(store.authorize(created.token)).toBeUndefined()
  })
})
