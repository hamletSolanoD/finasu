import { useEffect, useState, type FormEvent } from 'react'
import { Dropdown } from '../../components/Dropdown'
import {
  DURATION_UNIT_OPTIONS,
  estimateFinalTotal,
  estimateTotalYield,
  FREQUENCY_OPTIONS,
  ICON_PALETTE,
  periodLabel,
  suggestAmountPerPeriod,
  totalPeriods,
} from '../../lib/savingsGoals'
import { formatCurrency } from '../../lib/units'
import type { SavingsDurationUnit, SavingsFrequency, SavingsGoal } from '../../lib/types'

type Mode = 'abierto' | 'meta'

/**
 * Alta/edición de una meta de ahorro fija (ej. "Viaje a Japón"): cuánto
 * tiempo se ahorra, cada cuánto, cuánto por periodo y la meta total. El
 * rendimiento (% anual) solo se pide si el ahorro lo genera, y se deja claro
 * que es solo un estimado para prellenar, nunca parte de la meta.
 *
 * Tiene dos modos: "Ahorro abierto" (defines cuánto ahorras cada periodo y
 * calculamos el total final) y "Ahorro con meta" (defines la meta total y te
 * sugerimos cuánto ahorrar cada periodo). El modo es solo una ayuda de la UI
 * para llenar el formulario — no se guarda, solo determina qué campo es la
 * fuente de verdad al enviar.
 */
