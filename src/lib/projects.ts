import type { ProjectItem, ProjectPriceEntry } from './types'

/** La opción más barata registrada para un artículo, o null si todavía no tiene ninguna. */
export function bestPriceFor(itemId: string, entries: ProjectPriceEntry[]): ProjectPriceEntry | null {
  const itemEntries = entries.filter((e) => e.projectItemId === itemId)
  if (itemEntries.length === 0) return null
  return itemEntries.reduce((best, e) => (e.price < best.price ? e : best))
}

/** Suma el mejor precio de cada artículo — el gasto estimado si compras siempre en la opción más barata. */
export function computeProjectEstimate(items: ProjectItem[], entries: ProjectPriceEntry[]): number {
  return items.reduce((sum, item) => {
    const best = bestPriceFor(item.id, entries)
    return sum + (best?.price ?? 0)
  }, 0)
}
