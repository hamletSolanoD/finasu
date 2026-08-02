import { useEffect, useState } from 'react'

export function InlineNumberField({
  value,
  onCommit,
  placeholder = '0',
  suffix,
  className = 'w-24',
}: {
  value: number | null
  onCommit: (value: number | null) => void
  placeholder?: string
  suffix?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  function handleBlur() {
    const parsed = draft.trim() === '' ? null : Number(draft)
    const clean = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    onCommit(clean)
    setDraft(clean === null ? '' : String(clean))
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`rounded-lg border border-black/15 bg-white/70 px-2 py-1 text-right text-sm text-black/80 ${className}`}
      />
      {suffix && <span className="text-sm text-black/50">{suffix}</span>}
    </span>
  )
}
