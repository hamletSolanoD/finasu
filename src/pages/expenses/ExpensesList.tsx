import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DatePicker } from '../../components/DatePicker'
import { PAGE_SIZE, Pagination } from '../../components/Pagination'
import { SwipeableRow } from '../../components/SwipeableRow'
import { getCategoryAlerts } from '../../lib/budget'
import { db } from '../../lib/db'
import { formatFechaCorta } from '../../lib/date'
import { monthKeyWithOffset } from '../../lib/summary'
import { formatCurrency } from '../../lib/units'
import type { Expense, ExpenseItem } from '../../lib/types'

const STATUS_LABEL: Record<Expense['status'], string> = {
  pendiente_de_categorizar: 'Pendiente de categorizar',
  requiere_revision: 'Requiere revisión',
  categorizado: 'Categorizado',
}

const STATUS_STYLE: Record<Expense['status'], string> = {
  pendiente_de_categorizar: 'bg-sky/40 text-black/70',
  requiere_revision: 'bg-amber-100 text-amber-800',
  categorizado: 'bg-sage/40 text-black/70',
}

function BudgetAlerts() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])

  if (!expenses || !items || !categories || !limits) return null

  const alerts = getCategoryAlerts(expenses, items, categories, limits, monthKeyWithOffset(0))
  if (alerts.length === 0) return null

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

