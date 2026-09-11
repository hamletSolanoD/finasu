import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './ConfirmModal'
import { SwipeableRow } from './SwipeableRow'
import { computeBudgetState } from '../lib/budget'
import { allLimitsSetForMonth, committedForMonth, getIncomeForMonth, getLimitForMonth } from '../lib/categoryLimits'
import { formatFechaLarga } from '../lib/date'
import { db } from '../lib/db'
import { autoSetIvaLimitForMonth } from '../lib/ivaCategory'
import { computeCategoryBreakdown } from '../lib/summary'
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
 * esperar al mes siguiente. Incluso ya cerrado, un botón "Editar" (con
 * confirmación) lo vuelve a abrir — el bloqueo es para no "hacer trampa"
 * ajustando el presupuesto después de gastar, no para dejar un error de
 * captura sin arreglo.
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
  const [forceEdit, setForceEdit] = useState(false)
  const confirm = useConfirm()

  async function handleUnlock() {
    const ok = await confirm({
      title: '¿Editar el ingreso de un mes ya cerrado?',
      body: 'Esto es para corregir un error de captura — no para ajustar tu presupuesto después de haber gastado. Se guarda directo, sin otro paso de confirmación.',
      confirmLabel: 'Sí, editar',
      danger: true,
    })
    if (ok) setForceEdit(true)
  }

  if ((incomeRecord && finalized && !forceEdit) || !editable) {
    return (
      <p className="text-sm text-black/60">
        Ingreso de este mes:{' '}
        <span className="font-semibold text-black/80">
          {incomeRecord && incomeRecord.income !== null ? formatCurrency(incomeRecord.income) : 'sin declarar'}
        </span>
        {editable && finalized && (
          <button
            type="button"
            onClick={handleUnlock}
            className="ml-2 text-xs font-medium text-black/40 underline hover:text-black/60"
          >
            ✏️ Editar
          </button>
        )}
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
    const id = incomeRecord?.id ?? crypto.randomUUID()
    await db.monthlyIncomes.put({
      id,
      monthKey,
      income: parsed,
      // Siempre Date.now(), nunca reusar el setAt viejo al corregir: es lo
      // que usa getIncomeForMonth para decidir cuál gana si por algún motivo
      // quedó una fila duplicada de antes — si esta corrección no queda como
      // la más reciente, un duplicado viejo podría seguir "ganando" y la
      // corrección se vería como si no hubiera pasado nada.
      setAt: Date.now(),
    })
    // Limpieza defensiva: si por algo (ej. datos de antes del arreglo de
    // arriba) quedó más de una fila de ingreso para este mes, se borran las
    // demás — solo debe existir una.
    const duplicates = await db.monthlyIncomes.where('monthKey').equals(monthKey).toArray()
    const staleIds = duplicates.filter((d) => d.id !== id).map((d) => d.id)
    if (staleIds.length > 0) await db.monthlyIncomes.bulkDelete(staleIds)
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
          onFocus={(e) => e.target.select()}
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
      {finalized && forceEdit ? (
        <p className="mt-1 text-xs text-amber-700">
          Este mes ya estaba cerrado — al guardar, el cambio queda de una vez, sin volver a bloquearse solo.
        </p>
      ) : incomeRecord ? (
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
  const [forceEdit, setForceEdit] = useState(false)
  const confirm = useConfirm()
  const domId = `cat-${category.id}`
  const highlightRing = highlighted ? 'ring-2 ring-sky ring-offset-2 ring-offset-cream' : ''

  async function handleUnlock(e: MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({
      title: `¿Editar el límite de ${category.name} de un mes ya cerrado?`,
      body: 'Esto es para corregir un error de captura — no para ajustar tu presupuesto después de haber gastado. Se guarda directo, sin otro paso de confirmación.',
      confirmLabel: 'Sí, editar',
      danger: true,
    })
    if (ok) setForceEdit(true)
  }

  if ((limit && finalized && !forceEdit) || !editable) {
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
            <span className="flex items-center gap-2 text-sm text-black/50">
              {limit ? (limit.limit !== null ? `${formatCurrency(limit.limit)}/mes` : 'Sin límite') : 'Sin definir'}
              {editable && finalized && (
                <button
                  type="button"
                  onClick={handleUnlock}
                  className="text-xs font-medium text-black/40 underline hover:text-black/60"
                >
                  ✏️ Editar
                </button>
              )}
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
    const id = limit?.id ?? crypto.randomUUID()
    await db.categoryLimits.put({
      id,
      categoryId: category.id,
      monthKey,
      limit: parsed,
      // Mismo motivo que en IncomeRow: siempre Date.now(), nunca reusar el
      // setAt viejo — es lo que decide cuál fila gana si quedó un duplicado.
      setAt: Date.now(),
    })
    // Limpieza defensiva: si por algo quedó más de una fila de límite para
    // esta categoría+mes, se borran las demás — solo debe existir una.
    const duplicates = await db.categoryLimits
      .where('monthKey')
      .equals(monthKey)
      .and((l) => l.categoryId === category.id)
      .toArray()
    const staleIds = duplicates.filter((d) => d.id !== id).map((d) => d.id)
    if (staleIds.length > 0) await db.categoryLimits.bulkDelete(staleIds)
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
          onFocus={(e) => e.target.select()}
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
      {finalized && forceEdit ? (
        <p className="mt-1 text-xs text-amber-700">
          Este mes ya estaba cerrado — al guardar, el cambio queda de una vez, sin volver a bloquearse solo.
        </p>
      ) : limit ? (
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

  // Para meses cerrados (!editable, ver OtherMonths): "sobra"/"disponible" de
  // arriba es lo PRESUPUESTADO (ingreso - límites) — no lo que en realidad
  // pasó. Aquí se calcula lo real (ingreso - gasto real, categorías con
  // límite numérico realmente puesto, y cuántas de esas se cumplieron) para
  // no confundir "en teoría sobraba" con "en la práctica gasté de más".
  const { total: totalSpent } = computeCategoryBreakdown(expenses, items, categories, monthKey)
  const realBalance = income !== null ? income - totalSpent : null
  const categoriesWithNumericLimit = categories.filter((c) => {
    const l = getLimitForMonth(c.id, monthKey, limits)
    return l !== null && l.limit !== null
  })
  const onBudgetCount = categoriesWithNumericLimit.filter((c) => {
    const l = getLimitForMonth(c.id, monthKey, limits)!
    return (spendByCategory.get(c.id) ?? 0) <= l.limit!
  }).length
  const efficiency =
    categoriesWithNumericLimit.length > 0 ? (onBudgetCount / categoriesWithNumericLimit.length) * 100 : null

  async function handleFinalizeClick() {
    if (!onFinalize) return

    // El balance negativo se pregunta APARTE de "te faltan categorías" — es
    // una decisión distinta (no es que falte decidir algo, es que lo ya
    // decidido no alcanza) y a veces es válido arrancar el mes así a
    // propósito, así que aquí se puede elegir seguir en vez de solo avisar.
    if (remaining !== null && remaining < 0) {
      const proceedAnyway = await confirm({
        title: `Tu balance queda en negativo — te pasaste por ${formatCurrency(Math.abs(remaining))}`,
        body: 'Puedes volver a ajustar tus límites, o guardar así de todos modos — a veces el mes arranca con la cuenta en contra y está bien.',
        confirmLabel: 'Guardar así de todos modos',
        cancelLabel: 'Volver a ajustar límites',
        danger: true,
      })
      if (!proceedAnyway) return
      await onFinalize()
      return
    }

    const complete = incomeRecord !== null && missingCount === 0
    const ok = await confirm({
      title: complete
        ? `¿Guardar los límites de ${title} de forma definitiva?`
        : `Aún te faltan ${missingCount} categoría${missingCount === 1 ? '' : 's'} por definir`,
      body: complete
        ? 'El ingreso y los límites quedan fijos — si necesitas corregir algo después, vas a poder, pero pidiendo confirmar cada vez.'
        : 'Las que falten se quedan sin límite este mes. ¿Guardar de todos modos?',
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
              {editable ? (allSet ? 'sobra' : 'disponible para repartir') : 'presupuestado'}
            </span>
          </p>
          {remaining < 0 && <p className="mt-1 text-xs text-red-700">Tus límites ya suman más que tu ingreso.</p>}
          {showAiSuggestion && allSet && remaining > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-sky/50 bg-sky/10 p-3 text-sm text-black/60">
              🤖 <span className="font-medium">Sugerencia de la IA:</span> próximamente aquí te diré en qué te
              conviene usar {formatCurrency(remaining)}, tomando en cuenta tus gastos y tus ahorros.
            </div>
          )}

          {!editable && realBalance !== null && (
            <div className="mt-3 border-t border-black/10 pt-3">
              <p className="text-sm text-black/60">
                Gasto real: <span className="font-semibold text-black/80">{formatCurrency(totalSpent)}</span>
              </p>
              <p className={`mt-1 text-sm font-medium ${realBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {realBalance < 0
                  ? `Te pasaste por ${formatCurrency(Math.abs(realBalance))} de tu ingreso`
                  : `De verdad sobraron ${formatCurrency(realBalance)}`}
              </p>
            </div>
          )}
        </div>
      )}

      {!editable && (
        <div className="mt-2 rounded-2xl border border-black/10 bg-white/50 p-4">
          <p className="text-sm text-black/60">
            Categorías con límite: <span className="font-semibold text-black/80">{categoriesWithNumericLimit.length}/{categories.length}</span>
          </p>
          {efficiency !== null && (
            <p className="mt-1 text-sm text-black/60">
              Eficiencia del mes: <span className="font-semibold text-black/80">{Math.round(efficiency)}%</span>
              <span className="text-xs text-black/40">
                {' '}
                ({onBudgetCount}/{categoriesWithNumericLimit.length} categorías con límite no se pasaron)
              </span>
            </p>
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
