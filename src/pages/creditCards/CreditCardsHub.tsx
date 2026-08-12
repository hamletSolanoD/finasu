import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '../../components/ConfirmModal'
import { SwipeableRow } from '../../components/SwipeableRow'
import { monthlyBudgetLeftover, nextDueDate, totalPaid } from '../../lib/creditCards'
import { db } from '../../lib/db'
import { monthKeyWithOffset } from '../../lib/summary'
import { formatCurrency } from '../../lib/units'
import type { CreditCard } from '../../lib/types'
import { AddPaymentModal } from './AddPaymentModal'
import { CreditCardForm } from './CreditCardForm'
import { PayCardsModal } from './PayCardsModal'
import { archiveCard, deleteCardWithPayments, dueInfo, reactivateCard } from './cardActions'

type Tab = 'activas' | 'archivadas'

/** Duración (ms) de la animación de salida al archivar — debe coincidir con la de .cc-leave abajo. */
const LEAVE_ANIMATION_MS = 320
/** Cuánto se mantiene marcada como "recién reactivada" (para el fade-in) antes de limpiar el estado. */
const ENTER_ANIMATION_MS = 500

function CardRow({
  card,
  paid,
  onAbonar,
  onArchive,
}: {
  card: CreditCard
  paid: number
  onAbonar: () => void
  onArchive: () => void
}) {
  const { days, dateLabel, daysLabel } = dueInfo(card)
  // Avance de pago de una deuda fija: lo abonado contra el total original (abonado + lo que falta).
  const progressBase = paid + card.currentDebt
  const progress = progressBase > 0 ? (paid / progressBase) * 100 : 0

  const isPaidOff = card.currentDebt === 0
  const canArchive = card.isFixedDebt && isPaidOff

  // Detecta la transición de "con deuda" a "pagada" (no en la carga inicial) para
  // animar el sello solo el momento en que de verdad se acaba de pagar.
  const wasPaidRef = useRef(isPaidOff)
  const [justPaid, setJustPaid] = useState(false)
  useEffect(() => {
    if (!wasPaidRef.current && isPaidOff) {
      setJustPaid(true)
      const timer = setTimeout(() => setJustPaid(false), 900)
      wasPaidRef.current = isPaidOff
      return () => clearTimeout(timer)
    }
    wasPaidRef.current = isPaidOff
  }, [isPaidOff])

  return (
    <div
      className={`rounded-xl border p-3 transition-colors duration-300 ${
        isPaidOff ? 'border-sage bg-sage/10' : 'border-black/10 bg-white/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {card.icon} {card.name}
            {card.isFixedDebt && (
              <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 align-middle text-[10px] font-medium text-black/50">
                🔒 Deuda fija
              </span>
            )}
            {isPaidOff && (
              <span
                className={`ml-2 inline-block rounded-full bg-sage px-2 py-0.5 align-middle text-[10px] font-semibold text-black/70 ${
                  justPaid ? 'cc-pop' : ''
                }`}
              >
                🎉 ¡Pagada!
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
        <p className="mt-1 text-sm text-black/60">Sin deuda pendiente</p>
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

      {canArchive && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95"
          >
            📦 Archivar
          </button>
        </div>
      )}
    </div>
  )
}

function ArchivedCardRow({ card, onReactivate }: { card: CreditCard; onReactivate: () => void }) {
  const archivedLabel = card.archivedAt
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        card.archivedAt,
      )
    : null

  return (
    <div className="rounded-xl border border-black/10 bg-white/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-black/70">
            {card.icon} {card.name}
          </p>
          {archivedLabel && <p className="mt-0.5 text-xs text-black/45">Archivada el {archivedLabel}</p>}
        </div>
        <button
          type="button"
          onClick={onReactivate}
          className="shrink-0 rounded-full border border-black/15 bg-white/60 px-3 py-1.5 text-sm font-medium text-black/60 transition hover:bg-black/5"
        >
          ↩️ Reactivar
        </button>
      </div>
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

  const confirm = useConfirm()

  const [formCard, setFormCard] = useState<CreditCard | 'new' | null>(null)
  const [payingCard, setPayingCard] = useState<CreditCard | null>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [tab, setTab] = useState<Tab>('activas')
  // Ids en animación de salida (archivando) o de entrada (recién reactivadas) — solo para la clase CSS.
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())

  // Más urgente (fecha límite más próxima) primero. Ya excluye archivadas, así que
  // cualquier lista derivada de esta (incluida la que se le pasa a PayCardsModal /
  // planPayments) nunca las considera.
  const activeCards = useMemo(
    () =>
      [...(cards ?? [])]
        .filter((c) => !c.archivedAt)
        .sort((a, b) => nextDueDate(a.paymentDueDay).getTime() - nextDueDate(b.paymentDueDay).getTime()),
    [cards],
  )
  const archivedCards = useMemo(
    () =>
      [...(cards ?? [])].filter((c) => c.archivedAt).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [cards],
  )
  const cardsWithDebt = activeCards.filter((c) => c.currentDebt > 0)
  const biggestDebtCard = cardsWithDebt.reduce<CreditCard | null>(
    (max, c) => (max === null || c.currentDebt > max.currentDebt ? c : max),
    null,
  )

  const leftover = useMemo(() => {
    if (!incomes || !lightExpenses || !expenseItems) return null
    return monthlyBudgetLeftover(incomes, lightExpenses, expenseItems, monthKeyWithOffset(0))
  }, [incomes, lightExpenses, expenseItems])

  async function handleDelete(card: CreditCard) {
    const ok = await confirm({
      title: `¿Eliminar "${card.name}"?`,
      body: 'También se borra todo su historial de abonos.',
    })
    if (!ok) return
    await deleteCardWithPayments(card)
  }

  async function handleArchive(card: CreditCard) {
    const ok = await confirm({
      title: `¿Archivar ${card.name}?`,
      body: 'Se mueve a la pestaña de Archivadas para tener el registro de que ya la pagaste — puedes reactivarla cuando quieras.',
      confirmLabel: 'Archivar',
      danger: false,
    })
    if (!ok) return
    // Anima la salida antes de tocar la base — si no, React la quita de la lista de inmediato y no se alcanza a ver.
    setLeavingIds((prev) => new Set(prev).add(card.id))
    setTimeout(async () => {
      await archiveCard(card.id)
      setLeavingIds((prev) => {
        const next = new Set(prev)
        next.delete(card.id)
        return next
      })
    }, LEAVE_ANIMATION_MS)
  }

  async function handleReactivate(card: CreditCard) {
    setEnteringIds((prev) => new Set(prev).add(card.id))
    setTab('activas')
    await reactivateCard(card.id)
    setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev)
        next.delete(card.id)
        return next
      })
    }, ENTER_ANIMATION_MS)
  }

  if (!cards || !payments) return null

  return (
    <div className="mx-auto max-w-lg">
      {/* Animaciones cortas para el sello de "pagada", el archivado y la reactivación de tarjetas. */}
      <style>{`
        @keyframes cc-pop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cc-leave {
          to { opacity: 0; transform: translateX(16px) scale(0.97); }
        }
        @keyframes cc-enter {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
        }
        .cc-pop { animation: cc-pop 0.5s ease-out; }
        .cc-leave { animation: cc-leave ${LEAVE_ANIMATION_MS}ms ease-in forwards; }
        .cc-enter { animation: cc-enter 0.4s ease-out; }
      `}</style>

      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        💳 Tarjetas
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        {tab === 'archivadas' && cards.length > 0 ? '📦 Tarjetas archivadas' : '💳 Tus tarjetas de crédito'}
      </h1>

      {leftover !== null && leftover > 0 && biggestDebtCard && tab === 'activas' && (
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
          <div className="mt-6 inline-flex rounded-full border border-black/10 bg-white/50 p-1">
            <button
              type="button"
              onClick={() => setTab('activas')}
              className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition ${
                tab === 'activas' ? 'bg-sage text-black/80' : 'text-black/50 hover:bg-black/5'
              }`}
            >
              💳 Activas
            </button>
            <button
              type="button"
              onClick={() => setTab('archivadas')}
              className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition ${
                tab === 'archivadas' ? 'bg-sage text-black/80' : 'text-black/50 hover:bg-black/5'
              }`}
            >
              📦 Archivadas{archivedCards.length > 0 ? ` (${archivedCards.length})` : ''}
            </button>
          </div>

          {tab === 'activas' ? (
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

              {activeCards.length === 0 ? (
                <p className="mt-8 text-center text-sm text-black/50">
                  No tienes tarjetas activas — revisa 📦 Archivadas o agrega una nueva.
                </p>
              ) : (
                <ul className="mt-6 flex flex-col gap-3">
                  {activeCards.map((card) => (
                    <li
                      key={card.id}
                      className={
                        leavingIds.has(card.id) ? 'cc-leave' : enteringIds.has(card.id) ? 'cc-enter' : ''
                      }
                    >
                      <SwipeableRow onEdit={() => setFormCard(card)} onDelete={() => handleDelete(card)}>
                        <CardRow
                          card={card}
                          paid={totalPaid(card.id, payments)}
                          onAbonar={() => setPayingCard(card)}
                          onArchive={() => handleArchive(card)}
                        />
                      </SwipeableRow>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="mt-6">
              {archivedCards.length === 0 ? (
                <p className="mt-2 text-center text-sm text-black/50">
                  Aún no has archivado ninguna tarjeta.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {archivedCards.map((card) => (
                    <li key={card.id}>
                      <ArchivedCardRow card={card} onReactivate={() => handleReactivate(card)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
