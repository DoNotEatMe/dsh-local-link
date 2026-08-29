import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
    const created = await store.add({ type: 'Phone', browser: 'Chrome' })
    expect(store.authorize(created.token)).toMatchObject({ name: 'My device', deviceType: 'Phone', browser: 'Chrome' })
    expect(await store.renameDevice(created.device.id, 'Kitchen phone')).toMatchObject({ name: 'Kitchen phone' })
    expect(await readFile(file, 'utf8')).not.toContain(created.token)
    expect(await store.revoke(created.device.id)).toBe(true)
    expect(store.authorize(created.token)).toBeUndefined()
  })

  it('migrates legacy platform labels into the new display model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-'))
    roots.push(root)
    const file = join(root, 'devices.json')
    const now = new Date().toISOString()
    await writeFile(file, JSON.stringify({ version: 1, devices: [{
      id: 'legacy', label: 'Linux armv81', tokenHash: '00', createdAt: now, lastSeenAt: now,
    }] }))
    const store = new DeviceStore(file, 86_400_000)
    await store.load()
    expect(store.list()).toEqual([{ id: 'legacy', name: 'My device', deviceType: 'Phone', browser: 'Browser', createdAt: now, lastSeenAt: now }])
  })

  it('recovers the persistence queue after a temporary filesystem failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-local-link-'))
    roots.push(root)
    const file = join(root, 'devices.json')
    await mkdir(file)
    const store = new DeviceStore(file, 86_400_000)
    await expect(store.add({ type: 'Phone', browser: 'Chrome' })).rejects.toBeDefined()

    await rm(file, { recursive: true, force: true })
    await store.add({ type: 'Computer', browser: 'Edge' })
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ version: 2 })
  })
})
