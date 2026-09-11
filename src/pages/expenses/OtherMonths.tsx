import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BackLink } from '../../components/BackLink'
import { MonthLimitsSection } from '../../components/MonthLimitsSection'
import { computeMonthlySpendByCategory } from '../../lib/budget'
import { db } from '../../lib/db'
import { formatMonthLabel, monthKeyEndTimestamp } from '../../lib/summary'
import { ExpenseRows } from './ExpensesList'

/** Historial de solo lectura: los meses ya guardados definitivamente, en desplegables. */
function OtherMonths() {
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const stores = useLiveQuery(() => db.stores.toArray(), [])
  const finalizations = useLiveQuery(() => db.monthFinalizations.toArray(), [])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!categories || !limits || !incomes || !expenses || !items || !stores || !finalizations) return null

  // La lista de "meses cerrados" sale directo de MonthFinalization — no de que
  // haya por ahí alguna fila de límite/ingreso suelta (eso podría ser un mes
  // que sigue siendo borrador, ni siquiera cerrado todavía).
  const monthKeys = finalizations.map((f) => f.monthKey).sort((a, b) => b.localeCompare(a))

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
      <BackLink to="/gastos/categorias">← Categorías y límites</BackLink>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">🗂️ Otros meses</h1>
      <p className="mt-2 text-black/60">Tus meses ya guardados definitivamente — ingreso, límites y tickets, solo lectura.</p>

      {monthKeys.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Todavía no hay meses cerrados en tu historial.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {monthKeys.map((monthKey) => {
            const isOpen = expanded.has(monthKey)
            const monthExpenses = expenses
              .filter((e) => e.fecha.slice(0, 7) === monthKey)
              .sort((a, b) => (a.fecha === b.fecha ? b.capturedAt - a.capturedAt : b.fecha < a.fecha ? -1 : 1))
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
                      spendByCategory={computeMonthlySpendByCategory(expenses, items, monthKey)}
                      expenses={expenses}
                      items={items}
                      showAiSuggestion={false}
                      editable={false}
                    />

                    <div className="mt-6 border-t border-black/10 pt-4">
                      <p className="mb-2 font-display font-semibold">🧾 Tickets</p>
                      {monthExpenses.length === 0 ? (
                        <p className="text-sm text-black/50">No hay tickets guardados para este mes.</p>
                      ) : (
                        <ExpenseRows expenses={monthExpenses} items={items} stores={stores} readOnly />
                      )}
                    </div>
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
