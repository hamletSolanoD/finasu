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
 * Por qué se ignora un popstate que aterriza TODAVÍA sobre nuestra propia
 * marca de guardia: mientras esta pantalla está activa, es normal que se
 * abran OTROS modales encima (ej. el confirm de "guardar cambios
 * definitivamente", o cualquier otro que no pase skipHistoryBack) — cada uno
 * empuja y limpia su PROPIA entrada de historial (useModalBack) al
 * abrirse/cerrarse. Si NO se ignora, el popstate que dispara la limpieza de
 * ESE OTRO modal se malinterpreta aquí como "el usuario quiere salir de la
 * pantalla" y aparece un aviso fantasma de "¿seguro que quieres salir?" en
 * medio de un flujo que no tiene nada que ver. La regla es simple: si
 * después del pop la marca `__finasuLeaveGuard` sigue presente, lo que se
 * cerró fue algo apilado ENCIMA — no se perdió nuestra propia entrada, así
 * que no hay nada real que preguntar.
 *
 * Por qué onLeave navega en vez de repetir el back(): un back() de verdad,
 * justo cuando además puede haber otro history.back() de un modal cerrándose
 * al mismo tiempo, corre en carrera (orden no garantizado) y puede dejar a
 * la pantalla sin salir de verdad pese a haber confirmado "salir". Navegar
 * directo (normalmente a Inicio) evita la carrera por completo.
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
      if (window.history.state?.__finasuLeaveGuard) return

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
