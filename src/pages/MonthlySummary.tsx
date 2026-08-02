import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getIncomeForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import {
  computeCategoryBreakdown,
  computeMonthOverMonth,
  formatMonthLabel,
  isLastDayOfCurrentMonth,
  monthKeyWithOffset,
  type CategorySpend,
} from '../lib/summary'
import { formatCurrency } from '../lib/units'

function CategoryBar({ item }: { item: CategorySpend }) {
  return (
    <li>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {item.category.icon} {item.category.name}
        </span>
        <span className="text-black/60">
          {formatCurrency(item.amount)} <span className="text-black/40">({Math.round(item.percent)}%)</span>
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full bg-sage" style={{ width: `${item.percent}%` }} />
      </div>
    </li>
  )
}

function ChangeBadge({ change }: { change: ReturnType<typeof computeMonthOverMonth> }) {
  if (change.direction === 'new') {
    return <span className="text-sm text-black/45">no gastaste nada el mes pasado</span>
  }
  if (change.direction === 'same' || change.percent === null) {
    return <span className="text-sm text-black/45">igual que el mes pasado</span>
  }
  const isUp = change.direction === 'up'
  return (
    <span className={`text-sm font-medium ${isUp ? 'text-red-700' : 'text-emerald-700'}`}>
      {isUp ? '↑' : '↓'} {Math.round(Math.abs(change.percent))}% {isUp ? 'más' : 'menos'} que el mes pasado
    </span>
  )
}

function MonthlySummary() {
  const [offset, setOffset] = useState(0)
  const monthKey = monthKeyWithOffset(offset)
  const previousMonthKey = monthKeyWithOffset(offset - 1)

  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('default'), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])

  if (!expenses || !items || !categories || !incomes) return null

  const { total, uncategorized, breakdown } = computeCategoryBreakdown(expenses, items, categories, monthKey)
  const { total: previousTotal } = computeCategoryBreakdown(expenses, items, categories, previousMonthKey)
  const change = computeMonthOverMonth(total, previousTotal)

  const income = getIncomeForMonth(monthKey, incomes)?.income ?? null
  const balance = income !== null ? income - total : null

  const firstUseMonth = settings?.firstUseMonth ?? monthKeyWithOffset(0)
  const maxOffset = isLastDayOfCurrentMonth() ? 1 : 0

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">📊 Resumen</p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">{formatMonthLabel(monthKey)}</h1>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            disabled={monthKey <= firstUseMonth}
            className="rounded-full border border-black/15 px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
            disabled={offset >= maxOffset}
            className="rounded-full border border-black/15 px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white/50 p-4">
        <p className="font-display text-3xl font-semibold">{formatCurrency(total)}</p>
        <p className="text-sm text-black/50">gastado este mes</p>
        <div className="mt-2">
          <ChangeBadge change={change} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3 text-sm text-black/60">
          <span>
            Ingreso mensual:{' '}
            <span className="font-semibold">
              {income !== null ? formatCurrency(income) : 'sin declarar'}
            </span>{' '}
            <Link to="/gastos/categorias" className="text-xs underline hover:text-black/80">
              editar →
            </Link>
          </span>
          {balance !== null && (
            <span>
              Balance: <span className="font-semibold">{formatCurrency(balance)}</span>
            </span>
          )}
        </div>
      </div>

      <h2 className="mt-8 font-display font-semibold">Por categoría</h2>
      {breakdown.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-black/15 p-8 text-center text-black/50">
          No hay gastos categorizados en {formatMonthLabel(monthKey)}.
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {breakdown.map((item) => (
            <CategoryBar key={item.category.id} item={item} />
          ))}
        </ul>
      )}

      {uncategorized > 0 && (
        <Link
          to="/gastos"
          className="mt-4 block rounded-xl border border-sky bg-sky/10 p-3 text-sm text-black/70 hover:bg-sky/20"
        >
          {formatCurrency(uncategorized)} en tickets sin categorizar todavía →
        </Link>
      )}
    </div>
  )
}

export default MonthlySummary
