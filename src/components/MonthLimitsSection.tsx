import { useState } from 'react'
import { SwipeableRow } from './SwipeableRow'
import { computeBudgetState } from '../lib/budget'
import { allLimitsSetForMonth, committedForMonth, getIncomeForMonth, getLimitForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import type { CategoryLimit, ExpenseCategory, MonthlyIncome } from '../lib/types'
import { formatCurrency } from '../lib/units'

function BudgetProgress({ spent, limit }: { spent: number; limit: number | null }) {
  if (limit === null) {
    return (
      <p className="mt-2 text-xs text-black/45">
        {spent > 0 ? `Gastado este mes: ${formatCurrency(spent)} (sin límite este mes)` : 'Sin límite este mes'}
      </p>
    )
  }

  const { remaining, percentUsed, isOver, isClose } = computeBudgetState(spent, limit)
  const barColor = isOver ? 'bg-red-400' : isClose ? 'bg-amber-400' : 'bg-sage'
  const textColor = isOver ? 'text-red-700' : isClose ? 'text-amber-700' : 'text-black/50'

  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, percentUsed)}%` }} />
      </div>
      <p className={`mt-1 text-xs ${textColor}`}>
        {formatCurrency(spent)} de {formatCurrency(limit)} este mes
        {isOver
          ? ` · te pasaste por ${formatCurrency(Math.abs(remaining))}`
          : ` · quedan ${formatCurrency(remaining)}`}
      </p>
    </div>
  )
}

/** Ingreso del mes: igual que los límites, un evento único — se guarda una vez y queda fijo. */
function IncomeRow({
  incomeRecord,
  monthKey,
  editable,
}: {
  incomeRecord: MonthlyIncome | null
  monthKey: string
  editable: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  if (incomeRecord || !editable) {
    return (
      <p className="text-sm text-black/60">
        Ingreso de este mes:{' '}
        <span className="font-semibold text-black/80">
          {incomeRecord && incomeRecord.income !== null ? formatCurrency(incomeRecord.income) : 'sin declarar'}
        </span>
      </p>
    )
  }

  async function handleSave() {
    setError('')
    const trimmed = value.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!Number.isFinite(parsed) || (parsed as number) < 0)) {
      setError('Ingresa un monto válido')
      return
    }
    await db.monthlyIncomes.add({
      id: crypto.randomUUID(),
      monthKey,
      income: parsed,
      setAt: Date.now(),
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-sage bg-sage/15 p-3">
      <span className="font-medium">💵 Ingreso de este mes</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-black/50">$</span>
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          placeholder="Sin declarar"
          className="w-28 rounded-lg border border-black/15 bg-white/70 px-2 py-1 text-right text-sm text-black/80"
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80"
        >
          Guardar ingreso
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <p className="mt-1 text-xs text-black/40">
        Se guarda una sola vez para este mes — déjalo vacío si no quieres declarar ingreso.
      </p>
    </div>
  )
}

/**
 * El límite de cada categoría es un evento único por mes: una vez guardado
 * queda fijo (solo lectura + barra de avance) hasta que empiece el mes
 * siguiente y haya que volver a establecerlo.
 */
function CategoryLimitRow({
  category,
  limit,
  spent,
  committed,
  income,
  monthKey,
  highlighted,
  editable,
  onDeleteCategory,
}: {
  category: ExpenseCategory
  limit: CategoryLimit | null
  spent: number
  committed: number
  income: number | null
  monthKey: string
  highlighted: boolean
  editable: boolean
  onDeleteCategory?: (categoryId: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const domId = `cat-${category.id}`
  const highlightRing = highlighted ? 'ring-2 ring-sky ring-offset-2 ring-offset-cream' : ''

  if (limit || !editable) {
    return (
      <li id={domId} className={`rounded-xl border border-black/10 bg-white/60 p-3 transition ${highlightRing}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">
            {category.icon} {category.name}
          </span>
          <span className="text-sm text-black/50">
            {limit ? (limit.limit !== null ? `${formatCurrency(limit.limit)}/mes` : 'Sin límite') : 'Sin definir'}
          </span>
        </div>
        <BudgetProgress spent={spent} limit={limit?.limit ?? null} />
      </li>
    )
  }

  async function handleSave() {
    setError('')
    const trimmed = value.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!Number.isFinite(parsed) || (parsed as number) <= 0)) {
      setError('Ingresa un monto válido')
      return
    }
    if (parsed !== null && income !== null) {
      const disponible = income - committed
      if (parsed > disponible) {
        setError(`Eso pasa tu ingreso disponible — te quedan ${formatCurrency(Math.max(0, disponible))}`)
        return
      }
    }
    await db.categoryLimits.add({
      id: crypto.randomUUID(),
      categoryId: category.id,
      monthKey,
      limit: parsed,
      setAt: Date.now(),
    })
  }

  const content = (
    <div className={`rounded-xl border border-dashed border-sky/50 bg-sky/10 p-3 transition ${highlightRing}`}>
      <span className="font-medium">
        {category.icon} {category.name}
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-black/50">$</span>
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          placeholder="Sin límite"
          className="w-28 rounded-lg border border-black/15 bg-white/70 px-2 py-1 text-right text-sm text-black/80"
        />
        <span className="text-sm text-black/50">/mes</span>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80"
        >
          Guardar límite
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <p className="mt-1 text-xs text-black/40">
        Se guarda una sola vez para este mes — déjalo vacío para no ponerle límite.
      </p>
    </div>
  )

  if (onDeleteCategory) {
    return (
      <li id={domId}>
        <SwipeableRow onDelete={() => onDeleteCategory(category.id)}>{content}</SwipeableRow>
      </li>
    )
  }

  return <li id={domId}>{content}</li>
}

