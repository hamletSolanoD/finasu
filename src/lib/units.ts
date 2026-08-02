import type { Unit, UnitKind } from './types'

export const UNIT_KINDS: { value: UnitKind; label: string }[] = [
  { value: 'peso', label: 'Peso' },
  { value: 'volumen', label: 'Volumen' },
  { value: 'unidad', label: 'Piezas' },
]

export const UNITS_BY_KIND: Record<UnitKind, { value: Unit; label: string }[]> = {
  peso: [
    { value: 'g', label: 'gramos (g)' },
    { value: 'kg', label: 'kilogramos (kg)' },
  ],
  volumen: [
    { value: 'ml', label: 'mililitros (ml)' },
    { value: 'L', label: 'litros (L)' },
  ],
  unidad: [{ value: 'ud', label: 'piezas (ud)' }],
}

export function unitKindOf(unit: Unit): UnitKind {
  if (unit === 'g' || unit === 'kg') return 'peso'
  if (unit === 'ml' || unit === 'L') return 'volumen'
  return 'unidad'
}

/** Convierte a la unidad base de comparación: gramos, mililitros o piezas. */
function toBaseAmount(amount: number, unit: Unit): number {
  switch (unit) {
    case 'kg':
      return amount * 1000
    case 'L':
      return amount * 1000
    default:
      return amount
  }
}

/** Precio por unidad base (gramo, ml o pieza). Útil para comparar cualquier combinación de presentaciones. */
export function unitPricePerBase(price: number, amount: number, unit: Unit): number {
  const base = toBaseAmount(amount, unit)
  if (base <= 0) return 0
  return price / base
}

/** Precio por unidad base: gramo, mililitro o pieza (sin normalizar a kg/L). */
export function displayUnitPrice(price: number, amount: number, unit: Unit): { value: number; label: string } {
  const kind = unitKindOf(unit)
  const perBase = unitPricePerBase(price, amount, unit)
  if (kind === 'peso') return { value: perBase, label: '/g' }
  if (kind === 'volumen') return { value: perBase, label: '/ml' }
  return { value: perBase, label: '/ud' }
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

/** Precios por gramo/ml son muy pequeños; se muestran con más decimales que una moneda normal. */
export function formatUnitPrice(value: number, label: string): string {
  const decimals = label === '/ud' ? 2 : 3
  return `$${value.toFixed(decimals)}`
}
