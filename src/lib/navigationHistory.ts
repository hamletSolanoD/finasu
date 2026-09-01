import type { NavigateFunction } from 'react-router-dom'

/**
 * Registro propio de qué ruta se visitó en cada posición del historial del
 * navegador — indexado por el `idx` que react-router guarda en history.state.
 * Sirve para que BackLink sepa si "← atrás" debe consumir la entrada anterior
 * (history.back()) o navegar normal. Indexar por idx (y no un stack propio)
 * hace que back/forward del navegador no descuadren el registro.
 */
const pathsByIdx: (string | undefined)[] = []

/** Lo llama Layout en cada cambio de ruta (después de navegar, cuando idx ya es el nuevo). */
export function recordVisit(pathname: string): void {
  const idx = (window.history.state?.idx as number | undefined) ?? 0
  pathsByIdx[idx] = pathname
  // Un push después de un back invalida el "futuro" viejo del historial.
  pathsByIdx.length = idx + 1
}

/** La ruta desde la que se llegó a la actual — null si no hay (deep link, recarga). */
export function previousPathname(): string | null {
  const idx = (window.history.state?.idx as number | undefined) ?? 0
  return idx > 0 ? (pathsByIdx[idx - 1] ?? null) : null
}

/**
 * Para "regresar" después de completar una acción (ej. guardar un gasto y
 * volver a /gastos): si llegaste a la pantalla actual DESDE `hub`, hace un
 * history.back() de verdad (consume la entrada, historial no crece). Si no
 * (entraste por otro camino — deep link, acceso directo), navega a `hub`
 * reemplazando la entrada actual en vez de apilar una nueva.
 *
 * Sin esto, guardar varios gastos seguidos (escanear/agregar → guardar →
 * escanear/agregar → guardar...) apila una entrada de historial por cada
 * ronda, y el botón atrás del teléfono termina "regresando por todos los
 * gastos que ya hiciste" en vez de a donde estabas antes de empezar.
 */
export function smartBack(navigate: NavigateFunction, hub: string): void {
  if (previousPathname() === hub) {
    navigate(-1)
  } else {
    navigate(hub, { replace: true })
  }
}

/**
 * La sección de primer nivel de una ruta — el primer segmento del path (o
 * '/' para Inicio). Todo lo que cuelga de /gastos/* (categorías, detalle de
 * un gasto, escanear...) es la misma sección "/gastos".
 */
export function topLevelSection(pathname: string): string {
  if (pathname === '/') return '/'
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  return firstSegment ? `/${firstSegment}` : '/'
}
