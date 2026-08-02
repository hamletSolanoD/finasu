import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MonthLimitsSection, monthFullySet } from '../../components/MonthLimitsSection'
import { computeMonthlySpendByCategory } from '../../lib/budget'
import { findExistingCategoryId } from '../../lib/categories'
import { db } from '../../lib/db'
import { ICON_PALETTE } from '../../lib/expenseCategories'
import { formatMonthLabel, isLastDayOfCurrentMonth, monthKeyWithOffset } from '../../lib/summary'

function ExpenseCategories() {
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const location = useLocation()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICON_PALETTE[0])

  const highlightedCategoryId = location.hash.startsWith('#cat-') ? location.hash.slice(5) : null

  const categoriesReady = Boolean(categories && limits)
  useEffect(() => {
    if (!highlightedCategoryId || !categoriesReady) return
    const el = document.getElementById(`cat-${highlightedCategoryId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [categoriesReady, highlightedCategoryId])

  if (!categories || !limits || !incomes || !expenses || !items) return null

  const currentMonthKey = monthKeyWithOffset(0)
  const nextMonthKey = monthKeyWithOffset(1)
  const advanceNotice = isLastDayOfCurrentMonth()
  const nextMonthReady = monthFullySet(categories, limits, incomes, nextMonthKey)
  const spendByCategory = computeMonthlySpendByCategory(expenses, items)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const existingId = findExistingCategoryId(categories ?? [], name)
    if (!existingId) {
      await db.expenseCategories.add({ id: crypto.randomUUID(), name: name.trim(), icon, createdAt: Date.now() })
    }
    setName('')
    setIcon(ICON_PALETTE[0])
    setCreating(false)
  }

  async function handleDeleteCategory(categoryId: string) {
    const category = categories?.find((c) => c.id === categoryId)
    if (!category) return
    if (
      !confirm(
        `¿Eliminar la categoría "${category.name}"? También se borrará su historial de límites de meses anteriores. Esto no se puede deshacer.`,
      )
    )
      return
    await db.transaction('rw', db.categoryLimits, db.expenseCategories, async () => {
      await db.categoryLimits.where('categoryId').equals(categoryId).delete()
      await db.expenseCategories.delete(categoryId)
    })
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/gastos" className="text-sm text-black/50 hover:text-black/70">
        ← Gastos
      </Link>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">🏷️ Categorías y límites</h1>
      <p className="mt-2 text-black/60">
        Cada mes estableces tu ingreso y el límite de cada categoría una sola vez — en cuanto los guardas quedan
        fijos hasta el mes siguiente.
      </p>

      {advanceNotice && !nextMonthReady && (
        <Link
          to={`/gastos/categorias/mes/${nextMonthKey}`}
          className="mt-4 block rounded-2xl border border-sky bg-sky/10 p-4 text-sm text-black/70 transition hover:bg-sky/20"
        >
          📅 <span className="font-medium">Mañana empieza {formatMonthLabel(nextMonthKey)}</span> — prepara tu
          ingreso y tus límites →
        </Link>
      )}

      <div className="mt-6">
        <MonthLimitsSection
          title={formatMonthLabel(currentMonthKey)}
          monthKey={currentMonthKey}
          categories={categories}
          limits={limits}
          incomes={incomes}
          spendByCategory={spendByCategory}
          showAiSuggestion
          highlightedCategoryId={highlightedCategoryId}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-dashed border-black/15 pt-4">
        {nextMonthReady && (
          <Link
            to={`/gastos/categorias/mes/${nextMonthKey}`}
            className="text-sm font-medium text-black/50 underline hover:text-black/70"
          >
            Límites de {formatMonthLabel(nextMonthKey)} →
          </Link>
        )}
        <Link to="/gastos/categorias/otros-meses" className="text-sm font-medium text-black/50 underline hover:text-black/70">
          Otros meses →
        </Link>
      </div>

      {creating ? (
        <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/50 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {ICON_PALETTE.map((paletteIcon) => (
              <button
                key={paletteIcon}
                type="button"
                onClick={() => setIcon(paletteIcon)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                  paletteIcon === icon ? 'bg-sky' : 'bg-black/5 hover:bg-black/10'
                }`}
              >
                {paletteIcon}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar categoría
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-6 rounded-full border border-black/15 bg-white/60 px-5 py-2.5 font-display font-semibold text-black/70 transition hover:bg-black/5"
        >
          + Nueva categoría
        </button>
      )}
    </div>
  )
}

export default ExpenseCategories
