import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { DatePicker } from '../../components/DatePicker'
import { InlineNumberField } from '../../components/InlineNumberField'
import { SwipeableRow } from '../../components/SwipeableRow'
import { db } from '../../lib/db'
import { formatFechaLarga } from '../../lib/date'
import { computeFutureExpenseProgress } from '../../lib/savings'
import { formatCurrency } from '../../lib/units'
import type { FutureExpense } from '../../lib/types'

function FutureExpenseRow({ expense }: { expense: FutureExpense }) {
  const { remaining, suggestedMonthly, monthsRemaining } = computeFutureExpenseProgress(expense)

  return (
    <li>
      <SwipeableRow onDelete={() => db.futureExpenses.delete(expense.id)}>
        <div className="rounded-xl border border-black/10 bg-white/60 p-3">
          <div>
            <p className="font-medium">{expense.nombre}</p>
            <p className="text-xs text-black/45">
              {expense.fechaObjetivo ? formatFechaLarga(expense.fechaObjetivo) : 'Sin fecha definida'}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-black/60">
            <span>Meta: {formatCurrency(expense.montoObjetivo)}</span>
            <label className="flex items-center gap-1">
              Ahorrado $
              <InlineNumberField
                value={expense.ahorradoHastaAhora}
                onCommit={(v) => db.futureExpenses.update(expense.id, { ahorradoHastaAhora: v ?? 0 })}
              />
            </label>
          </div>

          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full bg-sky"
                style={{ width: `${Math.min(100, (expense.ahorradoHastaAhora / expense.montoObjetivo) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-black/45">
              Faltan {formatCurrency(remaining)}
              {suggestedMonthly !== null &&
                monthsRemaining !== null &&
                ` · ahorra ${formatCurrency(suggestedMonthly)}/mes durante ${monthsRemaining} ${monthsRemaining === 1 ? 'mes' : 'meses'}`}
            </p>
          </div>
        </div>
      </SwipeableRow>
    </li>
  )
}

export function FutureExpensesPanel() {
  const expenses = useLiveQuery(() => db.futureExpenses.orderBy('fechaObjetivo').toArray(), [])

  const [nombre, setNombre] = useState('')
  const [montoObjetivo, setMontoObjetivo] = useState<number | ''>('')
  const [fechaObjetivo, setFechaObjetivo] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || montoObjetivo === '' || montoObjetivo <= 0) return
    await db.futureExpenses.add({
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      montoObjetivo: Number(montoObjetivo),
      fechaObjetivo: fechaObjetivo || null,
      ahorradoHastaAhora: 0,
      createdAt: Date.now(),
    })
    setNombre('')
    setMontoObjetivo('')
    setFechaObjetivo('')
  }

  return (
    <div>
      <ul className="mt-6 flex flex-col gap-3">
        {(expenses ?? []).map((expense) => (
          <FutureExpenseRow key={expense.id} expense={expense} />
        ))}
      </ul>

      {(expenses ?? []).length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-8 text-center text-black/50">
          Aún no agregas ningún gasto futuro.
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/50 p-4">
        <p className="font-display font-semibold">Agregar gasto futuro</p>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Sacar la visa"
          className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Monto objetivo
            <input
              type="number"
              min="0"
              step="any"
              value={montoObjetivo}
              onChange={(e) => setMontoObjetivo(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 5000"
              className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Fecha (opcional)
            <DatePicker value={fechaObjetivo} onChange={setFechaObjetivo} />
          </label>
        </div>
        <button
          type="submit"
          disabled={!nombre.trim() || montoObjetivo === '' || montoObjetivo <= 0}
          className="self-start rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Agregar
        </button>
      </form>
    </div>
  )
}
