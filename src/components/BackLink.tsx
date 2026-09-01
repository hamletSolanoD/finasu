import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { previousPathname } from '../lib/navigationHistory'

/**
 * Link de "← atrás" que evita el ping-pong del botón físico del teléfono: si
 * llegaste a esta pantalla DESDE la pantalla a la que apunta, regresa con un
 * history.back() de verdad (consume la entrada) en vez de apilar otra copia —
 * sin esto, Lista→Detalle→"← Lista"→Detalle... deja un historial kilométrico
 * y el botón atrás "te devuelve a lugares que ya no quieres". Si llegaste por
 * otro camino (deep link, acceso directo), navega normal.
 *
 * onBeforeLeave es opcional: si se pasa, se espera su resultado antes de
 * navegar — resolver a false cancela la salida (ej. la pantalla de límites
 * usa esto para avisar de cambios sin guardar, ver useMonthDraftGuard).
 */
export function BackLink({
  to,
  children,
  className = 'text-sm text-black/50 hover:text-black/70',
  onBeforeLeave,
}: {
  to: string
  children: ReactNode
  className?: string
  onBeforeLeave?: () => Promise<boolean>
}) {
  const navigate = useNavigate()

  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        void (async () => {
          if (onBeforeLeave) {
            const ok = await onBeforeLeave()
            if (!ok) return
          }
          if (previousPathname() === to) {
            navigate(-1)
          } else {
            navigate(to)
          }
        })()
      }}
    >
      {children}
    </Link>
  )
}
