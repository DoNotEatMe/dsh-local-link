import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/u.test(entry.name) ? [path] : []
  })
}

describe('Harness UI primitive boundary', () => {
  it('does not introduce raw plugin-owned button or input elements', () => {
    for (const file of sourceFiles(fileURLToPath(new URL('../src/', import.meta.url)))) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/<(?:button|input)\b/u)
    }
  })
})
