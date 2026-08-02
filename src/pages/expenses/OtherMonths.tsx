import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MonthLimitsSection } from '../../components/MonthLimitsSection'
import { computeMonthlySpendByCategory } from '../../lib/budget'
import { db } from '../../lib/db'
import { formatMonthLabel, monthKeyEndTimestamp, monthKeyWithOffset } from '../../lib/summary'

/** Historial de solo lectura: todos los meses pasados que ya tuvieron ingreso o límites, en desplegables. */
function OtherMonths() {
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!categories || !limits || !incomes || !expenses || !items) return null

  const currentMonthKey = monthKeyWithOffset(0)
  const nextMonthKey = monthKeyWithOffset(1)
  const excluded = new Set([currentMonthKey, nextMonthKey])

  const monthKeys = Array.from(new Set([...limits.map((l) => l.monthKey), ...incomes.map((i) => i.monthKey)]))
    .filter((m) => !excluded.has(m))
    .sort((a, b) => b.localeCompare(a))

  const spendByCategory = computeMonthlySpendByCategory(expenses, items)

  function toggle(monthKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/gastos/categorias" className="text-sm text-black/50 hover:text-black/70">
        ← Categorías y límites
      </Link>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">🗂️ Otros meses</h1>
      <p className="mt-2 text-black/60">Tu historial de ingreso y límites — solo lectura, ya quedaron cerrados.</p>

      {monthKeys.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Todavía no hay meses anteriores en tu historial.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {monthKeys.map((monthKey) => {
            const isOpen = expanded.has(monthKey)
            return (
              <li key={monthKey} className="rounded-2xl border border-black/10 bg-white/50">
                <button
                  type="button"
                  onClick={() => toggle(monthKey)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="font-display font-semibold">{formatMonthLabel(monthKey)}</span>
                  <span className={`text-black/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="border-t border-black/10 p-4 pt-3">
                    <MonthLimitsSection
                      title=""
                      monthKey={monthKey}
                      categories={categories.filter((c) => c.createdAt <= monthKeyEndTimestamp(monthKey))}
                      limits={limits}
                      incomes={incomes}
                      spendByCategory={spendByCategory}
                      showAiSuggestion={false}
                      editable={false}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default OtherMonths
