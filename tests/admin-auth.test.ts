import { describe, expect, it } from 'vitest'
import { isLoopbackAdminSource } from '../src/gateway/admin-auth.js'

describe('loopback administration boundary', () => {
  it.each([
    ['127.0.0.1', '127.0.0.1:3080', undefined],
    ['::ffff:127.0.0.1', 'localhost:3080', 'http://localhost:3080'],
    ['::1', '[::1]:3080', 'http://[::1]:3080'],
  ])('accepts a real loopback source, Host, and Origin', (remote, host, origin) => {
    expect(isLoopbackAdminSource(remote, host, origin)).toBe(true)
  })

  it.each([
    ['192.168.1.20', '127.0.0.1:3080', 'http://127.0.0.1:3080'],
    ['127.0.0.1', '127.example:3080', 'http://127.example:3080'],
    ['127.0.0.1', '127.0.0.1:3080', 'http://127.example:3080'],
    ['127.0.0.1', 'localhost.example:3080', 'http://localhost.example:3080'],
    ['127.0.0.1', '127.0.0.1:3080', 'https://127.0.0.1:3080'],
  ])('rejects non-loopback and lookalike authorities', (remote, host, origin) => {
    expect(isLoopbackAdminSource(remote, host, origin)).toBe(false)
  })
})
