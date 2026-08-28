import { describe, expect, it } from 'vitest'
import { PairingTokens } from '../src/auth/pairing.js'

describe('PairingTokens', () => {
  it('allows one use before expiry', () => {
    const tokens = new PairingTokens(1_000)
    const issued = tokens.issue(10_000)
    expect(tokens.getStatus(issued.id, 10_500)).toBe('active')
    expect(tokens.consume(issued.token, 10_500)).toBe(true)
    expect(tokens.getStatus(issued.id, 10_500)).toBe('consumed')
    expect(tokens.consume(issued.token, 10_600)).toBe(false)
  })

  it('rejects an expired token', () => {
    const tokens = new PairingTokens(1_000)
    const issued = tokens.issue(10_000)
    expect(tokens.consume(issued.token, 11_001)).toBe(false)
    expect(tokens.getStatus(issued.id, 11_001)).toBe('expired')
  })

  it('invalidates the previous token when another code is generated', () => {
    const tokens = new PairingTokens(1_000)
    const previous = tokens.issue(10_000)
    const current = tokens.issue(10_100)

    expect(tokens.consume(previous.token, 10_200)).toBe(false)
    expect(tokens.getStatus(previous.id, 10_200)).toBe('unknown')
    expect(tokens.consume(current.token, 10_200)).toBe(true)
  })
})
