import React, { useEffect, useSyncExternalStore } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'

const NS = 'dsh.localLink'

export const MOBILE_ROOT_CHILDREN = {
  sidebar: { kind: 'single', scope: 'root' },
  conversation: { kind: 'single', scope: 'session-maybe' },
  details: { kind: 'single', scope: 'session' },
  'shell.overlay': { kind: 'list', scope: 'root' },
} as const

interface LayoutSnapshot {
  readonly sidebarOpen: boolean
  readonly detailsOpen: boolean
}

interface MobileLabels {
  readonly closeOverlay: string
  readonly openNavigation: string
  readonly navigation: string
  readonly details: string
}

type MobileRootProps = PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>
  & { readonly controller: MobileLayoutController; readonly labels: MobileLabels }

class MobileLayoutController implements ILayout {
  private snapshot: LayoutSnapshot = Object.freeze({ sidebarOpen: false, detailsOpen: false })
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): LayoutSnapshot => this.snapshot

  toggleSidebar(): void {
    this.update({ sidebarOpen: !this.snapshot.sidebarOpen, detailsOpen: false })
  }

  openDetails(): void {
    this.update({ detailsOpen: true, sidebarOpen: false })
  }

  closeDetails(): void {
    this.update({ detailsOpen: false })
  }

  closeSidebar(): void {
    this.update({ sidebarOpen: false })
  }

  closeOverlay(): void {
    if (this.snapshot.detailsOpen) this.closeDetails()
    else this.closeSidebar()
  }

  private update(next: Partial<LayoutSnapshot>): void {
    const snapshot = Object.freeze({ ...this.snapshot, ...next })
    if (snapshot.sidebarOpen === this.snapshot.sidebarOpen && snapshot.detailsOpen === this.snapshot.detailsOpen) return
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

interface ThemeSnapshot {
  readonly active: {
    readonly colorScheme: 'dark' | 'light'
    readonly tokens: Readonly<Record<string, string>>
  }
}

class ThemePresenter {
  private readonly meta = document.createElement('meta')
  private appliedTokens: string[] = []

  constructor() {
    this.meta.name = 'theme-color'
  }

  apply(snapshot: ThemeSnapshot): void {
    document.documentElement.style.colorScheme = snapshot.active.colorScheme
    document.body.toggleAttribute('data-ds-dark-theme', snapshot.active.colorScheme === 'dark')
    for (const name of this.appliedTokens) document.body.style.removeProperty(name)
    this.appliedTokens = []
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      document.body.style.setProperty(name, value)
      this.appliedTokens.push(name)
    }
    this.meta.content = getComputedStyle(document.body).backgroundColor
    if (!this.meta.isConnected) document.head.append(this.meta)
  }

  dispose(): void {
    document.documentElement.style.removeProperty('color-scheme')
    document.body.removeAttribute('data-ds-dark-theme')
    for (const name of this.appliedTokens) document.body.style.removeProperty(name)
    this.meta.remove()
  }
}

export const MOBILE_LAYOUT_STYLES = `
html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}
.dllm-shell{position:relative;isolation:isolate;display:grid;width:100dvw;height:100dvh;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#fff)}
.dllm-main{grid-area:1/1;width:100dvw;max-width:100%;min-width:0;min-height:0;overflow:hidden}
.dllm-main>*,.dllm-main>*>*{min-width:0;max-width:100%}
.dllm-menu{position:fixed;z-index:60;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));display:grid;width:44px;height:44px;place-items:center;border:1px solid var(--dsw-alias-border-subtle,rgb(148 163 184 / 30%));border-radius:12px;color:inherit;background:var(--dsw-alias-bg-layer-1,rgb(255 255 255 / 92%));box-shadow:0 8px 24px rgb(15 23 42 / 14%);backdrop-filter:blur(12px);transition:opacity 120ms ease,transform 120ms ease}
.dllm-menu[data-hidden=true]{opacity:0;transform:scale(.9);pointer-events:none}
.dllm-menu svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.dllm-drawer{position:fixed;z-index:70;inset:0 auto 0 0;box-sizing:border-box;width:min(88vw,340px);max-width:100%;padding-top:env(safe-area-inset-top);overflow:hidden;background:var(--dsw-alias-bg-layer-1,#f8fafc);box-shadow:18px 0 46px rgb(15 23 42 / 18%);transform:translateX(-104%);visibility:hidden;pointer-events:none;transition:transform 190ms cubic-bezier(.22,1,.36,1),visibility 0s linear 190ms}
.dllm-drawer[data-open=true]{transform:translateX(0);visibility:visible;pointer-events:auto;transition:transform 190ms cubic-bezier(.22,1,.36,1)}
.dllm-drawer>*{width:100%!important;height:100%!important}
.dllm-details{position:fixed;z-index:80;inset:0 0 0 auto;box-sizing:border-box;width:min(94vw,460px);max-width:100%;padding-top:env(safe-area-inset-top);overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:-18px 0 46px rgb(15 23 42 / 18%);transform:translateX(104%);transition:transform 190ms cubic-bezier(.22,1,.36,1),visibility 0s linear 190ms;visibility:hidden;pointer-events:none}
.dllm-details[data-open=true]{transform:translateX(0);visibility:visible;pointer-events:auto;transition:transform 190ms cubic-bezier(.22,1,.36,1)}
.dllm-scrim{position:fixed;z-index:65;inset:0;border:0;padding:0;background:rgb(15 23 42 / 40%);opacity:0;pointer-events:none;transition:opacity 180ms ease-out}
.dllm-scrim[data-open=true]{opacity:1;pointer-events:auto}
.dllm-overlay{position:fixed;z-index:90;inset:0;pointer-events:none}.dllm-overlay>*{pointer-events:auto}
.dllm-shell header{min-width:0;padding-left:max(58px,env(safe-area-inset-left))}
.dllm-shell textarea,.dllm-shell input{font-size:max(16px,1em)}
.dllm-shell [role=tablist]{display:flex;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:none}
.dllm-shell [role=tablist]::-webkit-scrollbar{display:none}.dllm-shell [role=tab]{flex:0 0 auto;min-height:40px;touch-action:manipulation}
.dllm-shell pre,.dllm-shell table{max-width:100%;overflow-x:auto}.dllm-shell img,.dllm-shell video,.dllm-shell canvas{max-width:100%}
.dllm-shell [data-conversation-scroll]{overscroll-behavior:contain;padding-bottom:env(safe-area-inset-bottom)}
.dllm-shell button,.dllm-shell [role=button]{touch-action:manipulation}
@media(prefers-reduced-motion:reduce){.dllm-drawer,.dllm-details,.dllm-scrim{transition:none!important}}
`

