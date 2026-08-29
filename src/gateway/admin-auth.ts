import { isIP } from 'node:net'

function loopbackHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[|\]$/gu, '')
  if (hostname === 'localhost' || hostname === '::1') return true
  if (isIP(hostname) !== 4) return false
  return Number(hostname.split('.')[0]) === 127
}

function loopbackAuthority(value: string | undefined): boolean {
  if (value === undefined || value.length > 255) return false
  try {
    const url = new URL(`http://${value}`)
    return url.username === '' && url.password === '' && url.pathname === '/'
      && url.search === '' && url.hash === '' && loopbackHostname(url.hostname)
  } catch {
    return false
  }
}

function loopbackOrigin(value: string | undefined): boolean {
  if (value === undefined) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && url.username === '' && url.password === ''
      && url.pathname === '/' && url.search === '' && url.hash === ''
      && loopbackHostname(url.hostname)
  } catch {
    return false
  }
}

/**
 * The administration API belongs to the loopback Harness page only. Parse
 * authorities structurally so lookalike DNS names such as 127.example cannot
 * pass a string-prefix check.
 */
export function isLoopbackAdminSource(
  remoteAddress: string | undefined,
  host: string | undefined,
  origin: string | undefined,
): boolean {
  const remote = remoteAddress?.replace(/^::ffff:/u, '')
  return (remote === '127.0.0.1' || remote === '::1')
    && loopbackAuthority(host)
    && loopbackOrigin(origin)
}
