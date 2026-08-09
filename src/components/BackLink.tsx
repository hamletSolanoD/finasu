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
 */
export function BackLink({
  to,
  children,
  className = 'text-sm text-black/50 hover:text-black/70',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const navigate = useNavigate()

  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        if (previousPathname() === to) {
          e.preventDefault()
          navigate(-1)
        }
      }}
    >
      {children}
    </Link>
  )
}