/** true si ya se estableció el ingreso (con monto o "sin declarar") y el límite de cada categoría para ese mes. */
export function monthFullySet(
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  incomes: MonthlyIncome[],
  monthKey: string,
): boolean {
  return getIncomeForMonth(monthKey, incomes) !== null && allLimitsSetForMonth(categories, limits, monthKey)
}

/** El resumen de ingreso/disponible + la lista de categorías, para un mes específico. */
export function MonthLimitsSection({
  title,
  monthKey,
  categories,
  limits,
  incomes,
  spendByCategory,
  showAiSuggestion,
  highlightedCategoryId = null,
  editable = true,
  onDeleteCategory,
}: {
  title: string
  monthKey: string
  categories: ExpenseCategory[]
  limits: CategoryLimit[]
  incomes: MonthlyIncome[]
  spendByCategory: Map<string, number>
  showAiSuggestion: boolean
  highlightedCategoryId?: string | null
  editable?: boolean
  onDeleteCategory?: (categoryId: string) => void
}) {
  const committed = committedForMonth(limits, monthKey)
  const incomeRecord = getIncomeForMonth(monthKey, incomes)
  const income = incomeRecord?.income ?? null
  const remaining = income !== null ? income - committed : null
  const allSet = allLimitsSetForMonth(categories, limits, monthKey)

  return (
    <section>
      <h2 className="font-display font-semibold">{title}</h2>

      <div className="mt-2">
        <IncomeRow incomeRecord={incomeRecord} monthKey={monthKey} editable={editable} />
      </div>

      {income !== null && remaining !== null && (
        <div className="mt-2 rounded-2xl border border-black/10 bg-white/50 p-4">
          <p className="font-display text-2xl font-semibold">
            {formatCurrency(Math.max(0, remaining))}
            <span className="ml-2 text-sm font-normal text-black/50">
              {allSet ? 'sobra' : 'disponible para repartir'}
            </span>
          </p>
          {remaining < 0 && <p className="mt-1 text-xs text-red-700">Tus límites ya suman más que tu ingreso.</p>}
          {showAiSuggestion && allSet && remaining > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-sky/50 bg-sky/10 p-3 text-sm text-black/60">
              🤖 <span className="font-medium">Sugerencia de la IA:</span> próximamente aquí te diré en qué te
              conviene usar {formatCurrency(remaining)}, tomando en cuenta tus gastos y tus ahorros.
            </div>
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {categories.map((category) => (
          <CategoryLimitRow
            key={category.id}
            category={category}
            limit={getLimitForMonth(category.id, monthKey, limits)}
            spent={spendByCategory.get(category.id) ?? 0}
            committed={committed}
            income={income}
            monthKey={monthKey}
            highlighted={category.id === highlightedCategoryId}
            editable={editable}
            onDeleteCategory={onDeleteCategory}
          />
        ))}
      </ul>
    </section>
  )
}
