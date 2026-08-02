import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { getCategoryAlerts } from '../lib/budget'
import { getIncomeForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import { computeCategoryBreakdown, computeMonthOverMonth, monthKeyWithOffset } from '../lib/summary'
import { formatCurrency } from '../lib/units'

/** Notificaciones importantes en Inicio: si hay categorías en problemas, esas mandan.
 * Si no, un resumen general (sin desglose por categoría — eso se queda en /resumen). */
export function HomeStatusPanel() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])

  if (!expenses || !items || !categories || !limits || !incomes) return null

  const alerts = getCategoryAlerts(expenses, items, categories, limits, monthKeyWithOffset(0))

  if (alerts.length > 0) {
    return (
      <div className="mt-6 flex flex-col gap-2">
        {alerts.map(({ category, state }) => (
          <Link
            key={category.id}
            to={`/gastos/categorias#cat-${category.id}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${
              state.isOver ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <span>
              {category.icon} {category.name}:{' '}
              {state.isOver
                ? `te pasaste por ${formatCurrency(Math.abs(state.remaining))}`
                : `ya usaste ${Math.round(state.percentUsed)}% de tu límite`}{' '}
              este mes
            </span>
            <span className="font-semibold">
              {formatCurrency(state.spent)} / {formatCurrency(state.limit)}
            </span>
          </Link>
        ))}
      </div>
    )
  }

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
      className="mt-6 block rounded-2xl border border-sage bg-sage/10 p-4 transition hover:bg-sage/20"
    >
      <p className="text-sm font-medium text-black/60">✓ Vas bien este mes</p>
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
