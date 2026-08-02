import type { CategoryLimit, ExpenseCategory, MonthlyIncome } from './types'

/** El límite ya establecido para esa categoría en ese mes, o null si todavía no se decide. */
export function getLimitForMonth(
  categoryId: string,
  monthKey: string,
  limits: CategoryLimit[],
): CategoryLimit | null {
  return limits.find((l) => l.categoryId === categoryId && l.monthKey === monthKey) ?? null
}

/** true si ya se decidió (con límite o "sin límite") cada categoría para ese mes. */
export function allLimitsSetForMonth(
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  monthKey: string,
): boolean {
  if (categories.length === 0) return true
  return categories.every((c) => limits.some((l) => l.categoryId === c.id && l.monthKey === monthKey))
}

/** Suma de los límites (no nulos) ya establecidos para ese mes — lo ya repartido de tu ingreso. */
export function committedForMonth(limits: CategoryLimit[], monthKey: string): number {
  return limits
    .filter((l) => l.monthKey === monthKey)
    .reduce((sum, l) => sum + (l.limit ?? 0), 0)
}

/** El ingreso ya establecido para ese mes, o null si todavía no se decide. */
export function getIncomeForMonth(monthKey: string, incomes: MonthlyIncome[]): MonthlyIncome | null {
  return incomes.find((i) => i.monthKey === monthKey) ?? null
}
