import type { ExpenseItem, ExpenseStatus } from './types'

/** Un ticket queda "categorizado" solo cuando TODOS sus productos tienen categoría. */
export function computeExpenseStatus(
  items: Pick<ExpenseItem, 'categoryId'>[],
  currentStatus: ExpenseStatus,
): ExpenseStatus {
  if (items.length === 0) {
    return currentStatus === 'requiere_revision' ? 'requiere_revision' : 'pendiente_de_categorizar'
  }
  return items.every((i) => i.categoryId !== null) ? 'categorizado' : 'pendiente_de_categorizar'
}

interface DraftItemLike {
  nombre: string
  monto: string
}

/**
 * Separa los productos en borrador de un gasto en completos (nombre + monto
 * válido) e incompletos (les falta uno de los dos). Las filas totalmente
 * vacías (ni nombre ni monto) se descartan sin avisar — son espacio de sobra
 * que el usuario no llegó a usar. Antes, un producto con monto vacío se
 * guardaba como $0 sin aviso, y un producto existente al que se le borraba
 * el nombre se eliminaba de la base de datos sin aviso — ahora ambos casos
 * caen en "incomplete" para que el llamador pida confirmación explícita.
 */
export function splitDraftItems<T extends DraftItemLike>(items: T[]): { complete: T[]; incomplete: T[] } {
  const complete: T[] = []
  const incomplete: T[] = []
  for (const it of items) {
    const hasNombre = it.nombre.trim() !== ''
    const montoNum = Number(it.monto)
    const hasMonto = it.monto.trim() !== '' && Number.isFinite(montoNum) && montoNum >= 0
    if (hasNombre && hasMonto) {
      complete.push(it)
    } else if (hasNombre || it.monto.trim() !== '') {
      incomplete.push(it)
    }
  }
  return { complete, incomplete }
}
