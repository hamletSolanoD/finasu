import { getLimitForMonth } from './categoryLimits'
import type { CategoryLimit, Expense, ExpenseCategory, ExpenseItem } from './types'

export function isInCurrentMonth(fecha: string): boolean {
  const now = new Date()
  const [year, month] = fecha.split('-').map(Number)
  return year === now.getFullYear() && month === now.getMonth() + 1
}

/** Suma, por categoría, lo gastado este mes — solo cuenta productos ya categorizados. */
export function computeMonthlySpendByCategory(
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'categoryId' | 'monto'>[],
): Map<string, number> {
  const expenseIdsThisMonth = new Set(expenses.filter((e) => isInCurrentMonth(e.fecha)).map((e) => e.id))
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
  const spendByCategory = computeMonthlySpendByCategory(expenses, items)
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
