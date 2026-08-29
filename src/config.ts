import { dirname, isAbsolute, join, resolve } from 'node:path'
import { isIP } from 'node:net'
import z from '@deepseek-ai/schemastery'
import { isPrivateAddress } from './network.js'

export type AccessMode = 'pairing' | 'trusted-lan'

export interface PluginConfig {
  listenHost?: string
  listenPort?: number
  upstreamOrigin?: string
  accessMode?: AccessMode
  pairingTtlSeconds?: number
  deviceTtlDays?: number
  diagnosticsEnabled?: boolean
  diagnosticsMaxEntries?: number
  diagnosticsFile?: string
  stateFile: string
}

export interface ResolvedConfig {
  readonly listenHost: string
  readonly listenPort: number
  readonly upstreamOrigin: URL
  readonly accessMode: AccessMode
  readonly pairingTtlMs: number
  readonly deviceTtlMs: number
  readonly diagnosticsEnabled: boolean
  readonly diagnosticsMaxEntries: number
  readonly diagnosticsFile: string
  readonly stateFile: string
}

export const Config: z<PluginConfig> = z.object({
  listenHost: z.string().default('0.0.0.0'),
  listenPort: z.natural().max(65535).default(3088),
  upstreamOrigin: z.string().default('http://127.0.0.1:3080'),
  accessMode: z.union([z.const('pairing'), z.const('trusted-lan')]).default('pairing'),
  pairingTtlSeconds: z.natural().default(300),
  deviceTtlDays: z.natural().default(90),
  diagnosticsEnabled: z.boolean().default(true),
  diagnosticsMaxEntries: z.natural().max(200).default(15),
  diagnosticsFile: z.string(),
  stateFile: z.string().required(),
})

function boundedInteger(value: unknown, name: string, fallback: number, minimum: number, maximum: number): number {
  const resolved = value ?? fallback
  if (typeof resolved !== 'number' || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`)
  }
  return resolved
}

export function parseConfig(value: PluginConfig): ResolvedConfig {
  const listenHost = value.listenHost ?? '0.0.0.0'
  if (isIP(listenHost) === 0) throw new Error('listenHost must be an IP literal')
  if (listenHost !== '0.0.0.0' && !isPrivateAddress(listenHost)) {
    throw new Error('listenHost must be 0.0.0.0 or a private/loopback IP literal')
  }

  const upstreamOrigin = new URL(value.upstreamOrigin ?? 'http://127.0.0.1:3080')
  if (upstreamOrigin.protocol !== 'http:' || upstreamOrigin.hostname !== '127.0.0.1'
    || upstreamOrigin.port === '' || upstreamOrigin.pathname !== '/' || upstreamOrigin.search !== ''
    || upstreamOrigin.hash !== '' || upstreamOrigin.username !== '' || upstreamOrigin.password !== '') {
    throw new Error('upstreamOrigin must be an explicit http://127.0.0.1:<port> origin')
  }

  if (!isAbsolute(value.stateFile)) throw new Error('stateFile must be an absolute path')
  if (value.diagnosticsFile !== undefined && !isAbsolute(value.diagnosticsFile)) {
    throw new Error('diagnosticsFile must be an absolute path')
  }
  const accessMode = value.accessMode ?? 'pairing'
  if (accessMode !== 'pairing' && accessMode !== 'trusted-lan') throw new Error('accessMode is not supported')

  const stateFile = resolve(value.stateFile)
  return Object.freeze({
    listenHost,
    listenPort: boundedInteger(value.listenPort, 'listenPort', 3088, 1, 65535),
    upstreamOrigin,
    accessMode,
    pairingTtlMs: boundedInteger(value.pairingTtlSeconds, 'pairingTtlSeconds', 300, 30, 3600) * 1000,
    deviceTtlMs: boundedInteger(value.deviceTtlDays, 'deviceTtlDays', 90, 1, 3650) * 86_400_000,
    diagnosticsEnabled: value.diagnosticsEnabled ?? true,
    diagnosticsMaxEntries: boundedInteger(value.diagnosticsMaxEntries, 'diagnosticsMaxEntries', 15, 5, 200),
    diagnosticsFile: resolve(value.diagnosticsFile ?? join(dirname(stateFile), 'diagnostics.json')),
    stateFile,
  })
}
