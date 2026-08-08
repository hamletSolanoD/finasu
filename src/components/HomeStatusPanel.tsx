import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { getCategoryAlerts } from '../lib/budget'
import { getIncomeForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import { computeCategoryBreakdown, computeMonthOverMonth, monthKeyWithOffset } from '../lib/summary'
import { formatCurrency } from '../lib/units'

/** Resumen general del mes en una tarjeta (sin desglose por categoría — eso se
 * queda en /resumen). Las alertas por categoría ya no viven aquí: ahora las
 * muestra NotificationsPanel en Inicio — aquí solo se ajusta el texto para no
 * decir "vas bien" cuando hay categorías en problemas. */
export function HomeStatusPanel() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])

  if (!expenses || !items || !categories || !limits || !incomes) return null

  const alerts = getCategoryAlerts(expenses, items, categories, limits, monthKeyWithOffset(0))
  const hasProblems = alerts.length > 0

  const monthKey = monthKeyWithOffset(0)
  const previousMonthKey = monthKeyWithOffset(-1)
  const { total } = computeCategoryBreakdown(expenses, items, categories, monthKey)
  const { total: previousTotal } = computeCategoryBreakdown(expenses, items, categories, previousMonthKey)
  const change = computeMonthOverMonth(total, previousTotal)

  const income = getIncomeForMonth(monthKey, incomes)?.income ?? null
  const balance = income !== null ? income - total : null

  return (
    <Link
      to="/resumen"
      className={`mt-6 block rounded-2xl border p-4 transition ${
        hasProblems
          ? 'border-black/10 bg-white/50 hover:bg-white/80'
          : 'border-sage bg-sage/10 hover:bg-sage/20'
      }`}
    >
      <p className="text-sm font-medium text-black/60">
        {hasProblems ? 'Tu mes hasta ahora' : '✓ Vas bien este mes'}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold">
        {formatCurrency(total)} <span className="text-sm font-normal text-black/50">gastado</span>
      </p>
      {change.direction !== 'new' && change.percent !== null && change.direction !== 'same' && (
        <p className={`mt-1 text-sm font-medium ${change.direction === 'up' ? 'text-red-700' : 'text-emerald-700'}`}>
          {change.direction === 'up' ? '↑' : '↓'} {Math.round(Math.abs(change.percent))}%{' '}
          {change.direction === 'up' ? 'más' : 'menos'} que el mes pasado
        </p>
      )}
      {balance !== null && (
        <p className="mt-2 text-sm text-black/60">
          Balance: <span className="font-semibold">{formatCurrency(balance)}</span>
        </p>
      )}
      <p className="mt-2 text-sm font-medium text-black/50 underline">Ver resumen completo →</p>
    </Link>
  )
}
