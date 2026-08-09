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
