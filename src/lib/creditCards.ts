import { getIncomeForMonth } from './categoryLimits'
import type { CreditCard, CreditCardPayment, Expense, ExpenseItem, MonthlyIncome } from './types'

/** Redondeo a centavos — evita residuos flotantes al ir restando montos de dinero. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

/** Suma de todos los abonos registrados a esa tarjeta. */
export function totalPaid(cardId: string, payments: CreditCardPayment[]): number {
  return payments.filter((p) => p.cardId === cardId).reduce((sum, p) => sum + p.amount, 0)
}

/**
 * La próxima fecha límite de pago: este mes si el día aún no pasa (hoy cuenta
 * como "aún no pasa"), si no, el mes siguiente. En meses cortos el día se
 * recorre al último día real del mes (día 31 en febrero → 28/29).
 */
export function nextDueDate(paymentDueDay: number, from: Date = new Date()): Date {
  const year = from.getFullYear()
  const month = from.getMonth()
  const daysInThisMonth = new Date(year, month + 1, 0).getDate()
  const dueThisMonth = Math.min(paymentDueDay, daysInThisMonth)
  if (dueThisMonth >= from.getDate()) {
    return new Date(year, month, dueThisMonth)
  }
  const daysInNextMonth = new Date(year, month + 2, 0).getDate()
  return new Date(year, month + 1, Math.min(paymentDueDay, daysInNextMonth))
}

/** Días enteros de calendario hasta esa fecha (0 = hoy, 1 = mañana). */
export function daysUntil(date: Date, from: Date = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // Math.round y no una división exacta: los días con cambio de horario duran 23/25 horas.
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

export interface PaymentAllocation {
  card: CreditCard
  /** Cuánto abonarle a esta tarjeta según el plan. */
  amount: number
  /** true si el monto asignado cubre el mínimo (o liquida la deuda, si es menor al mínimo). */
  coversMinimum: boolean
}

export interface PaymentPlan {
  allocations: PaymentAllocation[]
  /** Lo que queda sin asignar después de repartir (0 salvo que las deudas se liquiden completas). */
  leftover: number
  /** Tarjetas cuyo mínimo no alcanzó a cubrirse con el dinero disponible — van a generar intereses. */
  uncovered: CreditCard[]
}

/**
 * Reparte el dinero disponible entre las tarjetas con deuda para evitar
 * intereses: primero los mínimos en orden de urgencia (fecha límite más
 * próxima primero; si la deuda es menor al mínimo, con liquidarla basta).
 *
 * Si después de cubrir todos los mínimos sobra dinero, el sobrante se asigna
 * como abono extra a la tarjeta de MAYOR deuda. Honesto: sin conocer la tasa
 * de interés de cada tarjeta, abonar a la deuda más grande es solo una
 * aproximación razonable — cuando exista el modelo de IA podrá afinar esto
 * con las tasas reales.
 *
 * Si el dinero NO alcanza para todos los mínimos, las tarjetas que quedaron
 * fuera van en `uncovered`, y lo que haya quedado se asigna como abono
 * parcial (coversMinimum: false) a la más urgente de ellas — mejor bajarle
 * algo a la deuda que dejar dinero sin usar. Nunca se asigna más que la
 * deuda actual de una tarjeta.
 */
export function planPayments(cards: CreditCard[], available: number, from: Date = new Date()): PaymentPlan {
  const withDebt = cards.filter((c) => c.currentDebt > 0)
  const byUrgency = [...withDebt].sort((a, b) => {
    const diff = nextDueDate(a.paymentDueDay, from).getTime() - nextDueDate(b.paymentDueDay, from).getTime()
    return diff !== 0 ? diff : b.currentDebt - a.currentDebt
  })

  let remaining = roundCents(Math.max(0, available))
  const allocated = new Map<string, number>()
  const uncovered: CreditCard[] = []

  // 1) Mínimos en orden de urgencia. Una tarjeta que no alcanza no detiene a las
  // siguientes: si el mínimo de otra sí cabe, cubrirlo completo evita SUS intereses.
  for (const card of byUrgency) {
    const needed = roundCents(Math.min(card.minimumPayment, card.currentDebt))
    if (needed <= 0) continue
    if (remaining >= needed) {
      allocated.set(card.id, needed)
      remaining = roundCents(remaining - needed)
    } else {
      uncovered.push(card)
    }
  }

  if (uncovered.length === 0) {
    // 2) Sobrante como abono extra a la de mayor deuda (y si la liquida, a la siguiente).
    const byDebt = [...withDebt].sort((a, b) => b.currentDebt - a.currentDebt)
    for (const card of byDebt) {
      if (remaining <= 0) break
      const already = allocated.get(card.id) ?? 0
      const room = roundCents(card.currentDebt - already)
      if (room <= 0) continue
      const extra = Math.min(room, remaining)
      allocated.set(card.id, roundCents(already + extra))
      remaining = roundCents(remaining - extra)
    }
  } else if (remaining > 0) {
    // 2') No alcanzó para todos los mínimos: lo que quede va como abono parcial a la
    // más urgente de las que quedaron fuera (remaining < su mínimo <= su deuda, así
    // que nunca excede la deuda).
    const card = uncovered[0]
    const partial = Math.min(remaining, roundCents(card.currentDebt))
    allocated.set(card.id, partial)
    remaining = roundCents(remaining - partial)
  }

  const allocations: PaymentAllocation[] = byUrgency
    .filter((card) => (allocated.get(card.id) ?? 0) > 0)
    .map((card) => {
      const amount = allocated.get(card.id)!
      const needed = roundCents(Math.min(card.minimumPayment, card.currentDebt))
      return { card, amount, coversMinimum: amount >= needed }
    })

  return { allocations, leftover: remaining, uncovered }
}

/**
 * Lo que sobra del presupuesto del mes: ingreso declarado menos el gasto total
 * (todos los productos de los tickets cuya fecha cae en ese mes). null si no
 * hay ingreso declarado para ese mes — sin ingreso no hay nada que comparar.
 * Puede ser negativo si ya se gastó más que el ingreso.
 */
export function monthlyBudgetLeftover(
  incomes: MonthlyIncome[],
  expenses: Pick<Expense, 'id' | 'fecha'>[],
  items: Pick<ExpenseItem, 'expenseId' | 'monto'>[],
  monthKey: string,
): number | null {
  const income = getIncomeForMonth(monthKey, incomes)
  if (!income || income.income === null) return null
  const expenseIdsInMonth = new Set(expenses.filter((e) => e.fecha.slice(0, 7) === monthKey).map((e) => e.id))
  const spent = items.filter((i) => expenseIdsInMonth.has(i.expenseId)).reduce((sum, i) => sum + i.monto, 0)
  return income.income - spent
}
