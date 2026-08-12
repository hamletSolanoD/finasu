import { daysUntil, nextDueDate } from '../../lib/creditCards'
import { db } from '../../lib/db'
import type { CreditCard } from '../../lib/types'

/**
 * Registra uno o varios abonos y descuenta cada uno de la deuda de su tarjeta
 * — todo en UNA transacción, para que nunca quede un abono guardado sin su
 * descuento (o al revés). La deuda nunca baja de 0: si abonas de más (ej. la
 * app redondeó o la deuda ya había bajado), se recorta a 0.
 */
export async function registerPayments(
  entries: { cardId: string; amount: number; date: number }[],
): Promise<void> {
  await db.transaction('rw', db.creditCards, db.creditCardPayments, async () => {
    for (const { cardId, amount, date } of entries) {
      await db.creditCardPayments.add({ id: crypto.randomUUID(), cardId, amount, date })
      const card = await db.creditCards.get(cardId)
      if (card) {
        const newDebt = Math.max(0, Math.round((card.currentDebt - amount) * 100) / 100)
        await db.creditCards.update(cardId, { currentDebt: newDebt })
      }
    }
  })
}

/** Borra la tarjeta Y todo su historial de abonos, en una sola transacción. */
export async function deleteCardWithPayments(card: CreditCard): Promise<void> {
  await db.transaction('rw', db.creditCards, db.creditCardPayments, async () => {
    await db.creditCardPayments.where('cardId').equals(card.id).delete()
    await db.creditCards.delete(card.id)
  })
}

/** Archiva una tarjeta de deuda fija ya pagada — se mueve a la pestaña "Archivadas". */
export async function archiveCard(id: string): Promise<void> {
  await db.creditCards.update(id, { archivedAt: Date.now() })
}

/** Reactiva una tarjeta archivada — regresa a la vista principal de tarjetas activas. */
export async function reactivateCard(id: string): Promise<void> {
  await db.creditCards.update(id, { archivedAt: undefined })
}

/** Próxima fecha límite de la tarjeta, lista para mostrar: "15 de agosto" + "en 7 días"/"hoy"/"mañana". */
export function dueInfo(card: CreditCard): { due: Date; days: number; dateLabel: string; daysLabel: string } {
  const due = nextDueDate(card.paymentDueDay)
  const days = daysUntil(due)
  const dateLabel = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' }).format(due)
  const daysLabel = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`
  return { due, days, dateLabel, daysLabel }
}
