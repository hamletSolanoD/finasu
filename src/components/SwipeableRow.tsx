import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { PencilIcon, TrashIcon } from './icons'

const ACTION_WIDTH_BOTH = 104
const ACTION_WIDTH_DELETE_ONLY = 56

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, input, a, select, textarea, label'))
}

/**
 * Fila que revela acciones de editar/eliminar al deslizar hacia la izquierda
 * o al tocarla — como una lista de reproducción de YouTube. onEdit es
 * opcional: si no se pasa, solo se revela el botón de eliminar.
 */
export function SwipeableRow({
  children,
  onEdit,
  onDelete,
}: {
  children: ReactNode
  onEdit?: () => void
  onDelete: () => void
}) {
  const ACTION_WIDTH = onEdit ? ACTION_WIDTH_BOTH : ACTION_WIDTH_DELETE_ONLY
  const [open, setOpen] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const dragState = useRef<{ startX: number; moved: boolean; startedOnInteractive: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const wheelAccumRef = useRef(0)
  const wheelResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // En una laptop, "deslizar" con el trackpad genera eventos wheel (deltaX), no
  // pointer/touch — sin esto, el gesto no hace nada en Mac/Windows con trackpad.
  // El signo de deltaX depende de si "scroll natural" está activado, así que en
  // vez de mapear dirección exacta (revela/cierra), cualquier gesto horizontal
  // decidido simplemente alterna abierto/cerrado.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    function handleWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      wheelAccumRef.current += e.deltaX
      if (wheelResetTimer.current) clearTimeout(wheelResetTimer.current)
      wheelResetTimer.current = setTimeout(() => {
        wheelAccumRef.current = 0
      }, 400)
      if (Math.abs(wheelAccumRef.current) > 40) {
        setOpen((v) => !v)
        wheelAccumRef.current = 0
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  function handlePointerDown(e: PointerEvent) {
    dragState.current = { startX: e.clientX, moved: false, startedOnInteractive: isInteractive(e.target) }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragState.current) return
    const delta = e.clientX - dragState.current.startX
    if (Math.abs(delta) > 4) dragState.current.moved = true
    setDragOffset(delta)
  }

  function handlePointerUp() {
    if (!dragState.current) return
    const { moved, startedOnInteractive } = dragState.current
    if (moved) {
      const base = open ? -ACTION_WIDTH : 0
      const finalX = Math.min(0, Math.max(-ACTION_WIDTH, base + dragOffset))
      setOpen(finalX < -ACTION_WIDTH / 2)
      // Un enlace (ej. fila de ticket) no siempre suprime su click nativo tras un
      // arrastre — lo forzamos a mano para que arrastrar nunca también navegue.
      suppressClickRef.current = true
    } else if (!startedOnInteractive) {
      // Un tap sobre un botón/input propio del contenido (cuadro del grid, "Registrar
      // ahorro", etc.) no debe también abrir el panel de editar/eliminar.
      setOpen((v) => !v)
    }
    setDragOffset(0)
    dragState.current = null
  }

  function handleClickCapture(e: MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
      suppressClickRef.current = false
    }
  }

  const isDragging = dragState.current?.moved
  const base = open ? -ACTION_WIDTH : 0
  const x = isDragging ? Math.min(0, Math.max(-ACTION_WIDTH, base + dragOffset)) : base

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        {onEdit && (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit()
            }}
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-sky/70 text-black/70"
          >
            <PencilIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Editar</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onDelete()
          }}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-red-500 text-white"
        >
          <TrashIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">Eliminar</span>
        </button>
      </div>
      <div
        ref={contentRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={handleClickCapture}
        className={`relative bg-cream ${isDragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${x}px)`, touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  )
}
