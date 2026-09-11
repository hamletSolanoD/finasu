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

/**
 * Unidades válidas para el contenido de CADA pieza de un pack (PriceEntry.pieceUnit):
 * todo menos 'ud' — una pieza contiene gramos o mililitros, no más piezas.
 */
export const PIECE_CONTENT_UNITS: { value: Exclude<Unit, 'ud'>; label: string }[] = [
  { value: 'g', label: 'gramos (g)' },
  { value: 'kg', label: 'kilogramos (kg)' },
  { value: 'ml', label: 'mililitros (ml)' },
  { value: 'L', label: 'litros (L)' },
]

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

/**
 * Precio por unidad base: gramo, mililitro o pieza (sin normalizar a kg/L).
 *
 * Packs por pieza: si una entrada en piezas ('ud') trae amountPerPiece/pieceUnit,
 * la comparación usa el contenido REAL total (amount × amountPerPiece, en la base
 * de pieceUnit) en vez de comparar por pieza. Ejemplo: pack de 4 jabones de 90 g
 * a $60 → contenido real 4 × 90 g = 360 g → $60/360 = $0.167/g; un jabón suelto
 * registrado como 1 pza de 200 g a $40 → 200 g → $0.20/g. Así el pack compite por
 * gramo contra la pieza suelta y gana aquí. Si la entrada no trae esos campos,
 * se compara por pieza como siempre ($/ud).
 */
export function displayUnitPrice(
  price: number,
  amount: number,
  unit: Unit,
  amountPerPiece?: number,
  pieceUnit?: Exclude<Unit, 'ud'>,
): { value: number; label: string } {
  if (unit === 'ud' && amountPerPiece != null && amountPerPiece > 0 && pieceUnit) {
    const totalBase = toBaseAmount(amountPerPiece, pieceUnit) * amount
    if (totalBase > 0) {
      return { value: price / totalBase, label: unitKindOf(pieceUnit) === 'peso' ? '/g' : '/ml' }
    }
  }
  const kind = unitKindOf(unit)
  const perBase = unitPricePerBase(price, amount, unit)
  if (kind === 'peso') return { value: perBase, label: '/g' }
  if (kind === 'volumen') return { value: perBase, label: '/ml' }
  return { value: perBase, label: '/ud' }
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Precios por gramo/ml son muy pequeños; se muestran con más decimales que una moneda normal. */
export function formatUnitPrice(value: number, label: string): string {
  const decimals = label === '/ud' ? 2 : 3
  return `$${value.toFixed(decimals)}`
}