export function MobileAppFrame({ controller, labels, renderSlot, useSessions }: MobileRootProps): React.JSX.Element {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const hasSession = useSessions(session => {
    const current = session.current
    return current !== undefined && session.byId[current]?.blank === false
  })

  useEffect(() => {
    if (!hasSession) controller.closeDetails()
  }, [controller, hasSession])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.closeOverlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller])

  const overlayOpen = state.sidebarOpen || state.detailsOpen
  return <div className="dllm-shell">
    <main className="dllm-main">{renderSlot('conversation', {})}</main>
    <button
      aria-label={labels.openNavigation}
      className="dllm-menu"
      data-hidden={overlayOpen}
      tabIndex={overlayOpen ? -1 : 0}
      type="button"
      onClick={() => controller.toggleSidebar()}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <button
      aria-label={labels.closeOverlay}
      className="dllm-scrim"
      data-open={overlayOpen}
      tabIndex={overlayOpen ? 0 : -1}
      type="button"
      onClick={() => controller.closeOverlay()}
    />
    <aside
      aria-label={labels.navigation}
      className="dllm-drawer"
      data-open={state.sidebarOpen}
      onClickCapture={event => {
        const target = event.target
        if (!(target instanceof Element)) return
        const item = target.closest<HTMLElement>('[role="treeitem"]')
        if (item !== null && item.getAttribute('aria-expanded') === null) {
          window.setTimeout(() => controller.closeSidebar(), 0)
        }
      }}
    >
      {renderSlot('sidebar', { collapsed: false, width: 340 })}
    </aside>
    <aside aria-hidden={!state.detailsOpen} aria-label={labels.details} className="dllm-details" data-open={state.detailsOpen}>
      {hasSession ? renderSlot('details', {}) : null}
    </aside>
    <div className="dllm-overlay" data-shell-overlay>{renderSlot('shell.overlay', {})}</div>
  </div>
}

export const inject = ['slots', 'theme', 'locale']

export function apply(ctx: ClientContext): void {
  const controller = new MobileLayoutController()
  const t = ctx.locale.bind(NS)
  const labels: MobileLabels = {
    closeOverlay: t('mobile.closeOverlay'),
    openNavigation: t('mobile.openNavigation'),
    navigation: t('mobile.navigation'),
    details: t('mobile.details'),
  }

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-local-link-mobile-layout'
    style.textContent = MOBILE_LAYOUT_STYLES
    document.head.append(style)
    const disposeLayout = ctx.reflect.provide('layout', controller)
    const disposeRoot = ctx.slots.register({
      name: 'root',
      children: MOBILE_ROOT_CHILDREN,
    }, props => <MobileAppFrame {...props} controller={controller} labels={labels} />)
    return () => {
      disposeRoot()
      void disposeLayout()
      style.remove()
    }
  }, 'dsh-local-link: slot-preserving mobile root layout')

  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', snapshot => presenter.apply(snapshot))
    return () => {
      off()
      presenter.dispose()
    }
  }, 'dsh-local-link: mobile theme presenter')
}
