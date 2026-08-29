import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DeviceView {
  readonly id: string
  readonly name: string
  readonly deviceType: string
  readonly browser: string
  readonly createdAt: string
  readonly lastSeenAt: string
}

interface StoredDevice extends DeviceView {
  readonly tokenHash: string
}

interface StoredStateV2 {
  readonly version: 2
  readonly devices: readonly StoredDevice[]
}

interface StoredDeviceV1 {
  readonly id: string
  readonly label: string
  readonly tokenHash: string
  readonly createdAt: string
  readonly lastSeenAt: string
}

interface StoredStateV1 {
  readonly version: 1
  readonly devices: readonly StoredDeviceV1[]
}

interface DeviceMetadata {
  readonly type?: unknown
  readonly browser?: unknown
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

function safeHashEqual(expectedHex: string, actual: Buffer): boolean {
  let expected: Buffer
  try { expected = Buffer.from(expectedHex, 'hex') } catch { return false }
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sanitizeText(value: unknown, fallback: string, maxLength = 64): string {
  if (typeof value !== 'string') return fallback
  const text = value.trim().replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, maxLength)
  return text || fallback
}

function legacyType(label: string): string {
  if (/ipad|tablet/iu.test(label)) return 'Tablet'
  if (/iphone|android|mobile|phone|linux\s+arm/iu.test(label)) return 'Phone'
  return 'Computer'
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
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as StoredStateV1 | StoredStateV2
      if (!Array.isArray(parsed.devices) || (parsed.version !== 1 && parsed.version !== 2)) throw new Error('unsupported device state')
      const cutoff = Date.now() - this.ttlMs
      for (const device of parsed.devices) {
        if (typeof device.id !== 'string' || typeof device.tokenHash !== 'string'
          || Date.parse(device.lastSeenAt) < cutoff) continue
        const migrated: StoredDevice = parsed.version === 1
          ? {
              id: device.id,
              name: 'My device',
              deviceType: legacyType(device.label),
              browser: 'Browser',
              tokenHash: device.tokenHash,
              createdAt: device.createdAt,
              lastSeenAt: device.lastSeenAt,
            }
          : device
        this.devices.set(migrated.id, migrated)
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

  async add(metadata: unknown): Promise<{ readonly device: DeviceView; readonly token: string }> {
    const value = metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata as DeviceMetadata
      : {}
    const token = randomBytes(32).toString('base64url')
    const now = new Date().toISOString()
    const stored: StoredDevice = {
      id: randomUUID(),
      name: 'My device',
      deviceType: sanitizeText(value.type, 'Computer', 32),
      browser: sanitizeText(value.browser, 'Browser', 32),
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

  async renameDevice(id: string, name: unknown): Promise<DeviceView | undefined> {
    const device = this.devices.get(id)
    if (device === undefined) return undefined
    const renamed = { ...device, name: sanitizeText(name, 'My device') }
    this.devices.set(id, renamed)
    await this.persist()
    const { tokenHash: _tokenHash, ...view } = renamed
    return view
  }

  private persist(): Promise<void> {
    const snapshot: StoredStateV2 = { version: 2, devices: [...this.devices.values()] }
    const write = this.writeTail.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.file)
    })
    this.writeTail = write.catch(() => undefined)
    return write
  }
}
