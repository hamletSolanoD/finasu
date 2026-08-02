import { useState } from 'react'
import { ContributionGrid } from '../../components/ContributionGrid'
import { SwipeableRow } from '../../components/SwipeableRow'
import { db } from '../../lib/db'
import {
  estimatePeriodYield,
  nextPendingPeriod,
  periodLabel,
  periodStatus,
  totalPeriods,
  totalSaved,
  totalYield,
} from '../../lib/savingsGoals'
import { formatCurrency } from '../../lib/units'
import type { SavingsDeposit, SavingsGoal } from '../../lib/types'
import { SavingsGoalForm } from './SavingsGoalForm'

const STATUS_LABEL: Record<'saved' | 'missed' | 'pending', string> = {
  saved: 'ahorrado',
  missed: 'no ahorrado',
  pending: 'pendiente',
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function SavingsGoalCard({ goal, deposits }: { goal: SavingsGoal; deposits: SavingsDeposit[] }) {
  const [editing, setEditing] = useState(false)
  const [loggingPeriodIndex, setLoggingPeriodIndex] = useState<number | null>(null)
  const [depositAmount, setDepositAmount] = useState<number | ''>('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  function openLogging(index: number) {
    setDepositAmount(goal.amountPerPeriod)
    setLoggingPeriodIndex(index)
  }

  async function handleSaveDeposit() {
    if (loggingPeriodIndex === null || depositAmount === '') return
    const yieldAmount = goal.hasYield ? estimatePeriodYield(goal, totalSaved(goal.id, deposits)) : 0
    await db.savingsDeposits.add({
      id: crypto.randomUUID(),
      goalId: goal.id,
      periodIndex: loggingPeriodIndex,
      date: Date.now(),
      amount: Number(depositAmount),
      yieldAmount,
    })
    setLoggingPeriodIndex(null)
  }

  async function handleConfirmDelete() {
    await db.savingsGoalDeletions.add({
      id: crypto.randomUUID(),
      goalName: goal.name,
      goalIcon: goal.icon,
      reason: deleteReason.trim(),
      deletedAt: Date.now(),
    })
    await db.savingsDeposits.where('goalId').equals(goal.id).delete()
    await db.savingsGoals.delete(goal.id)
  }

  if (editing) {
    return (
      <SavingsGoalForm
        initial={goal}
        onSubmit={async (values) => {
          await db.savingsGoals.update(goal.id, values)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  if (confirmingDelete) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          ¿Eliminar el ahorro "{goal.name}"? También se borrarán sus depósitos registrados.
        </p>
        <label className="flex flex-col gap-1 text-sm text-black/60">
          ¿Por qué lo eliminas? (opcional)
          <textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Ej. ya cumplí la meta, cambié de planes..."
            rows={2}
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            autoFocus
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="rounded-full bg-red-500 px-5 py-2 font-display font-semibold text-white transition hover:brightness-95"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(false)
              setDeleteReason('')
            }}
            className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const saved = totalSaved(goal.id, deposits)
  const yieldTotal = totalYield(goal.id, deposits)
  const pct = goal.goalAmount > 0 ? Math.min(100, (saved / goal.goalAmount) * 100) : 0
  const reachedGoal = goal.goalAmount > 0 && saved >= goal.goalAmount

  const periods = totalPeriods(goal)
  const statuses = Array.from({ length: periods }, (_, i) => periodStatus(goal, deposits, i))
  const allSaved = periods > 0 && statuses.every((status) => status === 'saved')
  const label = periodLabel(goal.frequency)
  const labels = statuses.map((status, i) => `${capitalize(label)} ${i + 1} · ${STATUS_LABEL[status]}`)

  return (
    <SwipeableRow onEdit={() => setEditing(true)} onDelete={() => setConfirmingDelete(true)}>
      <div className="rounded-2xl border border-black/10 bg-white/50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{goal.icon}</span>
          <div>
            <p className="font-display font-semibold">{goal.name}</p>
            {goal.where && <p className="text-xs text-black/45">{goal.where}</p>}
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div className="h-full bg-sage" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-black/45">
              {formatCurrency(saved)} de {formatCurrency(goal.goalAmount)} · {Math.round(pct)}%
            </p>
            {reachedGoal && <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold">Meta alcanzada</span>}
          </div>
        </div>

        {goal.hasYield && (
          <p className="mt-2 rounded-lg bg-sky/10 px-2 py-1 text-xs font-medium text-black/60">
            + {formatCurrency(yieldTotal)} de rendimiento acumulado (aparte de tu meta, no cuenta para el total)
          </p>
        )}

        <div className="mt-4">
          <ContributionGrid statuses={statuses} labels={labels} onSquareClick={openLogging} />
        </div>

        {!allSaved && (
          <button
            type="button"
            onClick={() => openLogging(nextPendingPeriod(goal, deposits))}
            className="mt-3 rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            + Registrar ahorro
          </button>
        )}

        {loggingPeriodIndex !== null && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-3">
            <p className="text-sm font-medium text-black/70">
              Registrar {label} {loggingPeriodIndex + 1}
            </p>
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Cantidad ahorrada
              <input
                type="number"
                min="0"
                step="any"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                autoFocus
              />
            </label>
            {goal.hasYield && (
              <p className="text-xs text-black/45">
                + {formatCurrency(estimatePeriodYield(goal, totalSaved(goal.id, deposits)))} de rendimiento estimado
                se registrará automáticamente (aparte, no cuenta para tu meta).
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveDeposit}
                disabled={depositAmount === ''}
                className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setLoggingPeriodIndex(null)}
                className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </SwipeableRow>
  )
}
