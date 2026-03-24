import type { Action } from 'svelte/action'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export const focusTrap: Action<HTMLElement, { enabled: boolean }> = (node, params) => {
  let previousFocus: HTMLElement | null = null

  function getFocusable() {
    return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => !el.hasAttribute('disabled'))
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!params?.enabled) return

    if (e.key === 'Escape') {
      node.dispatchEvent(new CustomEvent('escape'))
      return
    }

    if (e.key !== 'Tab') return

    const focusable = getFocusable()
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function activate() {
    previousFocus = document.activeElement as HTMLElement
    node.addEventListener('keydown', handleKeydown)
    const focusable = getFocusable()
    if (focusable.length > 0) focusable[0].focus()
  }

  function deactivate() {
    node.removeEventListener('keydown', handleKeydown)
    previousFocus?.focus()
    previousFocus = null
  }

  if (params?.enabled) activate()

  return {
    update(newParams) {
      params = newParams
      if (newParams.enabled) {
        activate()
      } else {
        deactivate()
      }
    },
    destroy() {
      deactivate()
    }
  }
}
