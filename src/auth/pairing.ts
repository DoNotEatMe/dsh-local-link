import { randomBytes } from 'node:crypto'

export type PairingStatus = 'active' | 'consumed' | 'expired' | 'unknown'

interface PairingRecord {
  readonly id: string
  readonly token: string
  readonly expiry: number
  status: Exclude<PairingStatus, 'unknown'>
}

export class PairingTokens {
  private current: PairingRecord | undefined

  constructor(private readonly ttlMs: number) {}

  issue(now = Date.now()): { readonly id: string; readonly token: string; readonly expiresAt: string } {
    // The UI presents a single current invitation. Generating another code must
    // invalidate every code it replaces instead of leaving hidden links usable.
    const id = randomBytes(12).toString('base64url')
    const token = randomBytes(24).toString('base64url')
    const expiry = now + this.ttlMs
    this.current = { id, token, expiry, status: 'active' }
    return { id, token, expiresAt: new Date(expiry).toISOString() }
  }

  consume(token: unknown, now = Date.now()): boolean {
    if (typeof token !== 'string' || token.length > 128) return false
    const current = this.current
    if (current === undefined || current.status !== 'active' || current.token !== token) return false
    if (current.expiry < now) {
      current.status = 'expired'
      return false
    }
    current.status = 'consumed'
    return true
  }

  getStatus(id: unknown, now = Date.now()): PairingStatus {
    if (typeof id !== 'string' || id.length > 128 || this.current?.id !== id) return 'unknown'
    if (this.current.status === 'active' && this.current.expiry < now) this.current.status = 'expired'
    return this.current.status
  }
}
