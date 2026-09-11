import { useLayoutEffect, useRef, type ChangeEvent, type FocusEvent } from 'react'

function countDigits(s: string): number {
  let n = 0
  for (const ch of s) if (ch >= '0' && ch <= '9') n++
  return n
}

function sanitizeRaw(value: string): string {
  let seenDot = false
  let out = ''
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') out += ch
    else if (ch === '.' && !seenDot) {
      out += ch
      seenDot = true
    }
  }
  return out
}

function formatMoneyDisplay(raw: string): string {
  if (raw === '') return ''
  const dotIndex = raw.indexOf('.')
  const intPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex)
  const decPart = dotIndex === -1 ? undefined : raw.slice(dotIndex + 1)
  const intFormatted = intPart === '' ? '' : Number(intPart).toLocaleString('es-MX')
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted
}

/**
 * Input de montos: mientras se escribe, se ve formateado con comas de miles
 * (mismo motivo que formatCurrency) — así un error como 480000 en vez de
 * 48000 salta a la vista de inmediato en vez de perderse entre puros
 * dígitos. `value`/`onChange` siguen siendo el número crudo sin comas
 * (igual que un input type="number" normal); el formateo es solo visual.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  onFocus,
  id,
}: {
  value: string
  onChange: (raw: string) => void
  className?: string
  placeholder?: string
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  id?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCursorDigits = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (pendingCursorDigits.current === null || !inputRef.current) return
    const formatted = formatMoneyDisplay(value)
    let seen = 0
    let pos = formatted.length
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] >= '0' && formatted[i] <= '9') seen++
      if (seen === pendingCursorDigits.current) {
        pos = i + 1
        break
      }
    }
    inputRef.current.setSelectionRange(pos, pos)
    pendingCursorDigits.current = null
  }, [value])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const cursor = e.target.selectionStart ?? e.target.value.length
    pendingCursorDigits.current = countDigits(e.target.value.slice(0, cursor))
    onChange(sanitizeRaw(e.target.value))
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      value={formatMoneyDisplay(value)}
      onChange={handleChange}
      onFocus={onFocus}
      placeholder={placeholder}
      className={className}
    />
  )
}
