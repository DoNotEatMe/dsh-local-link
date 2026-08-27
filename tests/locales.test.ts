import { describe, expect, it } from 'vitest'
import en from '../src/locales/en.json' with { type: 'json' }
import zh from '../src/locales/zh.json' with { type: 'json' }

describe('locale dictionaries', () => {
  it('have identical keys and no empty translations', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.values(en).every(Boolean)).toBe(true)
    expect(Object.values(zh).every(Boolean)).toBe(true)
  })
})
