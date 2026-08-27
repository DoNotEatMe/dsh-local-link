import { describe, expect, it } from 'vitest'
import { PairingTokens } from '../src/auth/pairing.js'

describe('PairingTokens', () => {
  it('allows one use before expiry', () => {
    const tokens = new PairingTokens(1_000)
    const issued = tokens.issue(10_000)
    expect(tokens.consume(issued.token, 10_500)).toBe(true)
    expect(tokens.consume(issued.token, 10_600)).toBe(false)
  })

  it('rejects an expired token', () => {
    const tokens = new PairingTokens(1_000)
    const issued = tokens.issue(10_000)
    expect(tokens.consume(issued.token, 11_001)).toBe(false)
  })
})
