import type { SavingsDeposit, SavingsDurationUnit, SavingsFrequency, SavingsGoal } from './types'

export const ICON_PALETTE = ['💰', '🏦', '📈', '🪙', '🐷', '💎', '🏠', '🎓', '✈️', '💍', '🚗', '🩺']

export const DURATION_UNIT_OPTIONS: { value: SavingsDurationUnit; label: string; days: number }[] = [
  { value: 'semanas', label: 'semanas', days: 7 },
  { value: 'quincenas', label: 'quincenas', days: 15 },
  { value: 'meses', label: 'meses', days: 30 },
  { value: 'anios', label: 'años', days: 365 },
]

export const FREQUENCY_OPTIONS: { value: SavingsFrequency; label: string; periodLabel: string; days: number }[] = [
  { value: 'semanal', label: 'Cada semana', periodLabel: 'semana', days: 7 },
  { value: 'quincenal', label: 'Cada quincena', periodLabel: 'quincena', days: 15 },
  { value: 'mensual', label: 'Cada mes', periodLabel: 'mes', days: 30 },
]

const DAY_MS = 24 * 60 * 60 * 1000

function durationDays(value: number, unit: SavingsDurationUnit): number {
  return value * (DURATION_UNIT_OPTIONS.find((u) => u.value === unit)?.days ?? 30)
}

function frequencyDays(frequency: SavingsFrequency): number {
  return FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.days ?? 30
}

/** Cuántos periodos (cuadros) tiene esta meta, dada su duración y frecuencia de depósito. */
export function totalPeriods(goal: SavingsGoal): number {
  const total = durationDays(goal.durationValue, goal.durationUnit)
  const period = frequencyDays(goal.frequency)
  return Math.max(1, Math.round(total / period))
}

export function periodRange(goal: SavingsGoal, index: number): { start: number; end: number } {
  const period = frequencyDays(goal.frequency) * DAY_MS
  const start = goal.startDate + index * period
  return { start, end: start + period }
}

export type PeriodStatus = 'saved' | 'missed' | 'pending'

export function periodStatus(
  goal: SavingsGoal,
  deposits: SavingsDeposit[],
  index: number,
  now: number = Date.now(),
): PeriodStatus {
  if (deposits.some((d) => d.goalId === goal.id && d.periodIndex === index)) return 'saved'
  return now > periodRange(goal, index).end ? 'missed' : 'pending'
}

/** El primer periodo que todavía no tiene depósito — para la acción rápida "Registrar ahorro". */
export function nextPendingPeriod(goal: SavingsGoal, deposits: SavingsDeposit[], now: number = Date.now()): number {
  const total = totalPeriods(goal)
  for (let i = 0; i < total; i++) {
    if (periodStatus(goal, deposits, i, now) !== 'saved') return i
  }
  return total - 1
}

export function totalSaved(goalId: string, deposits: SavingsDeposit[]): number {
  return deposits.filter((d) => d.goalId === goalId).reduce((sum, d) => sum + d.amount, 0)
}

export function totalYield(goalId: string, deposits: SavingsDeposit[]): number {
  return deposits.filter((d) => d.goalId === goalId).reduce((sum, d) => sum + d.yieldAmount, 0)
}

/** Estimado simple para prellenar (editable): principal * tasa anual * (días del periodo / 365). */
export function estimatePeriodYield(goal: SavingsGoal, principalSoFar: number): number {
  if (!goal.hasYield || goal.yieldRate === null) return 0
  const period = frequencyDays(goal.frequency)
  return principalSoFar * (goal.yieldRate / 100) * (period / 365)
}

export function periodLabel(frequency: SavingsFrequency): string {
  return FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.periodLabel ?? 'periodo'
}

/**
 * Suma el rendimiento estimado de cada periodo (misma fórmula que estimatePeriodYield),
 * asumiendo que se deposita amountPerPeriod puntualmente en cada uno — sirve para
 * proyectar, antes de tener depósitos reales, cuánto rendimiento juntaría un "ahorro
 * abierto" a lo largo de toda su duración.
 */
export function estimateTotalYield(goal: SavingsGoal): number {
  if (!goal.hasYield || goal.yieldRate === null) return 0
  const periods = totalPeriods(goal)
  let sum = 0
  for (let i = 0; i < periods; i++) {
    const principalSoFar = i * goal.amountPerPeriod
    sum += estimatePeriodYield(goal, principalSoFar)
  }
  return sum
}

/**
 * Total final proyectado de un "ahorro abierto": el principal (amountPerPeriod ×
 * cantidad de periodos) más el rendimiento estimado si aplica. El rendimiento es
 * solo informativo — nunca se guarda como parte de goalAmount.
 */
export function estimateFinalTotal(goal: SavingsGoal): number {
  const principal = goal.amountPerPeriod * totalPeriods(goal)
  return principal + estimateTotalYield(goal)
}

/** Monto sugerido por periodo para alcanzar goalAmount en la cantidad de periodos dada. */
export function suggestAmountPerPeriod(goalAmount: number, periods: number): number {
  if (periods <= 0) return 0
  return goalAmount / periods
}
