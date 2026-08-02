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
