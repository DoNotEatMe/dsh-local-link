import React, { useCallback, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import en from './locales/en.json' with { type: 'json' }
import zh from './locales/zh.json' with { type: 'json' }

const NS = 'dsh.localLink'
type LocaleKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh.localLink': LocaleKey
  }
}

declare global {
  interface Window {
    __DSH_LOCAL_LINK_AUTHENTICATED__?: boolean
  }
}

interface Device {
  id: string
  label: string
  createdAt: string
  lastSeenAt: string
}

interface Status {
  running: boolean
  accessMode: 'pairing' | 'trusted-lan'
  addresses: string[]
  devices: Device[]
  insecureHttp: boolean
}

interface Pairing {
  url: string
  expiresAt: string
  qrDataUrl: string
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
  return body
}

const styles = `
.dsh-local-link{box-sizing:border-box;width:100%;max-width:720px;padding:4px 4px 32px;color:var(--dsw-alias-label-primary,#16181d)}
.dsh-local-link h2{margin:0 0 8px;font-size:20px}.dsh-local-link p{margin:0 0 16px;color:var(--dsw-alias-label-secondary,#66707c);line-height:1.55}
.dsh-local-link__card{margin:14px 0;padding:16px;border:1px solid var(--dsw-alias-border-subtle,#dce1e8);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#f7f8fa)}
.dsh-local-link__row{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-local-link__address{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
.dsh-local-link button,.dsh-local-link__link{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:40px;padding:8px 13px;border-radius:10px;font:600 13px/1.2 system-ui;cursor:pointer;text-decoration:none}
.dsh-local-link button{border:1px solid var(--dsw-alias-border-normal,#cbd2dc);background:transparent;color:inherit}.dsh-local-link__primary{border-color:#2878ff!important;background:#2878ff!important;color:#fff!important}.dsh-local-link button:disabled{opacity:.55;cursor:wait}
.dsh-local-link__pair{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}.dsh-local-link__qr{width:180px;height:180px;border-radius:12px;background:#fff;padding:8px}
.dsh-local-link__devices{display:grid;gap:8px}.dsh-local-link__device{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-subtle,#dce1e8)}.dsh-local-link__device:first-child{border-top:0}.dsh-local-link__device span{flex:1;min-width:0}.dsh-local-link__warning{padding:10px 12px;border-radius:10px;background:#fff4d6!important;color:#725400!important;font-size:12px}
@media(max-width:620px){.dsh-local-link__pair{grid-template-columns:1fr}.dsh-local-link__qr{justify-self:center}.dsh-local-link__row{align-items:stretch;flex-direction:column}}
`

function LocalLinkSettings({ t }: PropsLocale<typeof NS>): React.JSX.Element {
  const desktop = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1'
  const [status, setStatus] = useState<Status>()
  const [pairing, setPairing] = useState<Pairing>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    if (!desktop) return
    try {
      setStatus(await jsonRequest<Status>('/__dsh-local-link/admin/status'))
      setError(false)
    } catch { setError(true) }
  }, [desktop])

  useEffect(() => { void refresh() }, [refresh])

  const createPairing = async (): Promise<void> => {
    setBusy(true)
    try {
      setPairing(await jsonRequest<Pairing>('/__dsh-local-link/admin/pairing', { method: 'POST', body: '{}' }))
      setError(false)
    } catch { setError(true) }
    finally { setBusy(false) }
  }

  const revoke = async (id: string): Promise<void> => {
    setBusy(true)
    try {
      await jsonRequest('/__dsh-local-link/admin/revoke', { method: 'POST', body: JSON.stringify({ id }) })
      await refresh()
    } catch { setError(true) }
    finally { setBusy(false) }
  }

  if (!desktop) return <section className="dsh-local-link"><h2>{t('title')}</h2><p>{t('status.desktopOnly')}</p></section>
  const address = status?.addresses[0] ?? ''
  return <section className="dsh-local-link">
    <h2>{t('title')}</h2>
    <p>{t('description')}</p>
    <div className="dsh-local-link__card">
      <div className="dsh-local-link__row">
        <span className="dsh-local-link__address">{error ? t('status.error') : status === undefined ? t('status.loading') : status.running ? t('status.running', { address }) : t('status.stopped')}</span>
        <button type="button" onClick={() => void refresh()}>{t('refresh')}</button>
      </div>
      {status?.insecureHttp && <p className="dsh-local-link__warning">{t('security.http')}</p>}
    </div>
    {status?.accessMode === 'pairing' && <div className="dsh-local-link__card">
      {!pairing && <button className="dsh-local-link__primary" disabled={busy} type="button" onClick={() => void createPairing()}>{busy ? t('pair.creating') : t('pair.create')}</button>}
      {pairing && <div className="dsh-local-link__pair"><div><p>{t('pair.expires', { minutes: '5' })}</p><a className="dsh-local-link__link dsh-local-link__primary" href={pairing.url} target="_blank" rel="noreferrer">{t('pair.open')}</a></div><img className="dsh-local-link__qr" src={pairing.qrDataUrl} alt="Pairing QR code" /></div>}
    </div>}
    <div className="dsh-local-link__card">
      <h3>{t('devices.title')}</h3>
      <div className="dsh-local-link__devices">
        {status?.devices.length ? status.devices.map(device => <div className="dsh-local-link__device" key={device.id}><span>{device.label}</span><button disabled={busy} type="button" onClick={() => void revoke(device.id)}>{busy ? t('devices.revoking') : t('devices.revoke')}</button></div>) : <p>{t('devices.empty')}</p>}
      </div>
    </div>
  </section>
}

export const inject = ['connection', 'slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-local-link: locale dictionaries')

  ctx.effect(() => {
    if (window.__DSH_LOCAL_LINK_AUTHENTICATED__ !== true) return () => undefined
    const connection = ctx.get('connection') as { isLoopback: boolean }
    const previous = connection.isLoopback
    connection.isLoopback = true
    return () => { connection.isLoopback = previous }
  }, 'dsh-local-link: paired gateway trust hint')

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-local-link'
    style.textContent = styles
    document.head.append(style)
    return () => style.remove()
  }, 'dsh-local-link: settings styles')

  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'local-link',
    order: 12,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, LocalLinkSettings)), 'dsh-local-link: settings section')
}
