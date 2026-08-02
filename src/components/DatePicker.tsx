import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { notifyPopoverClosed, notifyPopoverOpen, useFloatingPosition } from '../lib/popover'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const CALENDAR_WIDTH = 288
const CALENDAR_HEIGHT = 360

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

function formatDisplay(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return ''
  return `${parsed.day} de ${MONTH_LABELS[parsed.month]} de ${parsed.year}`
}

/** Calendario propio del diseño de la app — reemplaza el input type="date" nativo del dispositivo. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecciona una fecha',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseIsoDate(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeSelfRef = useRef(() => setOpen(false))
  const position = useFloatingPosition(rootRef, open, CALENDAR_HEIGHT, CALENDAR_WIDTH)

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  useEffect(() => {
    if (open) notifyPopoverOpen(closeSelfRef.current)
    else notifyPopoverClosed(closeSelfRef.current)
    return () => notifyPopoverClosed(closeSelfRef.current)
  }, [open])

  function openCalendar() {
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
    setOpen((v) => !v)
  }

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={openCalendar}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-left text-black/80"
      >
        <span className={value ? '' : 'text-black/40'}>{value ? formatDisplay(value) : placeholder}</span>
        <span aria-hidden className="text-black/40">
          📅
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: position.top, left: position.left, width: CALENDAR_WIDTH }}
            className="z-50 max-w-[90vw] rounded-xl border border-black/10 bg-white p-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goToPreviousMonth}
                aria-label="Mes anterior"
                className="flex h-7 w-7 items-center justify-center rounded-full text-black/60 hover:bg-black/5"
              >
                ←
              </button>
              <span className="font-display text-sm font-semibold">
                {MONTH_LABELS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Mes siguiente"
                className="flex h-7 w-7 items-center justify-center rounded-full text-black/60 hover:bg-black/5"
              >
                →
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-black/40">
              {WEEKDAY_LABELS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <span key={i} />
                const iso = toIsoDate(viewYear, viewMonth, day)
                const isSelected = iso === value
                const isToday = iso === todayIso
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                      isSelected
                        ? 'bg-sage font-semibold text-black/80'
                        : isToday
                          ? 'border border-sage text-black/70'
                          : 'text-black/70 hover:bg-black/5'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="mt-2 w-full rounded-lg px-3 py-1.5 text-center text-xs font-medium text-black/50 hover:bg-black/5"
              >
                Quitar fecha
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
