import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DeviceView {
  readonly id: string
  readonly label: string
  readonly createdAt: string
  readonly lastSeenAt: string
}

interface StoredDevice extends DeviceView {
  readonly tokenHash: string
}

interface StoredState {
  readonly version: 1
  readonly devices: readonly StoredDevice[]
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

function safeHashEqual(expectedHex: string, actual: Buffer): boolean {
  let expected: Buffer
  try { expected = Buffer.from(expectedHex, 'hex') } catch { return false }
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sanitizeLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Mobile browser'
  const label = value.trim().replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, 64)
  return label || 'Mobile browser'
}

export class DeviceStore {
  private devices = new Map<string, StoredDevice>()
  private loaded = false
  private writeTail = Promise.resolve()

  constructor(private readonly file: string, private readonly ttlMs: number) {}

  async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as StoredState
      if (parsed.version !== 1 || !Array.isArray(parsed.devices)) throw new Error('unsupported device state')
      const cutoff = Date.now() - this.ttlMs
      for (const device of parsed.devices) {
        if (typeof device.id === 'string' && typeof device.tokenHash === 'string'
          && Date.parse(device.lastSeenAt) >= cutoff) this.devices.set(device.id, device)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  list(): DeviceView[] {
    return [...this.devices.values()]
      .map(({ tokenHash: _tokenHash, ...view }) => view)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  }

  async add(label: unknown): Promise<{ readonly device: DeviceView; readonly token: string }> {
    const token = randomBytes(32).toString('base64url')
    const now = new Date().toISOString()
    const stored: StoredDevice = {
      id: randomUUID(),
      label: sanitizeLabel(label),
      tokenHash: hashToken(token).toString('hex'),
      createdAt: now,
      lastSeenAt: now,
    }
    this.devices.set(stored.id, stored)
    await this.persist()
    const { tokenHash: _tokenHash, ...device } = stored
    return { device, token: `${stored.id}.${token}` }
  }

  authorize(credential: string | undefined): DeviceView | undefined {
    if (credential === undefined || credential.length > 256) return undefined
    const separator = credential.indexOf('.')
    if (separator < 1) return undefined
    const id = credential.slice(0, separator)
    const token = credential.slice(separator + 1)
    const device = this.devices.get(id)
    if (device === undefined || !safeHashEqual(device.tokenHash, hashToken(token))) return undefined
    if (Date.parse(device.lastSeenAt) < Date.now() - this.ttlMs) {
      this.devices.delete(id)
      void this.persist()
      return undefined
    }
    const now = Date.now()
    if (now - Date.parse(device.lastSeenAt) >= 60_000) {
      this.devices.set(id, { ...device, lastSeenAt: new Date(now).toISOString() })
      void this.persist()
    }
    const { tokenHash: _tokenHash, ...view } = device
    return view
  }

  async revoke(id: string): Promise<boolean> {
    const removed = this.devices.delete(id)
    if (removed) await this.persist()
    return removed
  }

  private persist(): Promise<void> {
    const snapshot: StoredState = { version: 1, devices: [...this.devices.values()] }
    this.writeTail = this.writeTail.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.file)
    })
    return this.writeTail
  }
}
