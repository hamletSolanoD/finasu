import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { PAGE_SIZE, Pagination } from '../../components/Pagination'
import { findExistingCategoryId } from '../../lib/categories'
import { db } from '../../lib/db'
import { formatFechaCorta } from '../../lib/date'
import { ICON_PALETTE } from '../../lib/expenseCategories'
import { computeExpenseStatus } from '../../lib/expenseStatus'
import { formatCurrency } from '../../lib/units'
import type { Expense, ExpenseItem } from '../../lib/types'

function UncategorizedItemRow({
  item,
  expense,
  categories,
  onCreateCategory,
}: {
  item: ExpenseItem
  expense: Expense
  categories: { id: string; name: string; icon: string }[]
  onCreateCategory: (name: string, icon: string) => Promise<string>
}) {
  async function handleCategorize(categoryId: string) {
    await db.expenseItems.update(item.id, { categoryId: categoryId || null })
    const siblingItems = (await db.expenseItems.where('expenseId').equals(expense.id).toArray()).map((i) =>
      i.id === item.id ? { ...i, categoryId: categoryId || null } : i,
    )
    await db.expenses.update(expense.id, { status: computeExpenseStatus(siblingItems, expense.status) })
  }

  return (
    <li className="rounded-xl border border-black/10 bg-white/60 p-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5">
          {expense.image && <img src={expense.image} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.nombre}</p>
          <p className="text-xs text-black/45">
            {formatFechaCorta(expense.fecha)} ·{' '}
            <Link to={`/gastos/${expense.id}`} className="underline hover:text-black/70">
              ver ticket
            </Link>
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold">{formatCurrency(item.monto)}</p>
      </div>
      <div className="mt-2">
        <CategoryDropdown
          categories={categories}
          value=""
          onChange={handleCategorize}
          onCreate={onCreateCategory}
          iconPalette={ICON_PALETTE}
        />
      </div>
    </li>
  )
}

function UncategorizedItems() {
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const [page, setPage] = useState(1)

  if (!items || !expenses || !categories) return null

  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  const pending = items
    .filter((i) => i.categoryId === null)
    .map((item) => ({ item, expense: expenseById.get(item.expenseId) }))
    .filter((x): x is { item: ExpenseItem; expense: Expense } => Boolean(x.expense))
    .sort((a, b) => b.expense.capturedAt - a.expense.capturedAt || a.item.order - b.item.order)

  const emptyTicketsCount = expenses.filter(
    (e) => e.status !== 'categorizado' && !items.some((i) => i.expenseId === e.id),
  ).length

  async function handleCreateCategory(name: string, icon: string) {
    const existingId = findExistingCategoryId(categories ?? [], name)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    await db.expenseCategories.add({ id: newId, name: name.trim(), icon, createdAt: Date.now() })
    return newId
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/gastos" className="text-sm text-black/50 hover:text-black/70">
        ← Gastos
      </Link>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">🏷️ Productos sin categorizar</h1>
      <p className="mt-2 text-black/60">
        Todo lo que ya detectamos en tus tickets pero todavía no tiene categoría — categorízalos aquí de un jalón,
        sin entrar ticket por ticket.
      </p>

      {emptyTicketsCount > 0 && (
        <Link
          to="/gastos"
          className="mt-4 block rounded-xl border border-sky bg-sky/10 p-3 text-sm text-black/70 hover:bg-sky/20"
        >
          {emptyTicketsCount} {emptyTicketsCount === 1 ? 'ticket' : 'tickets'} sin ningún producto detectado — revísa
          {emptyTicketsCount === 1 ? 'lo' : 'los'} a mano →
        </Link>
      )}

      {pending.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          No hay productos pendientes de categorizar.
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {pending.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ item, expense }) => (
              <UncategorizedItemRow
                key={item.id}
                item={item}
                expense={expense}
                categories={categories}
                onCreateCategory={handleCreateCategory}
              />
            ))}
          </ul>
          <Pagination page={page} totalPages={Math.ceil(pending.length / PAGE_SIZE)} onChange={setPage} />
        </>
      )}
    </div>
  )
}

export default UncategorizedItems
