import { randomBytes } from 'node:crypto'

export class PairingTokens {
  private readonly active = new Map<string, number>()

  constructor(private readonly ttlMs: number, private readonly maxActive = 8) {}

  issue(now = Date.now()): { readonly token: string; readonly expiresAt: string } {
    this.prune(now)
    while (this.active.size >= this.maxActive) this.active.delete(this.active.keys().next().value as string)
    const token = randomBytes(24).toString('base64url')
    const expiry = now + this.ttlMs
    this.active.set(token, expiry)
    return { token, expiresAt: new Date(expiry).toISOString() }
  }

  consume(token: unknown, now = Date.now()): boolean {
    if (typeof token !== 'string' || token.length > 128) return false
    const expiry = this.active.get(token)
    if (expiry === undefined) return false
    this.active.delete(token)
    return expiry >= now
  }

  private prune(now: number): void {
    for (const [token, expiry] of this.active) if (expiry < now) this.active.delete(token)
  }
}
