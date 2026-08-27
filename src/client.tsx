import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
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
}

interface Status {
  devices: Device[]
}

interface Pairing {
  url: string
  qrDataUrl: string
}

type FooterProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<typeof NS>
type LocalLinkFooterProps = FooterProps & { readonly getCurrentSessionId: () => string | undefined }

function desktopOrigin(): boolean {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1'
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
.dsh-local-link button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:40px;padding:8px 13px;border:1px solid var(--dsw-alias-border-normal,#cbd2dc);border-radius:10px;background:transparent;color:inherit;font:600 13px/1.2 system-ui;cursor:pointer}.dsh-local-link button:disabled{opacity:.55;cursor:wait}
.dsh-local-link__devices{display:grid}.dsh-local-link__device{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-subtle,#dce1e8)}.dsh-local-link__device:first-child{border-top:0}.dsh-local-link__device span{flex:1;min-width:0}
.dsh-local-link-footer{position:relative;width:100%;min-width:0}.dsh-local-link-trigger{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#16181d);font:400 14px/22px inherit;cursor:pointer;overflow:hidden}.dsh-local-link-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#e8ebef)}.dsh-local-link-trigger--rail{justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0;border-radius:50%}.dsh-local-link-trigger__label{white-space:nowrap;overflow:hidden}
.dsh-local-link-popover{position:fixed;z-index:10000;left:12px;bottom:96px;box-sizing:border-box;width:min(340px,calc(100vw - 24px));padding:16px;border:1px solid var(--dsw-alias-border-subtle,#dce1e8);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#16181d);box-shadow:0 18px 55px #0004}.dsh-local-link-popover strong{font-size:15px}.dsh-local-link-popover p{margin:8px 0;color:var(--dsw-alias-label-secondary,#66707c);font:13px/1.45 system-ui}.dsh-local-link-popover__address{display:block;padding:9px 10px;border-radius:9px;background:var(--dsw-alias-bg-layer-2,#eef1f5);font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.dsh-local-link-popover__qr{display:block;width:210px;height:210px;margin:12px auto 0;padding:7px;border-radius:12px;background:#fff}.dsh-local-link-popover__error{color:#c53030!important}
`

function LocalLinkFooter({ wide, t, getCurrentSessionId }: LocalLinkFooterProps): React.JSX.Element | null {
  const desktop = desktopOrigin()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [pairing, setPairing] = useState<Pairing>()
  const [error, setError] = useState(false)

  const createLink = useCallback(async () => {
    setPairing(undefined)
    setError(false)
    try {
      const nextPairing = await jsonRequest<Pairing>('/__dsh-local-link/admin/pairing', {
        method: 'POST',
        body: JSON.stringify({ sessionId: getCurrentSessionId() }),
      })
      setAddress(new URL(nextPairing.url).origin)
      setPairing(nextPairing)
    } catch { setError(true) }
  }, [getCurrentSessionId])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent): void => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  if (!desktop) return null
  return <div className="dsh-local-link-footer" ref={root}>
    <button className={`dsh-local-link-trigger${wide ? '' : ' dsh-local-link-trigger--rail'}`} type="button" title={t('footer.trigger')} aria-label={t('footer.trigger')} aria-expanded={open} onClick={() => {
      const next = !open
      setOpen(next)
      if (next) void createLink()
    }}>
      <svg aria-hidden="true" width={wide ? 16 : 18} height={wide ? 16 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M9 5.5h6M11 18.5h2"/></svg>
      {wide && <span className="dsh-local-link-trigger__label">{t('footer.trigger')}</span>}
    </button>
    {open && <section className="dsh-local-link-popover" aria-label={t('connect.title')}>
      <strong>{t('connect.title')}</strong>
      <p>{t('connect.description')}</p>
      {address && <code className="dsh-local-link-popover__address">{address}</code>}
      {!pairing && !error && <p>{t('connect.creating')}</p>}
      {error && <p className="dsh-local-link-popover__error">{t('connect.error')}</p>}
      {pairing && <img className="dsh-local-link-popover__qr" src={pairing.qrDataUrl} alt={t('connect.qrAlt')} />}
    </section>}
  </div>
}

function LocalLinkSettings({ t }: PropsLocale<typeof NS>): React.JSX.Element {
  const [status, setStatus] = useState<Status>()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState(false)

  const loadDevices = useCallback(async () => {
    try {
      setStatus(await jsonRequest<Status>('/__dsh-local-link/admin/devices'))
      setError(false)
    } catch { setError(true) }
  }, [])

  useEffect(() => { void loadDevices() }, [loadDevices])

  const revoke = async (id: string): Promise<void> => {
    setBusyId(id)
    try {
      await jsonRequest('/__dsh-local-link/admin/revoke', { method: 'POST', body: JSON.stringify({ id }) })
      await loadDevices()
    } catch { setError(true) }
    finally { setBusyId(undefined) }
  }

  return <section className="dsh-local-link">
    <h2>{t('devices.title')}</h2>
    <p>{t('devices.description')}</p>
    <div className="dsh-local-link__card">
      <div className="dsh-local-link__devices">
        {error ? <p>{t('devices.error')}</p> : status === undefined ? <p>{t('devices.loading')}</p> : status.devices.length ? status.devices.map(device => <div className="dsh-local-link__device" key={device.id}><span>{device.label}</span><button disabled={busyId !== undefined} type="button" onClick={() => void revoke(device.id)}>{busyId === device.id ? t('devices.revoking') : t('devices.revoke')}</button></div>) : <p>{t('devices.empty')}</p>}
      </div>
    </div>
  </section>
}

export const inject = ['connection', 'slots', 'locale', 'sessions']

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
  }, 'dsh-local-link: interface styles')

  ctx.effect(() => {
    const getCurrentSessionId = (): string | undefined => ctx.sessions.list.getSnapshot().current
    const Footer = (props: FooterProps): React.JSX.Element => <LocalLinkFooter {...props} getCurrentSessionId={getCurrentSessionId} />
    return ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'local-link-connect',
      order: 20,
      locale: NS,
    }, Footer))
  }, 'dsh-local-link: sidebar connection action')

  ctx.effect(() => {
    if (!desktopOrigin()) return () => undefined
    return ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'local-access-devices',
      order: 12,
      label: () => ctx.locale.bind(NS)('nav'),
      locale: NS,
    }, LocalLinkSettings))
  }, 'dsh-local-link: paired devices settings')
}
