import { describe, expect, it } from 'vitest'
import { MOBILE_LAYOUT_STYLES, MOBILE_ROOT_CHILDREN } from '../src/mobile-layout.js'
import { mobileLayoutRequested } from '../src/gateway/local-gateway.js'

describe('mobile layout activation', () => {
  it('uses an explicit override before device detection', () => {
    expect(mobileLayoutRequested(new URL('http://gateway/?view=mobile'), 'Desktop Chrome')).toBe(true)
    expect(mobileLayoutRequested(new URL('http://gateway/?view=desktop'), 'Android Mobile')).toBe(false)
  })

  it('detects common phone and tablet user agents without making them a security boundary', () => {
    expect(mobileLayoutRequested(new URL('http://gateway/'), 'Mozilla/5.0 (Linux; Android 14) Chrome Mobile')).toBe(true)
    expect(mobileLayoutRequested(new URL('http://gateway/'), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome')).toBe(false)
  })
})

describe('mobile root composition', () => {
  it('owns geometry only and preserves the four stock plugin surfaces', () => {
    expect(MOBILE_ROOT_CHILDREN).toEqual({
      sidebar: { kind: 'single', scope: 'root' },
      conversation: { kind: 'single', scope: 'session-maybe' },
      details: { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    })
    expect(Object.keys(MOBILE_ROOT_CHILDREN)).not.toContain('conversation.view')
  })

  it('keeps the conversation full-width and hides navigation off-canvas', () => {
    expect(MOBILE_LAYOUT_STYLES).toContain('width:100dvw')
    expect(MOBILE_LAYOUT_STYLES).toContain('transform:translateX(-104%)')
    expect(MOBILE_LAYOUT_STYLES).toContain('padding-left:max(58px')
    expect(MOBILE_LAYOUT_STYLES).not.toContain('width:56px')
  })
})
