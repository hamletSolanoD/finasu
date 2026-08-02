import { Dropdown } from './Dropdown'
import type { Unit, UnitKind } from '../lib/types'
import { UNITS_BY_KIND, UNIT_KINDS } from '../lib/units'

export function QuantityInput({
  unitKind,
  amount,
  unit,
  onUnitKindChange,
  onAmountChange,
  onUnitChange,
}: {
  unitKind: UnitKind
  amount: number | ''
  unit: Unit
  onUnitKindChange: (kind: UnitKind) => void
  onAmountChange: (amount: number | '') => void
  onUnitChange: (unit: Unit) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="col-span-3 flex flex-col gap-1 text-sm text-black/60 sm:col-span-1">
        Tipo
        <Dropdown value={unitKind} options={UNIT_KINDS} onChange={onUnitKindChange} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-black/60">
        Cantidad
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          placeholder="Ej. 500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-black/60">
        Unidad
        <Dropdown value={unit} options={UNITS_BY_KIND[unitKind]} onChange={onUnitChange} />
      </label>
    </div>
  )
}
