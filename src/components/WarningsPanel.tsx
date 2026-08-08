import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { computeWarnings } from '../lib/notifications'
import { monthKeyWithOffset } from '../lib/summary'
import { formatCurrency } from '../lib/units'

/**
 * Panel "⚠️ Avisos del mes" de Inicio: SOLO los warnings de límites (ritmo
 * adelantado, casi al límite, excedido). No son notificaciones — esas viven en
 * la campana 🔔 del header. Si el mes no tiene ningún warning, no se renderiza
 * nada de nada (ni el encabezado).
 */
export function WarningsPanel() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])

  if (!expenses || !items || !categories || !limits) return null

  const warnings = computeWarnings(expenses, items, categories, limits, monthKeyWithOffset(0))
  if (warnings.length === 0) return null

  const problems = warnings.filter((w) => w.severity !== 'pace')
  const ahead = warnings.filter((w) => w.severity === 'pace')

  return (
    <section>
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        ⚠️ Avisos del mes
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {problems.map(({ key, severity, category, spent, limit, pace }) => {
          const over = severity === 'excedido'
          return (
            <Link
              key={key}
              to={`/gastos/categorias#cat-${category.id}`}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${
                over ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <span>
                {category.icon} {category.name}:{' '}
                {over
                  ? `te pasaste por ${formatCurrency(spent - limit)}`
                  : `ya usaste ${Math.round(pace.percentUsed)}% de tu límite`}{' '}
                este mes
              </span>
              <span className="font-semibold">
                {formatCurrency(spent)} / {formatCurrency(limit)}
              </span>
            </Link>
          )
        })}

        {ahead.map(({ key, category, pace }) => (
          <Link
            key={key}
            to={`/gastos/categorias#cat-${category.id}`}
            className="block rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-1.5 text-sm text-amber-800/80 transition hover:bg-amber-50"
          >
            🐢 {category.name}: llevas {Math.round(pace.percentUsed)}% del límite y apenas va el{' '}
            {Math.round(pace.monthElapsedPercent)}% del mes
          </Link>
        ))}
      </div>
    </section>
  )
}
