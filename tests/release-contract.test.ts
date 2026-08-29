import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageMetadata {
  readonly version: string
  readonly files: readonly string[]
}

describe('release contract', () => {
  it('keeps version, changelog, responsive documentation, and screenshots aligned', async () => {
    const root = resolve(import.meta.dirname, '..')
    const [packageSource, changelog, readme, architecture, compatibility, mobileView, cordisPatch] = await Promise.all([
      readFile(resolve(root, 'package.json'), 'utf8'),
      readFile(resolve(root, 'CHANGELOG.md'), 'utf8'),
      readFile(resolve(root, 'README.md'), 'utf8'),
      readFile(resolve(root, 'docs/ARCHITECTURE.md'), 'utf8'),
      readFile(resolve(root, 'docs/COMPATIBILITY.md'), 'utf8'),
      readFile(resolve(root, 'docs/MOBILE_VIEW.md'), 'utf8'),
      readFile(resolve(root, 'cordis.patch.yml'), 'utf8'),
    ])
    const metadata = JSON.parse(packageSource) as PackageMetadata
    expect(changelog).toContain(`## ${metadata.version} —`)
    expect(readme).toContain('834 CSS pixels')
    expect(architecture).toContain("matchMedia('(max-width: 834px)')")
    expect(mobileView).toContain("matchMedia('(max-width: 834px)')")
    expect(packageSource).toContain('docs/COMPATIBILITY.md')
    expect(compatibility).toContain('0.1.1-rc.2')
    expect(compatibility).toContain('0.1.1-rc.1')
    expect(compatibility).toContain('0.1.0-rc.8')
    expect(compatibility).toContain('0.1.2-alpha.1')
    expect(compatibility).toContain('There is no Mobile View URL flag')
    expect(metadata.files).toContain('docs/images/*.jpg')
    expect(metadata.files).toContain('docs/images/*.png')
    expect(cordisPatch).toContain('trustedHosts: !!js "[...ctx.webRuntime.trustedHosts, ...ctx.localLinkGateway.trustedHosts]"')
    expect(cordisPatch).not.toMatch(/!!js\s+[\[{]/u)

    const images = [...readme.matchAll(/src="(docs\/images\/[^"]+)"/gu)].map(match => match[1])
    expect(images).toHaveLength(7)
    await Promise.all(images.map(async image => access(resolve(root, image ?? 'missing'))))

    const compatibilityImages = [...compatibility.matchAll(/src="(images\/compat-[^"]+)"/gu)]
      .map(match => match[1])
    expect(compatibilityImages).toHaveLength(12)
    await Promise.all(compatibilityImages.map(async image => access(resolve(root, 'docs', image ?? 'missing'))))

    const localLinks = [...readme.matchAll(/\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/gu)]
      .map(match => match[1])
    await Promise.all(localLinks.map(async link => access(resolve(root, link ?? 'missing'))))
  })
})
