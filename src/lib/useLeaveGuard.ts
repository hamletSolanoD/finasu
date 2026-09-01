import { useEffect, useRef } from 'react'

/**
 * Igual que useModalBack pero para una pantalla completa en vez de un modal:
 * mientras `active` sea true, el botón atrás del teléfono NO navega directo —
 * primero se repone la posición (para no llegar a salirse) y se llama a
 * `onAttemptLeave`, que decide qué hacer (ej. mostrar un confirm preguntando
 * si de verdad quiere salir). No intercepta clicks en links normales — para
 * eso, cada pantalla debe llamar a la misma función antes de navegar (ver
 * BackLink con onBeforeLeave).
 *
 * Por qué reponer la posición ANTES de llamar a onAttemptLeave (no después):
 * onAttemptLeave puede tardar (espera a que el usuario decida en un modal), y
 * para entonces react-router ya habría procesado el popstate y esta pantalla
 * ya estaría desmontada. Reponiendo de inmediato (mismo tick, sin esperar
 * nada async) la URL nunca cambia de verdad — la pantalla sigue montada y el
 * confirm se puede mostrar con tranquilidad.
 */
export function useLeaveGuard(active: boolean, onAttemptLeave: () => unknown): void {
  const onAttemptLeaveRef = useRef(onAttemptLeave)
  onAttemptLeaveRef.current = onAttemptLeave

  useEffect(() => {
    if (!active) return
    window.history.pushState({ ...window.history.state, __finasuLeaveGuard: true }, '')

    function handlePopstate() {
      window.history.pushState({ ...window.history.state, __finasuLeaveGuard: true }, '')
      onAttemptLeaveRef.current()
    }

    window.addEventListener('popstate', handlePopstate)
    return () => {
      window.removeEventListener('popstate', handlePopstate)
      if (window.history.state?.__finasuLeaveGuard) {
        window.history.back()
      }
    }
  }, [active])
}
