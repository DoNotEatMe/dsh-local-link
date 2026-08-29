import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Focus lifecycle for plugin-owned mobile modal surfaces. */
export function useMobileDialog(open: boolean, close: () => void): RefObject<HTMLElement> {
  const dialog = useRef<HTMLElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const frame = window.requestAnimationFrame(() => {
      const first = dialog.current?.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? dialog.current)?.focus({ preventScroll: true })
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || dialog.current === null) return
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter(element => !element.hidden && element.getClientRects().length > 0)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.current.focus({ preventScroll: true })
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected === true) previous.focus({ preventScroll: true })
    }
  }, [open])

  return dialog
}
