import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type DiagnosticLevel = 'warn' | 'error'

export type DiagnosticCode =
  | 'PAIRING_GENERATION_FAILED'
  | 'PAIRING_REJECTED'
  | 'PAIRING_INVALID'
  | 'REQUEST_REJECTED'
  | 'AUTH_REQUIRED'
  | 'HTTP_UPSTREAM_ERROR'
  | 'INDEX_REWRITE_ERROR'
  | 'WS_REJECTED'
  | 'WS_UPSTREAM_ERROR'
  | 'CLIPBOARD_COPY_FAILED'
  | 'DEVICE_REVOKE_FAILED'
  | 'DEVICE_RENAME_FAILED'
  | 'DIAGNOSTICS_STATE_RESET'

type DiagnosticValue = string | number | boolean

export interface DiagnosticEvent {
  readonly id: string
  readonly at: string
  readonly level: DiagnosticLevel
  readonly code: DiagnosticCode
  readonly context?: Readonly<Record<string, DiagnosticValue>>
}

interface StoredDiagnostics {
  readonly version: 1
  readonly events: readonly DiagnosticEvent[]
}

const SAFE_CONTEXT_KEYS = new Set([
  'reason', 'method', 'requestKind',
])

const DIAGNOSTIC_CODES = new Set<DiagnosticCode>([
  'PAIRING_GENERATION_FAILED', 'PAIRING_REJECTED', 'PAIRING_INVALID',
  'REQUEST_REJECTED', 'AUTH_REQUIRED', 'HTTP_UPSTREAM_ERROR', 'INDEX_REWRITE_ERROR',
  'WS_REJECTED', 'WS_UPSTREAM_ERROR', 'CLIPBOARD_COPY_FAILED',
  'DEVICE_REVOKE_FAILED', 'DEVICE_RENAME_FAILED', 'DIAGNOSTICS_STATE_RESET',
])

const DUPLICATE_WINDOW_MS = 5_000

function eventSignature(level: DiagnosticLevel, code: DiagnosticCode, context: Readonly<Record<string, DiagnosticValue>> | undefined): string {
  return JSON.stringify([level, code, context === undefined ? [] : Object.entries(context).sort(([left], [right]) => left.localeCompare(right))])
}

function safeContext(value: Readonly<Record<string, DiagnosticValue>>): Readonly<Record<string, DiagnosticValue>> | undefined {
  const result: Record<string, DiagnosticValue> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue
    if (typeof item === 'string') result[key] = item.replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, 80)
    else if (typeof item === 'number' && Number.isFinite(item)) result[key] = item
    else if (typeof item === 'boolean') result[key] = item
  }
  return Object.keys(result).length === 0 ? undefined : result
}

function normalizeEvent(value: unknown): DiagnosticEvent | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const event = value as Partial<DiagnosticEvent>
  if (typeof event.id !== 'string' || event.id.length > 64 || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at))
    || (event.level !== 'warn' && event.level !== 'error')
    || typeof event.code !== 'string' || !DIAGNOSTIC_CODES.has(event.code as DiagnosticCode)) return undefined
  const rawContext: Record<string, DiagnosticValue> = {}
  if (event.context !== null && typeof event.context === 'object' && !Array.isArray(event.context)) {
    for (const [key, item] of Object.entries(event.context)) {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') rawContext[key] = item
    }
  }
  const context = safeContext(rawContext)
  return {
    id: event.id,
    at: event.at,
    level: event.level,
    code: event.code as DiagnosticCode,
    ...(context === undefined ? {} : { context }),
  }
}

export class DiagnosticStore {
  private events: DiagnosticEvent[] = []
  private writeTail = Promise.resolve()

  constructor(
    private readonly file: string,
    private readonly maxEntries: number,
    private readonly enabled: boolean,
  ) {}

  async load(): Promise<void> {
    if (!this.enabled) return
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<StoredDiagnostics>
      if (parsed.version !== 1 || !Array.isArray(parsed.events)) throw new Error('unsupported diagnostics state')
      const normalized = parsed.events.flatMap(value => {
        const event = normalizeEvent(value)
        return event === undefined ? [] : [event]
      })
      this.events = normalized.slice(-this.maxEntries)
      if (this.events.length !== parsed.events.length) await this.persist().catch(() => undefined)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      this.events = []
      await this.record('warn', 'DIAGNOSTICS_STATE_RESET', { reason: 'unreadable_state' })
    }
  }

  list(): readonly DiagnosticEvent[] {
    return [...this.events].reverse()
  }

  record(level: DiagnosticLevel, code: DiagnosticCode, context: Readonly<Record<string, DiagnosticValue>> = {}): Promise<void> {
    if (!this.enabled) return Promise.resolve()
    const safe = safeContext(context)
    const now = Date.now()
    const signature = eventSignature(level, code, safe)
    if (this.events.some(event => now - Date.parse(event.at) < DUPLICATE_WINDOW_MS
      && eventSignature(event.level, event.code, event.context) === signature)) {
      return Promise.resolve()
    }
    const event: DiagnosticEvent = {
      id: randomUUID(),
      at: new Date().toISOString(),
      level,
      code,
      ...(safe === undefined ? {} : { context: safe }),
    }
    this.events.push(event)
    if (this.events.length > this.maxEntries) this.events.splice(0, this.events.length - this.maxEntries)
    return this.persist().catch(() => undefined)
  }

  async clear(): Promise<void> {
    this.events = []
    if (this.enabled) await this.persist()
  }

  private persist(): Promise<void> {
    const snapshot: StoredDiagnostics = { version: 1, events: [...this.events] }
    const write = this.writeTail.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.file)
    })
    this.writeTail = write.catch(() => undefined)
    return write
  }
}
