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
    expect(config.diagnosticsEnabled).toBe(true)
    expect(config.diagnosticsMaxEntries).toBe(15)
    expect(config.diagnosticsFile).toBe(join(process.cwd(), 'diagnostics.json'))
  })

  it('rejects a non-loopback upstream', () => {
    expect(() => parseConfig({
      stateFile: join(process.cwd(), 'devices.json'),
      upstreamOrigin: 'http://192.168.1.10:3080',
    })).toThrow(/127\.0\.0\.1/u)
  })

  it('rejects a public listener address', () => {
    expect(() => parseConfig({
      stateFile: join(process.cwd(), 'devices.json'),
      listenHost: '203.0.113.10',
    })).toThrow(/private\/loopback/u)
  })

  it('rejects relative state paths', () => {
    expect(() => parseConfig({ stateFile: 'devices.json' })).toThrow(/absolute/u)
  })

  it('rejects a relative diagnostics path', () => {
    expect(() => parseConfig({
      stateFile: join(process.cwd(), 'devices.json'),
      diagnosticsFile: 'diagnostics.json',
    })).toThrow(/diagnosticsFile/u)
  })

  it('keeps diagnostics retention intentionally small', () => {
    const stateFile = join(process.cwd(), 'devices.json')
    expect(() => parseConfig({ stateFile, diagnosticsMaxEntries: 4 })).toThrow(/5 through 200/u)
    expect(() => parseConfig({ stateFile, diagnosticsMaxEntries: 201 })).toThrow(/5 through 200/u)
    expect(parseConfig({ stateFile, diagnosticsMaxEntries: 5 }).diagnosticsMaxEntries).toBe(5)
  })
})
