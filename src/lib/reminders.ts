import { allLimitsSetForMonth, getIncomeForMonth } from './categoryLimits'
import type { CategoryLimit, ExpenseCategory, MonthlyIncome } from './types'

const NOTIFY_KEY = 'finasu:lastLimitsNotifiedDate'

/**
 * true si el mes ya quedó completo: ingreso declarado (aunque sea vacío) y
 * límite decidido (con monto o "sin límite") para CADA categoría. Con el mes
 * completo no hay nada que recordar — ni aviso en pantalla ni notificación
 * local. Es la misma lógica que monthFullySet de MonthLimitsSection.
 *
 * OJO: una categoría creada después de establecer los límites (p. ej. la de
 * IVA) vuelve a dejar el mes incompleto — eso es a propósito: hay una
 * categoría nueva sin límite decidido.
 */
export function isMonthComplete(
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  incomes: MonthlyIncome[],
  monthKey: string,
): boolean {
  return getIncomeForMonth(monthKey, incomes) !== null && allLimitsSetForMonth(categories, limits, monthKey)
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * true si todavía no se mandó una notificación local hoy sobre límites
 * pendientes — es solo para no repetir la notificación cada vez que se abre
 * Inicio, no controla si el aviso en pantalla se muestra (ese depende de si
 * ya se establecieron los límites).
 */
export function shouldNotifyToday(): boolean {
  return localStorage.getItem(NOTIFY_KEY) !== todayKey()
}

export function markNotifiedToday(): void {
  localStorage.setItem(NOTIFY_KEY, todayKey())
}
