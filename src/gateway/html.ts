const CLIENT_ID = 'dsh-local-link'
const SETTINGS_ID = '@deepseek-ai/dsh-client-ui-settings'
const LAYOUT_ID = '@deepseek-ai/dsh-client-ui-layout'
const LAYOUT_URL = '/__dsh-local-link/mobile-layout.js'
const REQUIRED_LAYOUT_DEPENDENCIES = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-theme',
] as const
const RANDOM_UUID_POLYFILL = `if(!window.crypto.randomUUID){window.crypto.randomUUID=function(){const b=new Uint8Array(16);window.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,value=>value.toString(16).padStart(2,'0'));return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('')}};`

interface BootEntry {
  id?: unknown
  inject?: unknown
  rev?: unknown
  url?: unknown
}

interface BootManifest {
  rev?: unknown
  entries?: unknown
}

export interface RewriteOptions {
  readonly mobile?: boolean
}

function ensureMobileViewport(html: string): string {
  const viewport = /<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/iu
  const match = viewport.exec(html)
  if (match === null) {
    const head = /<head\b[^>]*>/iu.exec(html)
    if (head?.index === undefined) return html
    const offset = head.index + head[0].length
    return `${html.slice(0, offset)}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${html.slice(offset)}`
  }
  if (/\bviewport-fit\s*=\s*cover\b/iu.test(match[0])) return html
  const content = /\bcontent\s*=\s*(["'])(.*?)\1/iu
  const replacement = content.test(match[0])
    ? match[0].replace(content, (_whole, quote: string, value: string) => `content=${quote}${value},viewport-fit=cover${quote}`)
    : match[0].replace(/\s*\/?>$/u, ' content="width=device-width,initial-scale=1,viewport-fit=cover">')
  return `${html.slice(0, match.index)}${replacement}${html.slice(match.index + match[0].length)}`
}

function replaceLayout(entries: BootEntry[]): void {
  const layouts = entries.filter(entry => entry.id === LAYOUT_ID)
  if (layouts.length !== 1) throw new Error('DSH boot manifest has no unique layout module')
  const layout = layouts[0]
  const inject = layout?.inject
  if (layout === undefined || typeof layout.url !== 'string' || typeof layout.rev !== 'string'
    || !Array.isArray(inject)
    || REQUIRED_LAYOUT_DEPENDENCIES.some(dependency => !inject.includes(dependency))) {
    throw new Error('DSH layout boot entry is incompatible')
  }
  layout.url = LAYOUT_URL
  layout.rev = 'dsh-local-link-mobile-layout-v1'
  if (!inject.includes(CLIENT_ID)) layout.inject = [...inject, CLIENT_ID]
}

/**
 * Mark the proxied page as authenticated and make Settings wait for our client
 * trust adapter. The rest of the stock Harness graph remains byte-for-byte the
 * same JSON data.
 */
export function rewriteAuthenticatedIndex(html: string, options: RewriteOptions = {}): string {
  const assignment = /(?:window\.__DSH_BOOT__|globalThis\["__DSH_BOOT__"\])\s*=\s*/u.exec(html)
  if (assignment?.index === undefined) return html
  const valueStart = assignment.index + assignment[0].length
  const scriptEnd = html.indexOf('</script>', valueStart)
  if (scriptEnd < 0) throw new Error('DSH boot manifest script is incomplete')
  const source = html.slice(valueStart, scriptEnd).trim().replace(/;$/u, '')
  const manifest = JSON.parse(source) as BootManifest
  if (!Array.isArray(manifest.entries)) throw new Error('DSH boot manifest has no entries')
  const entries = manifest.entries as BootEntry[]
  if (!entries.some(entry => entry.id === CLIENT_ID)) throw new Error('dsh-local-link client is absent from DSH boot manifest')
  const settings = entries.filter(entry => entry.id === SETTINGS_ID)
  if (settings.length !== 1 || !Array.isArray(settings[0]?.inject)) throw new Error('DSH settings boot entry is incompatible')
  if (!settings[0].inject.includes(CLIENT_ID)) settings[0].inject = [...settings[0].inject, CLIENT_ID]
  if (options.mobile === true) replaceLayout(entries)
  // Web Crypto's randomUUID is secure-context-only in browsers. Plain HTTP on
  // a LAN IP is not a secure context, while DSH's browser RPC client requires
  // randomUUID during startup. getRandomValues remains available there, so a
  // small RFC 4122 v4 fallback keeps the stock client working without a local
  // CA/certificate installation step.
  const prefix = `${RANDOM_UUID_POLYFILL}window.__DSH_LOCAL_LINK_AUTHENTICATED__=true;${options.mobile === true ? 'window.__DSH_LOCAL_LINK_MOBILE__=true;' : ''}`
  const rewritten = `${html.slice(0, assignment.index)}${prefix}${assignment[0]}${JSON.stringify(manifest)};${html.slice(scriptEnd)}`
  return options.mobile === true ? ensureMobileViewport(rewritten) : rewritten
}
