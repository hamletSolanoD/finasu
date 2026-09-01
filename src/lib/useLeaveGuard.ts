import { useEffect, useRef } from 'react'

/**
 * Igual que useModalBack pero para una pantalla completa en vez de un modal:
 * mientras `active` sea true, el botón atrás del teléfono NO navega directo —
 * primero se repone la posición (para no llegar a salirse) y se llama a
 * `onAttemptLeave`, que decide qué hacer (ej. mostrar un confirm preguntando
 * si de verdad quiere salir) y devuelve si al final sí hay que salir — en ese
 * caso se llama a `onLeave` (navegación explícita, normalmente a Inicio). No
 * intercepta clicks en links normales — para eso, cada pantalla debe llamar
 * a la misma función antes de navegar (ver BackLink con onBeforeLeave).
 *
 * Por qué reponer la posición ANTES de llamar a onAttemptLeave (no después):
 * onAttemptLeave puede tardar (espera a que el usuario decida en un modal), y
 * para entonces react-router ya habría procesado el popstate y esta pantalla
 * ya estaría desmontada. Reponiendo de inmediato (mismo tick, sin esperar
 * nada async) la URL nunca cambia de verdad — la pantalla sigue montada y el
 * confirm se puede mostrar con tranquilidad.
 *
 * Por qué onLeave navega en vez de repetir el back(): onAttemptLeave suele
 * mostrar su propio confirm (ConfirmModal), que por defecto TAMBIÉN usa
 * useModalBack y empuja/limpia su PROPIA entrada de historial al
 * abrirse/cerrarse — encima de la entrada de guardia (mismo idx, apilada).
 * Intentar "reproducir" el back original con otro history.back() justo
 * cuando el modal también está limpiando el suyo corre en carrera con esa
 * limpieza (dos history.back() casi simultáneos, orden no garantizado) y
 * puede dejar a la pantalla sin salir de verdad pese a haber confirmado
 * "salir". Por eso onLeave navega directo (sin depender del orden), Y el
 * confirm que se muestre desde onAttemptLeave debería pasar
 * `skipHistoryBack: true` (ver ConfirmModal) para no competir en primer
 * lugar — las dos cosas juntas, no una sola, es lo que lo deja robusto.
 */
export function useLeaveGuard(
  active: boolean,
  onAttemptLeave: () => boolean | Promise<boolean>,
  onLeave: () => void,
): void {
  const onAttemptLeaveRef = useRef(onAttemptLeave)
  onAttemptLeaveRef.current = onAttemptLeave
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave

  useEffect(() => {
    if (!active) return
    window.history.pushState({ ...window.history.state, __finasuLeaveGuard: true }, '')

    async function handlePopstate() {
      window.history.pushState({ ...window.history.state, __finasuLeaveGuard: true }, '')
      const shouldLeave = await onAttemptLeaveRef.current()
      if (shouldLeave) onLeaveRef.current()
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
