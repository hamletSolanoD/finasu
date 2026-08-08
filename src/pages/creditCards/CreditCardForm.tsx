import { useState } from 'react'
import { db } from '../../lib/db'
import type { CreditCard } from '../../lib/types'

export const CARD_ICON_PALETTE = ['💳', '🏦', '🟦', '🟥', '🟨', '⬛', '🟪', '🟩']

/** Modal de alta/edición de una tarjeta de crédito. card null = modo creación. */
export function CreditCardForm({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const [name, setName] = useState(card?.name ?? '')
  const [icon, setIcon] = useState(card?.icon ?? CARD_ICON_PALETTE[0])
  const [currentDebt, setCurrentDebt] = useState<number | ''>(card?.currentDebt ?? '')
  const [paymentDueDay, setPaymentDueDay] = useState<number | ''>(card?.paymentDueDay ?? '')
  const [minimumPayment, setMinimumPayment] = useState<number | ''>(card?.minimumPayment ?? '')
  const [isFixedDebt, setIsFixedDebt] = useState(card?.isFixedDebt ?? false)

  const dueDayValid =
    paymentDueDay !== '' && Number.isInteger(paymentDueDay) && paymentDueDay >= 1 && paymentDueDay <= 31
  const valid =
    name.trim() !== '' &&
    dueDayValid &&
    currentDebt !== '' &&
    currentDebt >= 0 &&
    minimumPayment !== '' &&
    minimumPayment >= 0

  async function handleSave() {
    if (!valid) return
    const data = {
      name: name.trim(),
      icon,
      currentDebt: Number(currentDebt),
      isFixedDebt,
      paymentDueDay: Number(paymentDueDay),
      minimumPayment: Number(minimumPayment),
    }
    if (card) {
      await db.creditCards.update(card.id, data)
    } else {
      await db.creditCards.add({ id: crypto.randomUUID(), ...data, createdAt: Date.now() })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">
          {card ? '✏️ Editar tarjeta' : '💳 Nueva tarjeta'}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej. BBVA Azul)"
            autoFocus
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />

          <div className="flex flex-wrap gap-2">
            {CARD_ICON_PALETTE.map((paletteIcon) => (
              <button
                key={paletteIcon}
                type="button"
                onClick={() => setIcon(paletteIcon)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                  paletteIcon === icon ? 'bg-sage' : 'bg-black/5 hover:bg-black/10'
                }`}
              >
                {paletteIcon}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-sm text-black/60">
            Deuda actual
            <input
              type="number"
              min="0"
              step="any"
              value={currentDebt}
              onChange={(e) => setCurrentDebt(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ej. 8500"
              className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            />
            {card && isFixedDebt && (
              <span className="text-xs text-black/45">
                Normalmente una deuda fija solo baja con tus abonos — edítala solo si necesitas corregir el
                monto.
              </span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Día de pago (1-31)
              <input
                type="number"
                min="1"
                max="31"
                step="1"
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ej. 15"
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Pago mínimo
              <input
                type="number"
                min="0"
                step="any"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ej. 450"
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
          </div>
          {paymentDueDay !== '' && !dueDayValid && (
            <p className="text-xs text-red-700">El día de pago debe ser un número entero entre 1 y 31.</p>
          )}

          <label className="flex items-start gap-2 text-sm text-black/70">
            <input
              type="checkbox"
              checked={isFixedDebt}
              onChange={(e) => setIsFixedDebt(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-black/20 accent-sage"
            />
            🔒 Es deuda fija (ya no uso esta tarjeta, solo la estoy pagando)
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {card ? 'Guardar cambios' : 'Agregar tarjeta'}
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