function ExpensesList() {
  const expenses = useLiveQuery(() => db.expenses.orderBy('capturedAt').reverse().toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])

  const [merchantQuery, setMerchantQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [pendingPage, setPendingPage] = useState(1)
  const [donePage, setDonePage] = useState(1)

  const uncategorizedCount = (items ?? []).filter((i) => i.categoryId === null).length
  const activeFilterCount = [merchantQuery.trim(), maxPrice.trim(), dateFilter].filter(Boolean).length
  const hasFilters = activeFilterCount > 0

  function totalFor(expense: Expense): number {
    return (items ?? [])
      .filter((i) => i.expenseId === expense.id)
      .reduce((sum, i) => sum + i.monto, 0)
  }

  const filtered = (expenses ?? []).filter((e) => {
    if (merchantQuery.trim() && !e.merchant?.toLowerCase().includes(merchantQuery.trim().toLowerCase())) return false
    if (maxPrice.trim() && totalFor(e) >= Number(maxPrice)) return false
    if (dateFilter && e.fecha !== dateFilter) return false
    return true
  })

  const pending = filtered.filter((e) => e.status !== 'categorizado')
  const done = filtered.filter((e) => e.status === 'categorizado')

  function clearFilters() {
    setMerchantQuery('')
    setMaxPrice('')
    setDateFilter('')
    setPendingPage(1)
    setDonePage(1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Tus tickets</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {uncategorizedCount > 0 && (
            <Link
              to="/gastos/sin-categorizar"
              className="rounded-full border border-sky bg-sky/15 px-4 py-2.5 text-sm font-semibold text-black/70 transition hover:bg-sky/25"
            >
              🏷️ Sin categorizar ({uncategorizedCount})
            </Link>
          )}
          <Link
            to="/gastos/categorias"
            className="rounded-full border border-black/15 bg-white/60 px-4 py-2.5 text-sm font-semibold text-black/70 transition hover:bg-black/5"
          >
            📊 Categorías y límites
          </Link>
          <Link
            to="/gastos/escanear"
            className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            + Escanear ticket
          </Link>
          <Link
            to="/gastos/manual"
            className="rounded-full border border-black/15 bg-white/60 px-5 py-2.5 font-display font-semibold text-black/70 transition hover:bg-black/5"
          >
            ✍️ Agregar a mano
          </Link>
        </div>
      </div>

      <BudgetAlerts />

      {expenses === undefined ? null : expenses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Aún no has escaneado ningún ticket.
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-sky/50 bg-sky/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-sky/30 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-black/70">
                <span aria-hidden>🔍</span> Filtros
                {hasFilters && (
                  <span className="rounded-full bg-sage/40 px-2 py-0.5 text-xs font-semibold text-black/60">
                    {activeFilterCount} {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
                  </span>
                )}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border border-sky/50 bg-white/70 px-3 py-1 text-xs font-semibold text-black/60 transition hover:bg-white hover:text-black/80"
                >
                  ✕ Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:flex sm:flex-wrap sm:items-end">
              <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-black/50 sm:col-span-1">
                Establecimiento
                <input
                  value={merchantQuery}
                  onChange={(e) => {
                    setMerchantQuery(e.target.value)
                    setPendingPage(1)
                    setDonePage(1)
                  }}
                  placeholder="Ej. Walmart"
                  className={`w-full rounded-lg border px-2 py-1.5 text-sm text-black/80 transition sm:w-36 ${
                    merchantQuery.trim() ? 'border-sage bg-white ring-1 ring-sage/30' : 'border-black/15 bg-white/70'
                  }`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-black/50">
                Menor de
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value)
                    setPendingPage(1)
                    setDonePage(1)
                  }}
                  placeholder="$100"
                  className={`w-full rounded-lg border px-2 py-1.5 text-sm text-black/80 transition sm:w-24 ${
                    maxPrice.trim() ? 'border-sage bg-white ring-1 ring-sage/30' : 'border-black/15 bg-white/70'
                  }`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-black/50">
                Fecha
                <DatePicker
                  value={dateFilter}
                  onChange={(v) => {
                    setDateFilter(v)
                    setPendingPage(1)
                    setDonePage(1)
                  }}
                  placeholder="Cualquiera"
                  className={`w-full rounded-xl transition sm:w-40 ${dateFilter ? 'ring-1 ring-sage/40' : ''}`}
                />
              </label>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
              No hay tickets con esos filtros.
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {pending.length > 0 && (
                <section>
                  <h2 className="mb-3 font-display font-semibold text-black/70">Por revisar ({pending.length})</h2>
                  <ExpenseRows
                    expenses={pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE)}
                    items={items ?? []}
                  />
                  <Pagination
                    page={pendingPage}
                    totalPages={Math.ceil(pending.length / PAGE_SIZE)}
                    onChange={setPendingPage}
                  />
                </section>
              )}
              {done.length > 0 && (
                <section>
                  <h2 className="mb-3 font-display font-semibold text-black/70">Categorizados ({done.length})</h2>
                  <ExpenseRows
                    expenses={done.slice((donePage - 1) * PAGE_SIZE, donePage * PAGE_SIZE)}
                    items={items ?? []}
                  />
                  <Pagination page={donePage} totalPages={Math.ceil(done.length / PAGE_SIZE)} onChange={setDonePage} />
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

async function handleDeleteExpense(expenseId: string) {
  if (!confirm('¿Eliminar este ticket y sus productos?')) return
  await db.transaction('rw', db.expenses, db.expenseItems, async () => {
    await db.expenseItems.where('expenseId').equals(expenseId).delete()
    await db.expenses.delete(expenseId)
  })
}

function ExpenseRows({ expenses, items }: { expenses: Expense[]; items: ExpenseItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {expenses.map((expense) => {
        const expenseItems = items.filter((i) => i.expenseId === expense.id).sort((a, b) => a.order - b.order)
        const total = expenseItems.reduce((sum, i) => sum + i.monto, 0)
        const categorizedCount = expenseItems.filter((i) => i.categoryId !== null).length
        const subtitle =
          expense.merchant ??
          (expenseItems.length > 0
            ? `${expenseItems[0].nombre}${expenseItems.length > 1 ? ` y ${expenseItems.length - 1} más` : ''}`
            : null)

        return (
          <li key={expense.id}>
            <SwipeableRow onDelete={() => handleDeleteExpense(expense.id)}>
              <Link
                to={`/gastos/${expense.id}`}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
                  {expense.image && <img src={expense.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {formatFechaCorta(expense.fecha)}
                    {subtitle && <span className="font-normal text-black/50"> · {subtitle}</span>}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[expense.status]}`}>
                      {STATUS_LABEL[expense.status]}
                    </span>
                    {expenseItems.length > 0 && (
                      <span className="text-xs text-black/45">
                        {categorizedCount}/{expenseItems.length} productos
                      </span>
                    )}
                  </div>
                </div>
                {total > 0 && <p className="shrink-0 font-display font-semibold">{formatCurrency(total)}</p>}
              </Link>
            </SwipeableRow>
          </li>
        )
      })}
    </ul>
  )
}

export default ExpensesList
