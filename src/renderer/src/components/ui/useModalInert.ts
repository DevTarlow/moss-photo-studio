import { useEffect } from 'react'

let openModalCount = 0

/**
 * One modal surface for assistive technology. Radix can hide individual
 * background nodes, which leaves unnamed controls exposed in this shell, so a
 * single inert #root owns the background instead. The counter keeps nested
 * dialogs from revealing the page when one closes.
 */
export function useModalInert(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root')
    if (!root) return
    openModalCount += 1
    if (openModalCount === 1) {
      root.setAttribute('aria-hidden', 'true')
      root.setAttribute('inert', '')
    }
    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        root.removeAttribute('aria-hidden')
        root.removeAttribute('inert')
      }
    }
  }, [open])
}