export function SavingsGoalForm({
  initial,
  onSubmit,
  onCancel,
}: {
  /** Si viene, se está editando esa meta; si no, se está creando una nueva. */
  initial?: SavingsGoal
  onSubmit: (values: Omit<SavingsGoal, 'id'>) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<Mode>(initial ? 'meta' : 'abierto')
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ICON_PALETTE[0])
  const [where, setWhere] = useState(initial?.where ?? '')
  const [durationValue, setDurationValue] = useState<number | ''>(initial?.durationValue ?? '')
  const [durationUnit, setDurationUnit] = useState<SavingsDurationUnit>(
    initial?.durationUnit ?? DURATION_UNIT_OPTIONS[0].value,
  )
  const [frequency, setFrequency] = useState<SavingsFrequency>(initial?.frequency ?? FREQUENCY_OPTIONS[0].value)
  const [amountPerPeriod, setAmountPerPeriod] = useState<number | ''>(initial?.amountPerPeriod ?? '')
  // Ya se editó a mano el monto por periodo — evita que la sugerencia del modo "meta" lo pise.
  const [amountPerPeriodTouched, setAmountPerPeriodTouched] = useState(Boolean(initial))
  const [goalAmount, setGoalAmount] = useState<number | ''>(initial?.goalAmount ?? '')
  const [hasYield, setHasYield] = useState(initial?.hasYield ?? false)
  const [yieldRate, setYieldRate] = useState<number | ''>(initial?.yieldRate ?? '')

  // Meta "borrador" con los valores actuales del formulario, para poder reutilizar los
  // helpers de lib/savingsGoals.ts (que trabajan sobre un SavingsGoal completo) mientras
  // se está llenando el formulario, sin necesidad de reinventar sus cálculos aquí.
  const draftGoal: SavingsGoal = {
    id: initial?.id ?? '',
    name: name.trim() || 'ahorro',
    icon,
    where: where.trim(),
    startDate: initial?.startDate ?? Date.now(),
    durationValue: typeof durationValue === 'number' ? durationValue : 0,
    durationUnit,
    frequency,
    amountPerPeriod: typeof amountPerPeriod === 'number' ? amountPerPeriod : 0,
    goalAmount: typeof goalAmount === 'number' ? goalAmount : 0,
    hasYield,
    yieldRate: hasYield ? (typeof yieldRate === 'number' ? yieldRate : 0) : null,
  }

  const periods = totalPeriods(draftGoal)
  const principal = draftGoal.amountPerPeriod * periods
  const yieldEstimate = estimateTotalYield(draftGoal)
  const finalTotal = estimateFinalTotal(draftGoal)
  const suggestedAmountPerPeriod = suggestAmountPerPeriod(draftGoal.goalAmount, periods)

  // Modo "meta": prellena el monto por periodo con la sugerencia mientras el usuario no
  // lo haya tocado a mano — en cuanto lo edita, dejamos de pisarlo.
  useEffect(() => {
    if (mode !== 'meta' || amountPerPeriodTouched) return
    setAmountPerPeriod(suggestedAmountPerPeriod > 0 ? Math.round(suggestedAmountPerPeriod * 100) / 100 : '')
  }, [mode, suggestedAmountPerPeriod, amountPerPeriodTouched])

  function handleModeChange(next: Mode) {
    if (next === mode) return
    setMode(next)
    setAmountPerPeriodTouched(false)
  }

  const canSubmit =
    name.trim().length > 0 &&
    typeof durationValue === 'number' &&
    durationValue > 0 &&
    typeof amountPerPeriod === 'number' &&
    amountPerPeriod >= 0 &&
    (mode === 'abierto' ? principal > 0 : typeof goalAmount === 'number' && goalAmount > 0)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      name: name.trim(),
      icon,
      where: where.trim(),
      startDate: initial ? initial.startDate : Date.now(),
      durationValue: Number(durationValue),
      durationUnit,
      frequency,
      amountPerPeriod: Number(amountPerPeriod),
      goalAmount: mode === 'abierto' ? principal : Number(goalAmount),
      hasYield,
      yieldRate: hasYield ? (yieldRate === '' ? null : Number(yieldRate)) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/50 p-4">
      <div>
        <p className="mb-1 text-sm text-black/60">Tipo de ahorro</p>
        <div className="inline-flex rounded-full border border-black/10 bg-white/50 p-1">
          <button
            type="button"
            onClick={() => handleModeChange('abierto')}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold transition ${
              mode === 'abierto' ? 'bg-sage text-black/80' : 'text-black/50 hover:bg-black/5'
            }`}
          >
            Ahorro abierto
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('meta')}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold transition ${
              mode === 'meta' ? 'bg-sky text-black/80' : 'text-black/50 hover:bg-black/5'
            }`}
          >
            Ahorro con meta
          </button>
        </div>
        <p className="mt-1 text-xs text-black/45">
          {mode === 'abierto'
            ? 'Defines cuánto ahorras cada periodo y calculamos el total final.'
            : 'Defines tu meta total y te sugerimos cuánto ahorrar cada periodo.'}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-black/60">
        Nombre del ahorro
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Viaje a Japón"
          className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-black/60">
        Icono
        <div className="flex flex-wrap gap-2">
          {ICON_PALETTE.map((paletteIcon) => (
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
      </div>

      <label className="flex flex-col gap-1 text-sm text-black/60">
        ¿Dónde lo estás ahorrando? (opcional)
        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="Ej. BBVA, Efectivo en casa"
          className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-black/60">
        ¿Cuánto tiempo vas a ahorrar?
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="any"
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej. 6"
            className="w-24 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
          <Dropdown
            value={durationUnit}
            options={DURATION_UNIT_OPTIONS}
            onChange={(v) => setDurationUnit(v as SavingsDurationUnit)}
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm text-black/60">
        ¿Cada cuánto ahorrarás?
        <Dropdown value={frequency} options={FREQUENCY_OPTIONS} onChange={(v) => setFrequency(v as SavingsFrequency)} />
      </div>

      <label className="flex flex-col gap-1 text-sm text-black/60">
        Cuánto ahorrarás cada {periodLabel(frequency)}
        <input
          type="number"
          min="0"
          step="any"
          value={amountPerPeriod}
          onChange={(e) => {
            setAmountPerPeriod(e.target.value === '' ? '' : Number(e.target.value))
            setAmountPerPeriodTouched(true)
          }}
          placeholder="Ej. 100"
          className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
        />
        {mode === 'meta' && (
          <span className="text-xs text-black/45">
            Sugerido: {formatCurrency(suggestedAmountPerPeriod)} cada {periodLabel(frequency)} para llegar a tu meta.
          </span>
        )}
      </label>

      {mode === 'abierto' ? (
        <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/70">
          <span>
            Total final estimado: <span className="font-semibold text-black/80">{formatCurrency(principal)}</span>
          </span>
          {hasYield && (
            <span className="text-xs text-black/45">
              + {formatCurrency(yieldEstimate)} de rendimiento estimado (aparte, no cuenta para tu meta) · con
              rendimiento: {formatCurrency(finalTotal)}
            </span>
          )}
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm text-black/60">
          Meta total
          <input
            type="number"
            min="0"
            step="any"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej. 20000"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm text-black/60">
        <input
          type="checkbox"
          checked={hasYield}
          onChange={(e) => setHasYield(e.target.checked)}
          className="h-4 w-4 rounded border-black/20 accent-sage"
        />
        Es un ahorro con rendimiento (ej. cuenta con intereses)
      </label>

      {hasYield && (
        <label className="flex flex-col gap-1 text-sm text-black/60">
          Tasa de rendimiento anual estimada (%)
          <input
            type="number"
            min="0"
            step="any"
            value={yieldRate}
            onChange={(e) => setYieldRate(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej. 8.5"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
          <span className="text-xs text-black/45">
            Solo se usa para sugerirte el rendimiento cuando registres un depósito — lo llevamos aparte y nunca cuenta
            para tu meta.
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {initial ? 'Guardar cambios' : 'Guardar ahorro'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5">
          Cancelar
        </button>
      </div>
    </form>
  )
}
