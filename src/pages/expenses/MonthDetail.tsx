import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { MonthLimitsSection } from '../../components/MonthLimitsSection'
import { computeMonthlySpendByCategory } from '../../lib/budget'
import { db } from '../../lib/db'
import { formatMonthLabel } from '../../lib/summary'

/** Prepara (o revisa) el ingreso y los límites de un mes que todavía no arranca. */
function MonthDetail() {
  const { monthKey } = useParams<{ monthKey: string }>()
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])

  if (!monthKey || !categories || !limits || !incomes || !expenses || !items) return null

  const spendByCategory = computeMonthlySpendByCategory(expenses, items)

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
      <Link to="/gastos/categorias" className="text-sm text-black/50 hover:text-black/70">
        ← Categorías y límites
      </Link>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">📅 {formatMonthLabel(monthKey)}</h1>

      <div className="mt-6">
        <MonthLimitsSection
          title={formatMonthLabel(monthKey)}
          monthKey={monthKey}
          categories={categories}
          limits={limits}
          incomes={incomes}
          spendByCategory={spendByCategory}
          showAiSuggestion={false}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>
    </div>
  )
}

export default MonthDetail
