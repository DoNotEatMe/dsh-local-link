const CLIENT_ID = 'dsh-local-link'
const SETTINGS_ID = '@deepseek-ai/dsh-client-ui-settings'
const RANDOM_UUID_POLYFILL = `if(!window.crypto.randomUUID){window.crypto.randomUUID=function(){const b=new Uint8Array(16);window.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,value=>value.toString(16).padStart(2,'0'));return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('')}};`

interface BootEntry {
  id?: unknown
  inject?: unknown
}

interface BootManifest {
  rev?: unknown
  entries?: unknown
}

/**
 * Mark the proxied page as authenticated and make Settings wait for our client
 * trust adapter. The rest of the stock Harness graph remains byte-for-byte the
 * same JSON data.
 */
export function rewriteAuthenticatedIndex(html: string): string {
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
  // Web Crypto's randomUUID is secure-context-only in browsers. Plain HTTP on
  // a LAN IP is not a secure context, while DSH's browser RPC client requires
  // randomUUID during startup. getRandomValues remains available there, so a
  // small RFC 4122 v4 fallback keeps the stock client working without a local
  // CA/certificate installation step.
  const prefix = `${RANDOM_UUID_POLYFILL}window.__DSH_LOCAL_LINK_AUTHENTICATED__=true;`
  return `${html.slice(0, assignment.index)}${prefix}${assignment[0]}${JSON.stringify(manifest)};${html.slice(scriptEnd)}`
}
