import { describe, expect, it } from 'vitest'
import { allowedGatewayHost, isPrivateAddress, privateInterfaceAddresses } from '../src/network.js'

describe('network boundary', () => {
  it.each([
    ['127.0.0.1', true],
    ['::ffff:127.0.0.1', true],
    ['10.2.3.4', true],
    ['172.16.4.2', true],
    ['172.32.0.1', false],
    ['192.168.50.4', true],
    ['169.254.1.8', true],
    ['8.8.8.8', false],
    ['fd12::1', true],
    ['2001:4860:4860::8888', false],
  ])('classifies %s', (address, expected) => {
    expect(isPrivateAddress(address)).toBe(expected)
  })

  it('accepts only a current IP literal and configured port', () => {
    expect(allowedGatewayHost('192.168.1.20:3088', '0.0.0.0', 3088, ['192.168.1.20'])).toBe(true)
    expect(allowedGatewayHost('computer.local:3088', '0.0.0.0', 3088, ['192.168.1.20'])).toBe(false)
    expect(allowedGatewayHost('192.168.1.20:8080', '0.0.0.0', 3088, ['192.168.1.20'])).toBe(false)
  })

  it('returns each private interface at most once', () => {
    const addresses = privateInterfaceAddresses()
    expect(new Set(addresses).size).toBe(addresses.length)
    expect(addresses.every(address => isPrivateAddress(address))).toBe(true)
  })
})
