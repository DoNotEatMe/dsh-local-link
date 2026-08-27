import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'

function normalizeAddress(address: string): string {
  const zone = address.indexOf('%')
  return zone < 0 ? address : address.slice(0, zone)
}

export function isPrivateAddress(input: string | undefined): boolean {
  if (input === undefined) return false
  const address = normalizeAddress(input.replace(/^::ffff:/u, ''))
  if (address === '::1' || address === '127.0.0.1') return true
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number)
    const first = octets[0] ?? -1
    const second = octets[1] ?? -1
    return first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase()
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9')
      || lower.startsWith('fea') || lower.startsWith('feb')
  }
  return false
}

export function privateInterfaceAddresses(): string[] {
  const result = new Map<string, number>()
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== 'IPv4' || !isPrivateAddress(entry.address)) continue
      const normalizedName = name.toLowerCase()
      let score = 0
      if (/wi-?fi|wlan|wireless|ethernet|local area|локальн/u.test(normalizedName)) score += 100
      if (/tailscale|docker|vethernet|wsl|hyper-v|virtual|vpn|wireguard|amnezia|zerotier/u.test(normalizedName)) score -= 200
      if (entry.address.startsWith('192.168.')) score += 30
      else if (entry.address.startsWith('10.')) score += 20
      else if (entry.address.startsWith('172.')) score += 10
      result.set(entry.address, Math.max(result.get(entry.address) ?? Number.NEGATIVE_INFINITY, score))
    }
  }
  return [...result].sort(([addressA, scoreA], [addressB, scoreB]) => scoreB - scoreA || addressA.localeCompare(addressB))
    .map(([address]) => address)
}

export function parseHostHeader(value: string | undefined): { hostname: string; port: number } | undefined {
  if (value === undefined || value.length > 255) return undefined
  try {
    const url = new URL(`http://${value}`)
    if (url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== '') return undefined
    return { hostname: normalizeAddress(url.hostname.replace(/^\[|\]$/gu, '')), port: Number(url.port || '80') }
  } catch {
    return undefined
  }
}

export function allowedGatewayHost(value: string | undefined, listenHost: string, listenPort: number, addresses: readonly string[]): boolean {
  const parsed = parseHostHeader(value)
  if (parsed === undefined || parsed.port !== listenPort) return false
  const allowed = listenHost === '0.0.0.0' ? addresses : [listenHost]
  return allowed.includes(parsed.hostname)
}
