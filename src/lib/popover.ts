import { useEffect, useState, type RefObject } from 'react'

type CloseFn = () => void

const openPopovers = new Set<CloseFn>()

/** Cierra cualquier otro desplegable/calendario abierto antes de abrir este — nunca dos a la vez. */
export function notifyPopoverOpen(close: CloseFn): void {
  for (const fn of openPopovers) {
    if (fn !== close) fn()
  }
  openPopovers.add(close)
}

export function notifyPopoverClosed(close: CloseFn): void {
  openPopovers.delete(close)
}

export interface FloatingPosition {
  top: number
  left: number
  triggerWidth: number
}

/**
 * Posición fija (viewport) de un panel flotante anclado a un trigger. Se usa
 * junto con un portal a document.body para que el panel no quede recortado
 * por algún ancestro con overflow-hidden (ej. SwipeableRow). Se recalcula
 * mientras está abierto si la página hace scroll o cambia de tamaño.
 *
 * panelWidth es opcional: si no se da, el panel se ancla al ancho del
 * trigger (ej. Dropdown, que siempre cabe porque mide lo mismo); si se da
 * (ej. DatePicker, más ancho que su trigger), se usa para no salirse por la
 * derecha de la pantalla.
 */
export function useFloatingPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  panelHeight: number,
  panelWidth?: number,
): FloatingPosition | null {
  const [pos, setPos] = useState<FloatingPosition | null>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null)
      return
    }

    function reposition() {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 4

      // visualViewport refleja el área realmente visible (en iOS/Android, el
      // teclado en pantalla encoge esto sin cambiar window.innerHeight/Width,
      // lo que hacía que el panel apareciera desalineado del trigger real).
      const vv = window.visualViewport
      const viewportHeight = vv?.height ?? window.innerHeight
      const viewportWidth = vv?.width ?? window.innerWidth
      const offsetLeft = vv?.offsetLeft ?? 0
      const offsetTop = vv?.offsetTop ?? 0

      let top = rect.bottom + margin - offsetTop
      if (top + panelHeight > viewportHeight && rect.top - margin - panelHeight - offsetTop > 0) {
        top = rect.top - margin - panelHeight - offsetTop
      }

      const width = panelWidth ?? rect.width
      let left = rect.left - offsetLeft
      if (left + width > viewportWidth) {
        left = Math.max(8, viewportWidth - width - 8)
      }

      setPos({ top, left, triggerWidth: rect.width })
    }

    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
    }
  }, [open, triggerRef, panelHeight, panelWidth])

  return pos
}
