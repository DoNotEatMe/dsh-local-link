import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseConfig } from '../src/config.js'

describe('parseConfig', () => {
  it('applies safe local defaults', () => {
    const config = parseConfig({ stateFile: join(process.cwd(), 'devices.json') })
    expect(config.listenHost).toBe('0.0.0.0')
    expect(config.listenPort).toBe(3088)
    expect(config.upstreamOrigin.origin).toBe('http://127.0.0.1:3080')
    expect(config.accessMode).toBe('pairing')
  })

  it('rejects a non-loopback upstream', () => {
    expect(() => parseConfig({
      stateFile: join(process.cwd(), 'devices.json'),
      upstreamOrigin: 'http://192.168.1.10:3080',
    })).toThrow(/127\.0\.0\.1/u)
  })

  it('rejects relative state paths', () => {
    expect(() => parseConfig({ stateFile: 'devices.json' })).toThrow(/absolute/u)
  })
})
