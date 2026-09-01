import { getLimitForMonth } from './categoryLimits'
import type { CategoryLimit, Expense, ExpenseCategory, ExpenseItem } from './types'

/** Suma, por categoría, lo gastado en `monthKey` ("YYYY-MM") — solo cuenta productos ya categorizados. */
export function computeMonthlySpendByCategory(
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'categoryId' | 'monto'>[],
  monthKey: string,
): Map<string, number> {
  const expenseIdsThisMonth = new Set(
    expenses.filter((e) => e.fecha.slice(0, 7) === monthKey).map((e) => e.id),
  )
  const spendByCategory = new Map<string, number>()

  for (const item of items) {
    if (!item.categoryId) continue
    if (!expenseIdsThisMonth.has(item.expenseId)) continue
    spendByCategory.set(item.categoryId, (spendByCategory.get(item.categoryId) ?? 0) + item.monto)
  }

  return spendByCategory
}

export interface BudgetState {
  spent: number
  limit: number
  remaining: number
  percentUsed: number
  isOver: boolean
  isClose: boolean
}

/** A partir de qué porcentaje del límite se considera "ya casi te pasas". */
const CLOSE_THRESHOLD = 80

export function computeBudgetState(spent: number, limit: number): BudgetState {
  const remaining = limit - spent
  const percentUsed = limit > 0 ? (spent / limit) * 100 : 0
  return {
    spent,
    limit,
    remaining,
    percentUsed,
    isOver: remaining < 0,
    isClose: percentUsed >= CLOSE_THRESHOLD,
  }
}

/** Cuántos puntos porcentuales puede ir el gasto por delante del avance del mes antes de avisar. */
export const PACE_AHEAD_MARGIN = 25

export type SpendingPaceStatus = 'ok' | 'adelantado' | 'critico' | 'excedido'

export interface SpendingPace {
  monthElapsedPercent: number
  percentUsed: number
  status: SpendingPaceStatus
}

/**
 * Compara qué tan avanzado va el gasto contra qué tan avanzado va el mes.
 * 'adelantado' = vas gastando más rápido de lo que corre el mes (aviso discreto,
 * porque no todos los gastos se reparten parejo en el mes), 'critico' = ya casi
 * te acabas el límite (mismo umbral que isClose de computeBudgetState),
 * 'excedido' = ya te pasaste del límite.
 */
export function computeSpendingPace(spent: number, limit: number, now: Date = new Date()): SpendingPace {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthElapsedPercent = (now.getDate() / daysInMonth) * 100
  const { percentUsed, isOver, isClose } = computeBudgetState(spent, limit)
  const status: SpendingPaceStatus = isOver
    ? 'excedido'
    : isClose
      ? 'critico'
      : percentUsed > monthElapsedPercent + PACE_AHEAD_MARGIN
        ? 'adelantado'
        : 'ok'
  return { monthElapsedPercent, percentUsed, status }
}

export interface CategoryAlert {
  category: ExpenseCategory
  state: BudgetState
}

/** Categorías con límite que ya están cerca (o pasadas) este mes, de peor a mejor. */
export function getCategoryAlerts(
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'categoryId' | 'monto'>[],
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  monthKey: string,
): CategoryAlert[] {
  const spendByCategory = computeMonthlySpendByCategory(expenses, items, monthKey)
  return categories
    .map((c) => ({ category: c, limit: getLimitForMonth(c.id, monthKey, limits) }))
    .filter((x): x is { category: ExpenseCategory; limit: CategoryLimit } => x.limit !== null && x.limit.limit !== null)
    .map(({ category, limit }) => ({
      category,
      state: computeBudgetState(spendByCategory.get(category.id) ?? 0, limit.limit!),
    }))
    .filter((a) => a.state.isClose)
    .sort((a, b) => b.state.percentUsed - a.state.percentUsed)
}
