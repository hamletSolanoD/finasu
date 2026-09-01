import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { useConfirm } from '../../components/ConfirmModal'
import { MonthLimitsSection } from '../../components/MonthLimitsSection'
import { computeMonthlySpendByCategory } from '../../lib/budget'
import { getIncomeForMonth, isMonthFinalized } from '../../lib/categoryLimits'
import { db } from '../../lib/db'
import { formatMonthLabel } from '../../lib/summary'
import { useMonthDraftGuard } from '../../lib/useMonthDraftGuard'

/** Prepara (o revisa) el ingreso y los límites de un mes que todavía no arranca. */
function MonthDetail() {
  const { monthKey } = useParams<{ monthKey: string }>()
  const categories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const finalizations = useLiveQuery(() => db.monthFinalizations.toArray(), [])
  const confirm = useConfirm()

  // dataReady y los valores de respaldo son para poder llamar a
  // useMonthDraftGuard SIEMPRE (reglas de hooks: nunca después de un return
  // condicional) aunque los datos todavía no hayan cargado.
  const dataReady = Boolean(monthKey && categories && limits && incomes && expenses && items && finalizations)
  const safeMonthKey = monthKey ?? ''
  const finalized = dataReady ? isMonthFinalized(safeMonthKey, finalizations!) : true
  const incomeRecord = dataReady ? getIncomeForMonth(safeMonthKey, incomes!) : null

  async function handleFinalize() {
    await db.monthFinalizations.put({ monthKey: safeMonthKey, finalizedAt: Date.now() })
  }

  const { attemptLeave } = useMonthDraftGuard({
    monthKey: safeMonthKey,
    categories: categories ?? [],
    limits: limits ?? [],
    incomeRecord,
    finalized,
    onFinalize: handleFinalize,
  })

  if (!dataReady) return null

  const spendByCategory = computeMonthlySpendByCategory(expenses!, items!, safeMonthKey)

  async function handleDeleteCategory(categoryId: string) {
    const category = categories!.find((c) => c.id === categoryId)
    if (!category) return
    const ok = await confirm({
      title: `¿Eliminar la categoría "${category.name}"?`,
      body: 'También se borrará su historial de límites de meses anteriores. Esto no se puede deshacer.',
    })
    if (!ok) return
    await db.transaction('rw', db.categoryLimits, db.expenseCategories, async () => {
      await db.categoryLimits.where('categoryId').equals(categoryId).delete()
      await db.expenseCategories.delete(categoryId)
    })
  }

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to="/gastos/categorias" onBeforeLeave={attemptLeave}>
        ← Categorías y límites
      </BackLink>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">📅 {formatMonthLabel(safeMonthKey)}</h1>

      <div className="mt-6">
        <MonthLimitsSection
          title={formatMonthLabel(safeMonthKey)}
          monthKey={safeMonthKey}
          categories={categories!}
          limits={limits!}
          incomes={incomes!}
          spendByCategory={spendByCategory}
          expenses={expenses!}
          items={items!}
          showAiSuggestion={false}
          finalized={finalized}
          onFinalize={handleFinalize}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>
    </div>
  )
}

export default MonthDetail
