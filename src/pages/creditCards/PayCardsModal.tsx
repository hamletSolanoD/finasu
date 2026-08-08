import { useMemo, useState } from 'react'
import { planPayments } from '../../lib/creditCards'
import { formatCurrency } from '../../lib/units'
import type { CreditCard } from '../../lib/types'
import { dueInfo, registerPayments } from './cardActions'

/**
 * Flujo quincenal "Pago de tarjetas": pones cuánto dinero tienes y la app arma
 * el plan — qué tarjeta pagar primero para evitar intereses y cuánto a cada
 * una. "Registrar estos pagos" aplica todos los abonos del plan de un jalón.
 */
export function PayCardsModal({ cards, onClose }: { cards: CreditCard[]; onClose: () => void }) {
  const [amount, setAmount] = useState<number | ''>('')
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null)
  const [registered, setRegistered] = useState(false)

  const plan = useMemo(
    () => (confirmedAmount === null ? null : planPayments(cards, confirmedAmount)),
    [cards, confirmedAmount],
  )

  async function handleRegister() {
    if (!plan || plan.allocations.length === 0) return
    await registerPayments(
      plan.allocations.map((a) => ({ cardId: a.card.id, amount: a.amount, date: Date.now() })),
    )
    setRegistered(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {registered ? (
          <>
            <h2 className="font-display text-xl font-semibold">✅ Pagos registrados</h2>
            <p className="mt-2 text-sm text-black/60">
              Se registraron los abonos del plan y las deudas de tus tarjetas ya quedaron actualizadas.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95"
            >
              Cerrar
            </button>
          </>
        ) : plan === null ? (
          <>
            <h2 className="font-display text-xl font-semibold">💸 Pago de tarjetas</h2>
            <label className="mt-4 flex flex-col gap-1 text-sm text-black/60">
              ¿Cuánto tienes para pagar esta quincena?
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ej. 3000"
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmedAmount(Number(amount))}
                disabled={amount === '' || amount <= 0}
                className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ver plan
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold">💸 Plan de pago</h2>
            <p className="mt-1 text-sm text-black/60">
              Con {formatCurrency(confirmedAmount ?? 0)}, esto es lo que conviene pagar primero para evitar
              intereses:
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {plan.allocations.map(({ card, amount: assigned, coversMinimum }) => {
                const { dateLabel, daysLabel } = dueInfo(card)
                const needed = Math.min(card.minimumPayment, card.currentDebt)
                const extra = Math.round((assigned - needed) * 100) / 100
                return (
                  <li key={card.id} className="rounded-xl border border-black/10 bg-white/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {card.icon} {card.name}
                      </p>
                      <p className="shrink-0 font-semibold">{formatCurrency(assigned)}</p>
                    </div>
                    <p className="text-xs text-black/50">
                      Vence {dateLabel} ({daysLabel})
                    </p>
                    <p className={`mt-1 text-xs ${coversMinimum ? 'text-black/60' : 'text-red-600'}`}>
                      {coversMinimum
                        ? extra > 0
                          ? `✅ Cubre el mínimo + ${formatCurrency(extra)} de abono extra`
                          : '✅ Cubre el mínimo'
                        : '⚠️ Abono parcial — no alcanza el mínimo'}
                    </p>
                  </li>
                )
              })}
            </ul>

            {plan.uncovered.map((card) => (
              <p key={card.id} className="mt-2 text-sm text-red-600">
                ⚠️ No te alcanza para el mínimo de {card.name} — genera intereses
              </p>
            ))}

            {plan.leftover > 0 && (
              <p className="mt-3 text-sm text-black/60">
                Después de estos pagos te sobrarían {formatCurrency(plan.leftover)} 🎉
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRegister}
                disabled={plan.allocations.length === 0}
                className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Registrar estos pagos
              </button>
              <button
                type="button"
                onClick={() => setConfirmedAmount(null)}
                className="rounded-full border border-black/15 bg-white/60 px-4 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5"
              >
                Cambiar monto
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
