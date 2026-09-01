import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './ConfirmModal'
import { SwipeableRow } from './SwipeableRow'
import { computeBudgetState } from '../lib/budget'
import { allLimitsSetForMonth, committedForMonth, getIncomeForMonth, getLimitForMonth } from '../lib/categoryLimits'
import { formatFechaLarga } from '../lib/date'
import { db } from '../lib/db'
import { autoSetIvaLimitForMonth } from '../lib/ivaCategory'
import { useModalBack } from '../lib/useModalBack'
import type { CategoryLimit, Expense, ExpenseCategory, ExpenseItem, MonthlyIncome } from '../lib/types'
import { formatCurrency } from '../lib/units'

/** Nota chica bajo el campo cuando ya hay un valor guardado pero el mes sigue sin cerrar. */
function DraftHint() {
  return <p className="mt-1 text-xs text-black/40">✓ Guardado como borrador — puedes seguir editándolo.</p>
}

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

/**
 * Ingreso del mes. Mientras el mes no se guarde de forma definitiva
 * (finalized=false, ver MonthFinalization) sigue siendo un borrador editable
 * aunque ya tenga un valor guardado — así se puede corregir un error sin
 * esperar al mes siguiente.
 */
function IncomeRow({
  incomeRecord,
  monthKey,
  editable,
  finalized,
}: {
  incomeRecord: MonthlyIncome | null
  monthKey: string
  editable: boolean
  finalized: boolean
}) {
  const [value, setValue] = useState(() => (incomeRecord?.income != null ? String(incomeRecord.income) : ''))
  const [error, setError] = useState('')

  if ((incomeRecord && finalized) || !editable) {
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
    await db.monthlyIncomes.put({
      id: incomeRecord?.id ?? crypto.randomUUID(),
      monthKey,
      income: parsed,
      setAt: incomeRecord?.setAt ?? Date.now(),
    })
    // Con el ingreso declarado, el límite de IVA del mes se pone solo
    // (nunca pisa uno que ya exista, así que ponerlo a mano antes sigue valiendo).
    await autoSetIvaLimitForMonth(monthKey, parsed)
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
          {incomeRecord ? 'Actualizar ingreso' : 'Guardar ingreso'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {incomeRecord ? (
        <DraftHint />
      ) : (
        <p className="mt-1 text-xs text-black/40">
          Puedes dejarlo vacío si no quieres declarar ingreso — se puede corregir mientras no guardes los cambios
          definitivamente.
        </p>
      )}
    </div>
  )
}

/** Modal con los gastos de una categoría en un mes — o un aviso de que todavía no hay ninguno. */
function CategoryExpensesModal({
  category,
  expenses,
  categoryItems,
  onClose,
}: {
  category: ExpenseCategory
  expenses: Expense[]
  categoryItems: ExpenseItem[]
  onClose: () => void
}) {
  // El modal solo existe montado (open siempre true): así el botón atrás del
  // teléfono lo cierra en vez de salirse de la pantalla de límites.
  useModalBack(true, onClose)

  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">
            {category.icon} {category.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-black/40 transition hover:bg-black/5 hover:text-black/70"
          >
            ✕
          </button>
        </div>

        {categoryItems.length === 0 ? (
          <p className="mt-3 text-sm text-black/60">
            Todavía no hay gastos categorizados en {category.name} este mes.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {categoryItems.map((item) => {
              const expense = expensesById.get(item.expenseId)
              return (
                <li key={item.id}>
                  <Link
                    to={`/gastos/${item.expenseId}`}
                    onClick={onClose}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/60 p-3 transition hover:bg-white/90"
                  >
                    <span>
                      <span className="block font-medium">{item.nombre}</span>
                      <span className="block text-xs text-black/50">
                        {expense ? formatFechaLarga(expense.fecha) : ''}
                        {expense?.merchant ? ` · ${expense.merchant}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(item.monto)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * El límite de cada categoría es un borrador editable — se puede guardar,
 * revisar y corregir tantas veces como haga falta — hasta que se guarda el
 * mes completo de forma definitiva (finalized=true, ver el botón al final de
 * MonthLimitsSection). Después de eso queda fijo (solo lectura + barra de
 * avance) hasta el mes siguiente.
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
  finalized,
  expenses,
  items,
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
  finalized: boolean
  expenses: Expense[]
  items: ExpenseItem[]
  onDeleteCategory?: (categoryId: string) => void
}) {
  const [value, setValue] = useState(() => (limit?.limit != null ? String(limit.limit) : ''))
  const [error, setError] = useState('')
  const [showExpenses, setShowExpenses] = useState(false)
  const domId = `cat-${category.id}`
  const highlightRing = highlighted ? 'ring-2 ring-sky ring-offset-2 ring-offset-cream' : ''

  if ((limit && finalized) || !editable) {
    const expenseIdsThisMonth = new Set(
      expenses.filter((expense) => expense.fecha.slice(0, 7) === monthKey).map((expense) => expense.id),
    )
    const categoryItems = items.filter(
      (item) => item.categoryId === category.id && expenseIdsThisMonth.has(item.expenseId),
    )

    return (
      <li id={domId}>
        <button
          type="button"
          onClick={() => setShowExpenses(true)}
          className={`w-full rounded-xl border border-black/10 bg-white/60 p-3 text-left transition focus:outline-none ${highlightRing}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              {category.icon} {category.name}
            </span>
            <span className="text-sm text-black/50">
              {limit ? (limit.limit !== null ? `${formatCurrency(limit.limit)}/mes` : 'Sin límite') : 'Sin definir'}
            </span>
          </div>
          <BudgetProgress spent={spent} limit={limit?.limit ?? null} />
        </button>
        {showExpenses && (
          <CategoryExpensesModal
            category={category}
            expenses={expenses}
            categoryItems={categoryItems}
            onClose={() => setShowExpenses(false)}
          />
        )}
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
      // `committed` incluye lo que YA tenía guardado esta misma categoría —
      // hay que restarlo antes de comparar, si no, editar un límite ya
      // guardado se compara contra sí mismo y casi siempre "no alcanza".
      const disponible = income - committed + (limit?.limit ?? 0)
      if (parsed > disponible) {
        setError(`Eso pasa tu ingreso disponible — te quedan ${formatCurrency(Math.max(0, disponible))}`)
        return
      }
    }
    await db.categoryLimits.put({
      id: limit?.id ?? crypto.randomUUID(),
      categoryId: category.id,
      monthKey,
      limit: parsed,
      setAt: limit?.setAt ?? Date.now(),
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
          {limit ? 'Actualizar límite' : 'Guardar límite'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {limit ? (
        <DraftHint />
      ) : (
        <p className="mt-1 text-xs text-black/40">
          Déjalo vacío para no ponerle límite — se puede corregir mientras no guardes los cambios definitivamente.
        </p>
      )}
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
  expenses,
  items,
  showAiSuggestion,
  highlightedCategoryId = null,
  editable = true,
  finalized = true,
  onDeleteCategory,
  onFinalize,
}: {
  title: string
  monthKey: string
  categories: ExpenseCategory[]
  limits: CategoryLimit[]
  incomes: MonthlyIncome[]
  spendByCategory: Map<string, number>
  expenses: Expense[]
  items: ExpenseItem[]
  showAiSuggestion: boolean
  highlightedCategoryId?: string | null
  editable?: boolean
  /** true = el mes ya se guardó de forma definitiva (ver MonthFinalization) — todo queda de solo lectura.
   * Default true para no romper usos que no pasan esta prop (ej. si algún día se olvida) — más vale mostrar
   * de más como "cerrado" que dejar editar algo que no debería. */
  finalized?: boolean
  onDeleteCategory?: (categoryId: string) => void
  /** Requerido cuando editable && !finalized — guarda la fila en monthFinalizations. */
  onFinalize?: () => Promise<void>
}) {
  const confirm = useConfirm()
  const committed = committedForMonth(limits, monthKey)
  const incomeRecord = getIncomeForMonth(monthKey, incomes)
  const income = incomeRecord?.income ?? null
  const remaining = income !== null ? income - committed : null
  const allSet = allLimitsSetForMonth(categories, limits, monthKey)
  const missingCount = categories.filter((c) => getLimitForMonth(c.id, monthKey, limits) === null).length
  const isDraft = editable && !finalized

  async function handleFinalizeClick() {
    if (!onFinalize) return
    const complete = incomeRecord !== null && missingCount === 0
    const ok = await confirm({
      title: complete
        ? `¿Guardar los límites de ${title} de forma definitiva?`
        : `Aún te faltan ${missingCount} categoría${missingCount === 1 ? '' : 's'} por definir`,
      body: complete
        ? 'Ya no vas a poder editar el ingreso ni los límites de este mes.'
        : 'Las que falten se quedan sin límite este mes, y ya no vas a poder editar nada de esto una vez guardado. ¿Guardar de todos modos?',
      confirmLabel: 'Guardar definitivamente',
      danger: !complete,
    })
    if (!ok) return
    await onFinalize()
  }

  return (
    <section>
      <h2 className="font-display font-semibold">{title}</h2>

      <div className="mt-2">
        <IncomeRow incomeRecord={incomeRecord} monthKey={monthKey} editable={editable} finalized={finalized} />
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
            finalized={finalized}
            expenses={expenses}
            items={items}
            onDeleteCategory={onDeleteCategory}
          />
        ))}
      </ul>

      {isDraft && onFinalize && (
        <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-white/40 p-4">
          <p className="text-sm text-black/60">
            Mientras no guardes los cambios definitivamente, el ingreso y cada límite siguen siendo un borrador — los
            puedes corregir cuantas veces haga falta.
          </p>
          <button
            type="button"
            onClick={handleFinalizeClick}
            className="mt-3 rounded-full bg-sage px-5 py-2 text-sm font-semibold text-black/80 transition hover:brightness-95"
          >
            🔒 Guardar cambios definitivamente
          </button>
        </div>
      )}
    </section>
  )
}
