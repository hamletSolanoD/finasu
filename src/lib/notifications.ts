import { computeMonthlySpendByCategory, computeSpendingPace, type SpendingPace } from './budget'
import { getLimitForMonth } from './categoryLimits'
import { isMonthComplete } from './reminders'
import { isLastDayOfCurrentMonth, monthKeyWithOffset } from './summary'
import type { CategoryLimit, Expense, ExpenseCategory, ExpenseItem, MonthlyIncome } from './types'

/**
 * Lógica derivada de avisos, separada en dos mundos que antes vivían juntos en
 * NotificationsPanel:
 *
 * - NOTIFICACIONES (computeReminders): recordatorios tipo sistema — "establece
 *   tus límites del mes". Se muestran en la campana 🔔 del header y como toast
 *   cuando aparecen por primera vez.
 * - WARNINGS (computeWarnings): problemas de límites del mes en curso (ritmo
 *   adelantado, casi al límite, excedido). Viven en su propio panel de Inicio.
 */

export interface Reminder {
  /** Estable entre renders y entre días (ej. 'limits-2026-08') — sirve para saber si ya se mostró como toast. */
  key: string
  icon: string
  title: string
  body: string
  /** Ruta a la que lleva el recordatorio al tocarlo. */
  to: string
}

/** El mes cuyos límites toca recordar: el actual, o el siguiente si hoy es el último día del mes. */
export function reminderTargetMonthKey(): string {
  return isLastDayOfCurrentMonth() ? monthKeyWithOffset(1) : monthKeyWithOffset(0)
}

/**
 * Recordatorios pendientes (tipo notificación de sistema). Hoy solo existe el
 * de límites del mes sin establecer — misma lógica monthFullySet/isMonthComplete
 * de siempre: solo aparece mientras el mes NO esté completo.
 *
 * AQUÍ se sumarán en el futuro las notificaciones que mande el modelo de IA
 * cuando exista — cada una con su key estable para que el toast no se repita.
 */
export function computeReminders(
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  incomes: MonthlyIncome[],
  monthKey: string,
): Reminder[] {
  const reminders: Reminder[] = []

  const advanceNotice = monthKey !== monthKeyWithOffset(0)
  if (categories.length > 0 && !isMonthComplete(categories, limits, incomes, monthKey)) {
    reminders.push({
      key: `limits-${monthKey}`,
      icon: '📅',
      title: advanceNotice
        ? 'Mañana empieza un nuevo mes'
        : 'Establece tus límites de categoría de este mes',
      body: advanceNotice
        ? 'Prepara cuánto quieres gastar en cada categoría antes de que arranque.'
        : 'Define cuánto quieres gastar en cada categoría antes de que se te pasen los tickets.',
      to: '/gastos/categorias',
    })
  }

  return reminders
}

export type WarningSeverity = 'pace' | 'critico' | 'excedido'

export interface CategoryWarning {
  key: string
  severity: WarningSeverity
  category: ExpenseCategory
  spent: number
  limit: number
  pace: SpendingPace
}

/**
 * Warnings de límites del mes en curso — NO son notificaciones: van en el
 * panel "⚠️ Avisos del mes" de Inicio. Mismos umbrales de siempre
 * (computeSpendingPace): 'excedido'/'critico' visibles y ordenados de peor a
 * mejor, 'pace' (adelantado) discretos al final.
 */
export function computeWarnings(
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'categoryId' | 'monto'>[],
  categories: ExpenseCategory[],
  limits: CategoryLimit[],
  monthKey: string,
): CategoryWarning[] {
  const spendByCategory = computeMonthlySpendByCategory(expenses, items)

  const paces = categories
    .map((category) => ({ category, limitRecord: getLimitForMonth(category.id, monthKey, limits) }))
    .filter(
      (x): x is { category: ExpenseCategory; limitRecord: CategoryLimit } =>
        x.limitRecord !== null && x.limitRecord.limit !== null,
    )
    .map(({ category, limitRecord }) => {
      const spent = spendByCategory.get(category.id) ?? 0
      const limit = limitRecord.limit!
      return { category, spent, limit, pace: computeSpendingPace(spent, limit) }
    })

  const problems = paces
    .filter((p) => p.pace.status === 'critico' || p.pace.status === 'excedido')
    .sort((a, b) => b.pace.percentUsed - a.pace.percentUsed)
    .map(
      (p): CategoryWarning => ({
        key: `${monthKey}-${p.category.id}`,
        severity: p.pace.status as 'critico' | 'excedido',
        ...p,
      }),
    )

  const ahead = paces
    .filter((p) => p.pace.status === 'adelantado')
    .map((p): CategoryWarning => ({ key: `${monthKey}-${p.category.id}`, severity: 'pace', ...p }))

  return [...problems, ...ahead]
}
