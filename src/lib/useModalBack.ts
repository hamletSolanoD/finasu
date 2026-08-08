import { useEffect, useRef } from 'react'

/**
 * Hace que el botón "atrás" del teléfono cierre el modal en vez de sacarte de
 * la pantalla completa (que es lo que uno espera en una PWA en celular).
 *
 * Cómo funciona: cuando el modal se abre, metemos una entrada EXTRA al
 * historial con pushState usando la MISMA url y un state marcado con
 * __finasuModal. react-router v7 con BrowserRouter convive bien con estas
 * entradas: como la url no cambia, el router no re-renderiza rutas distintas —
 * solo crece el historial del navegador en uno. Hay dos formas de cerrar:
 *
 * 1. Botón atrás del teléfono → se dispara popstate (la entrada extra se
 *    consume sola) → llamamos onClose().
 * 2. Botón ✕ / tocar el overlay → open pasa a false sin popstate → en el
 *    cleanup hacemos history.back() nosotros para limpiar la entrada extra
 *    (si no, quedaría un "atrás" muerto que no hace nada).
 *
 * El ref closedByPopstate distingue ambos caminos para no hacer back doble, y
 * onClose vive en un ref actualizado en cada render para no re-suscribir el
 * listener cuando el callback cambie de identidad.
 */
export function useModalBack(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closedByPopstateRef = useRef(false)

  useEffect(() => {
    if (!open) return
    closedByPopstateRef.current = false
    window.history.pushState({ __finasuModal: true }, '')

    function handlePopstate() {
      closedByPopstateRef.current = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopstate)
    return () => {
      window.removeEventListener('popstate', handlePopstate)
      // Cierre por botón/overlay (o desmontaje): la entrada extra sigue viva en
      // el historial — la quitamos nosotros. El chequeo de __finasuModal evita
      // un back() equivocado si algo más ya navegó (ej. un Link dentro del
      // modal que cerró y cambió de ruta a la vez).
      if (!closedByPopstateRef.current && window.history.state?.__finasuModal) {
        window.history.back()
      }
    }
  }, [open])
}
