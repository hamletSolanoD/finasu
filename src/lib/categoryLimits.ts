import type { CategoryLimit, ExpenseCategory, MonthFinalization, MonthlyIncome } from './types'

/**
 * El límite ya establecido para esa categoría en ese mes, o null si todavía
 * no se decide. Si por lo que sea hay más de una fila (no debería pasar con
 * el upsert por id, pero una fila vieja duplicada de antes de eso no se
 * autocorrige sola) se queda con la más reciente (setAt), no con la primera
 * que encuentre — así un dato viejo no gana sobre uno corregido después.
 */
export function getLimitForMonth(
  categoryId: string,
  monthKey: string,
  limits: CategoryLimit[],
): CategoryLimit | null {
  const matches = limits.filter((l) => l.categoryId === categoryId && l.monthKey === monthKey)
  if (matches.length === 0) return null
  return matches.reduce((latest, l) => (l.setAt > latest.setAt ? l : latest))
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

/**
 * Suma de los límites (no nulos) ya establecidos para ese mes — lo ya
 * repartido de tu ingreso. Si una categoría tiene más de una fila (ver nota
 * en getLimitForMonth), solo cuenta la más reciente — sumar duplicados
 * inflaría lo repartido y dejaría "disponible" más chico de lo real (o, si
 * el duplicado tiene un valor mal escrito, cualquier cosa).
 */
export function committedForMonth(limits: CategoryLimit[], monthKey: string): number {
  const latestByCategory = new Map<string, CategoryLimit>()
  for (const l of limits) {
    if (l.monthKey !== monthKey) continue
    const existing = latestByCategory.get(l.categoryId)
    if (!existing || l.setAt > existing.setAt) latestByCategory.set(l.categoryId, l)
  }
  return Array.from(latestByCategory.values()).reduce((sum, l) => sum + (l.limit ?? 0), 0)
}

/**
 * El ingreso ya establecido para ese mes, o null si todavía no se decide.
 * Igual que getLimitForMonth: si hay más de una fila, gana la más reciente.
 */
export function getIncomeForMonth(monthKey: string, incomes: MonthlyIncome[]): MonthlyIncome | null {
  const matches = incomes.filter((i) => i.monthKey === monthKey)
  if (matches.length === 0) return null
  return matches.reduce((latest, i) => (i.setAt > latest.setAt ? i : latest))
}

/**
 * true si ese mes ya se guardó de forma definitiva (ver MonthFinalization).
 * Mientras sea false, el ingreso y cada límite de categoría de ese mes siguen
 * siendo un borrador editable aunque ya tengan una fila guardada.
 */
export function isMonthFinalized(monthKey: string, finalizations: Pick<MonthFinalization, 'monthKey'>[]): boolean {
  return finalizations.some((f) => f.monthKey === monthKey)
}
