import type { PeriodStatus } from '../lib/savingsGoals'

const STATUS_STYLES: Record<PeriodStatus, string> = {
  saved: 'bg-sage border-sage',
  missed: 'bg-red-100 border-red-300',
  pending: 'bg-black/5 border-black/10',
}

/** Cuadritos estilo "días de GitHub": uno por periodo, mostrando si se ahorró, se perdió, o está pendiente. */
export function ContributionGrid({
  statuses,
  labels,
  onSquareClick,
}: {
  statuses: PeriodStatus[]
  labels?: string[]
  onSquareClick?: (index: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((status, i) => {
        const clickable = Boolean(onSquareClick) && status !== 'saved'
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={() => onSquareClick?.(i)}
            title={labels?.[i]}
            className={`h-4 w-4 rounded-sm border transition ${STATUS_STYLES[status]} ${
              clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
            }`}
          />
        )
      })}
    </div>
  )
}
