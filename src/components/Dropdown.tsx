import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from './icons'
import { notifyPopoverClosed, notifyPopoverOpen, useFloatingPosition } from '../lib/popover'

export interface DropdownOption<T extends string> {
  value: T
  label: string
  icon?: string
}

const PANEL_MAX_HEIGHT = 224 // max-h-56

/** Desplegable con panel flotante propio del diseño de la app — reemplaza al select nativo del dispositivo. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Selecciona',
  className = '',
}: {
  value: T | ''
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const closeSelfRef = useRef(() => setOpen(false))
  const position = useFloatingPosition(rootRef, open, PANEL_MAX_HEIGHT)

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

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-left text-black/80"
      >
        <span className={selected ? '' : 'text-black/40'}>
          {selected ? `${selected.icon ? selected.icon + ' ' : ''}${selected.label}` : placeholder}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-black/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open &&
        position &&
        createPortal(
          <ul
            ref={panelRef}
            style={{ position: 'fixed', top: position.top, left: position.left, width: position.triggerWidth }}
            className="z-50 max-h-56 overflow-auto rounded-xl border border-black/10 bg-white shadow-lg"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    o.value === value ? 'bg-sage/30 font-medium text-black/80' : 'text-black/70 hover:bg-black/5'
                  }`}
                >
                  {o.icon && <span aria-hidden>{o.icon}</span>}
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
