import type { FutureExpense } from './types'

/** Meses completos entre hoy y la fecha objetivo (mínimo 1, para no dividir entre 0 o negativos). */
export function monthsUntil(fechaObjetivo: string): number {
  const target = new Date(`${fechaObjetivo}T00:00:00`)
  const now = new Date()
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(1, months)
}

export interface FutureExpenseProgress {
  remaining: number
  suggestedMonthly: number | null
  monthsRemaining: number | null
}

export function computeFutureExpenseProgress(expense: FutureExpense): FutureExpenseProgress {
  const remaining = Math.max(0, expense.montoObjetivo - expense.ahorradoHastaAhora)
  if (!expense.fechaObjetivo || remaining === 0) {
    return { remaining, suggestedMonthly: null, monthsRemaining: null }
  }
  const months = monthsUntil(expense.fechaObjetivo)
  return { remaining, suggestedMonthly: remaining / months, monthsRemaining: months }
}
