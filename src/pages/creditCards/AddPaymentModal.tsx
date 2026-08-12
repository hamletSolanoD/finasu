import { useState } from 'react'
import { DatePicker } from '../../components/DatePicker'
import { localTodayIso } from '../../lib/date'
import { formatCurrency } from '../../lib/units'
import type { CreditCard } from '../../lib/types'
import { registerPayments } from './cardActions'

/** Mini-formulario para registrar un abono a una tarjeta: monto + fecha (default hoy). */
export function AddPaymentModal({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const [amount, setAmount] = useState<number | ''>('')
  const [fecha, setFecha] = useState(localTodayIso)

  const valid = amount !== '' && amount > 0 && fecha !== ''

  async function handleSave() {
    if (!valid) return
    // Mediodía local para que la zona horaria nunca recorra el abono al día anterior/siguiente.
    const date = new Date(`${fecha}T12:00:00`).getTime()
    await registerPayments([{ cardId: card.id, amount: Number(amount), date }])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">
          ➕ Abonar a {card.icon} {card.name}
        </h2>
        <p className="mt-1 text-sm text-black/60">Deuda actual: {formatCurrency(card.currentDebt)}</p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Monto del abono
            <input
              type="number"
              min="0"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 500"
              className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Fecha
            <DatePicker value={fecha} onChange={setFecha} />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Registrar abono
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
