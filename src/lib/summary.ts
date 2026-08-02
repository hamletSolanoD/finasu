import type { Expense, ExpenseCategory, ExpenseItem } from './types'

/** "2026-07" para el mes actual, "2026-06" para el anterior, etc. */
export function monthKeyWithOffset(offset: number): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** true si hoy es el último día del mes — permite adelantar la vista al mes siguiente un día antes. */
export function isLastDayOfCurrentMonth(): boolean {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.getMonth() !== now.getMonth()
}

/** Timestamp (ms) del último instante de ese mes — para saber qué categorías ya existían para entonces. */
export function monthKeyEndTimestamp(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0, 23, 59, 59, 999).getTime()
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  const label = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export interface CategorySpend {
  category: ExpenseCategory
  amount: number
  percent: number
}

export interface MonthlyBreakdown {
  total: number
  uncategorized: number
  breakdown: CategorySpend[]
}

export function computeCategoryBreakdown(
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'categoryId' | 'monto'>[],
  categories: ExpenseCategory[],
  monthKey: string,
): MonthlyBreakdown {
  const expenseIdsInMonth = new Set(expenses.filter((e) => e.fecha.slice(0, 7) === monthKey).map((e) => e.id))
  const itemsInMonth = items.filter((i) => expenseIdsInMonth.has(i.expenseId))

  const byCategory = new Map<string, number>()
  let uncategorized = 0
  for (const item of itemsInMonth) {
    if (item.categoryId) {
      byCategory.set(item.categoryId, (byCategory.get(item.categoryId) ?? 0) + item.monto)
    } else {
      uncategorized += item.monto
    }
  }

  const total = itemsInMonth.reduce((sum, i) => sum + i.monto, 0)

  const breakdown = categories
    .map((category) => ({ category, amount: byCategory.get(category.id) ?? 0, percent: 0 }))
    .filter((b) => b.amount > 0)
    .map((b) => ({ ...b, percent: total > 0 ? (b.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)

  return { total, uncategorized, breakdown }
}

export interface MonthOverMonthChange {
  percent: number | null
  direction: 'up' | 'down' | 'same' | 'new'
}

export function computeMonthOverMonth(current: number, previous: number): MonthOverMonthChange {
  if (previous === 0) {
    return { percent: null, direction: current === 0 ? 'same' : 'new' }
  }
  const percent = ((current - previous) / previous) * 100
  if (Math.abs(percent) < 1) return { percent: 0, direction: 'same' }
  return { percent, direction: percent > 0 ? 'up' : 'down' }
}
