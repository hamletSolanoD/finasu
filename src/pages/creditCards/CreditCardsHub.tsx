import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { SwipeableRow } from '../../components/SwipeableRow'
import { monthlyBudgetLeftover, nextDueDate, totalPaid } from '../../lib/creditCards'
import { db } from '../../lib/db'
import { monthKeyWithOffset } from '../../lib/summary'
import { formatCurrency } from '../../lib/units'
import type { CreditCard } from '../../lib/types'
import { AddPaymentModal } from './AddPaymentModal'
import { CreditCardForm } from './CreditCardForm'
import { PayCardsModal } from './PayCardsModal'
import { deleteCardWithPayments, dueInfo } from './cardActions'

function CardRow({ card, paid, onAbonar }: { card: CreditCard; paid: number; onAbonar: () => void }) {
  const { days, dateLabel, daysLabel } = dueInfo(card)
  // Avance de pago de una deuda fija: lo abonado contra el total original (abonado + lo que falta).
  const progressBase = paid + card.currentDebt
  const progress = progressBase > 0 ? (paid / progressBase) * 100 : 0

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {card.icon} {card.name}
            {card.isFixedDebt && (
              <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 align-middle text-[10px] font-medium text-black/50">
                🔒 Deuda fija
              </span>
            )}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">{formatCurrency(card.currentDebt)}</p>
        </div>
        <button
          type="button"
          onClick={onAbonar}
          className="shrink-0 rounded-full border border-black/15 bg-white/60 px-3 py-1.5 text-sm font-medium text-black/60 transition hover:bg-black/5"
        >
          ➕ Abonar
        </button>
      </div>

      {card.currentDebt > 0 ? (
        <p className={`mt-1 text-sm ${days <= 3 ? 'text-red-500' : 'text-black/60'}`}>
          Mínimo {formatCurrency(card.minimumPayment)} · vence {dateLabel} ({daysLabel})
        </p>
      ) : (
        <p className="mt-1 text-sm text-black/50">Sin deuda pendiente 🎉</p>
      )}
      <p className="mt-1 text-xs text-black/45">Abonado en total: {formatCurrency(paid)}</p>

      {card.isFixedDebt && (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div className="h-full bg-sage" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <p className="mt-1 text-xs text-black/45">{Math.round(progress)}% pagado</p>
        </div>
      )}
    </div>
  )
}

function CreditCardsHub() {
  const cards = useLiveQuery(() => db.creditCards.toArray(), [])
  const payments = useLiveQuery(() => db.creditCardPayments.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  // Solo id y fecha — sin arrastrar las fotos de los tickets a memoria nada más para sumar el mes.
  const lightExpenses = useLiveQuery(
    () => db.expenses.toArray((rows) => rows.map((e) => ({ id: e.id, fecha: e.fecha }))),
    [],
  )
  const expenseItems = useLiveQuery(() => db.expenseItems.toArray(), [])

  const [formCard, setFormCard] = useState<CreditCard | 'new' | null>(null)
  const [payingCard, setPayingCard] = useState<CreditCard | null>(null)
  const [showPlan, setShowPlan] = useState(false)

  // Más urgente (fecha límite más próxima) primero.
  const sortedCards = useMemo(
    () =>
      [...(cards ?? [])].sort(
        (a, b) => nextDueDate(a.paymentDueDay).getTime() - nextDueDate(b.paymentDueDay).getTime(),
      ),
    [cards],
  )
  const cardsWithDebt = sortedCards.filter((c) => c.currentDebt > 0)
  const biggestDebtCard = cardsWithDebt.reduce<CreditCard | null>(
    (max, c) => (max === null || c.currentDebt > max.currentDebt ? c : max),
    null,
  )

  const leftover = useMemo(() => {
    if (!incomes || !lightExpenses || !expenseItems) return null
    return monthlyBudgetLeftover(incomes, lightExpenses, expenseItems, monthKeyWithOffset(0))
  }, [incomes, lightExpenses, expenseItems])

  async function handleDelete(card: CreditCard) {
    if (!confirm(`¿Eliminar la tarjeta "${card.name}"? También se borra todo su historial de abonos.`))
      return
    await deleteCardWithPayments(card)
  }

  if (!cards || !payments) return null

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        💳 Tarjetas
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">💳 Tus tarjetas de crédito</h1>

      {leftover !== null && leftover > 0 && biggestDebtCard && (
        <div className="mt-6 rounded-2xl border border-dashed border-sage bg-sage/10 p-4 text-sm text-black/70">
          💡 Este mes te sobran ~{formatCurrency(leftover)} de tu presupuesto (ingreso − gastado) —
          podrías abonarlos a {biggestDebtCard.icon} {biggestDebtCard.name}.
        </div>
      )}

      {cards.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Aún no registras ninguna tarjeta
          <button
            type="button"
            onClick={() => setFormCard('new')}
            className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            + Nueva tarjeta
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {cardsWithDebt.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPlan(true)}
                className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
              >
                💸 Pago de tarjetas
              </button>
            )}
            <button
              type="button"
              onClick={() => setFormCard('new')}
              className="rounded-full border border-black/15 bg-white/60 px-5 py-2.5 font-display font-semibold text-black/60 transition hover:bg-black/5"
            >
              + Nueva tarjeta
            </button>
          </div>

          <ul className="mt-6 flex flex-col gap-3">
            {sortedCards.map((card) => (
              <li key={card.id}>
                <SwipeableRow onEdit={() => setFormCard(card)} onDelete={() => handleDelete(card)}>
                  <CardRow
                    card={card}
                    paid={totalPaid(card.id, payments)}
                    onAbonar={() => setPayingCard(card)}
                  />
                </SwipeableRow>
              </li>
            ))}
          </ul>
        </>
      )}

      {formCard && (
        <CreditCardForm card={formCard === 'new' ? null : formCard} onClose={() => setFormCard(null)} />
      )}
      {payingCard && <AddPaymentModal card={payingCard} onClose={() => setPayingCard(null)} />}
      {showPlan && <PayCardsModal cards={cardsWithDebt} onClose={() => setShowPlan(false)} />}
    </div>
  )
}

export default CreditCardsHub
