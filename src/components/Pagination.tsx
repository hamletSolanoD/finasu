export const PAGE_SIZE = 10

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-full border border-black/15 px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ← Anterior
      </button>
      <span className="text-sm text-black/50">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-full border border-black/15 px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Siguiente →
      </button>
    </div>
  )
}
