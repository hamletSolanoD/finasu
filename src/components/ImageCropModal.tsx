import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useModalBack } from '../lib/useModalBack'

/** Tamaño (en px de CSS) de la ventana cuadrada de recorte que se ve en pantalla. */
const VIEWPORT_SIZE = 280
/** Resolución final del cuadrado exportado — de sobra para una miniatura de producto. */
const OUTPUT_SIZE = 640
const MAX_ZOOM = 3

interface Offset {
  x: number
  y: number
}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(-max, value))
}

/**
 * Recorte simple de imagen: arrastra para posicionar, desliza para acercar,
 * siempre un cuadrado — no hay filtros ni texto a propósito, la idea es que
 * sea lo mínimo indispensable para encuadrar bien una foto de producto.
 */
export function ImageCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const dragState = useRef<{ startX: number; startY: number; startOffset: Offset } | null>(null)

  useModalBack(true, onCancel)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    image.src = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!img) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
        <p className="text-sm text-white/80">Cargando imagen…</p>
      </div>
    )
  }

  // Escala mínima para que la imagen cubra siempre toda la ventana de recorte
  // (nunca se ve espacio vacío), multiplicada por el zoom que elige el usuario.
  const baseScale = VIEWPORT_SIZE / Math.min(img.width, img.height)
  const scale = baseScale * zoom
  const displayWidth = img.width * scale
  const displayHeight = img.height * scale
  const maxOffsetX = Math.max(0, (displayWidth - VIEWPORT_SIZE) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - VIEWPORT_SIZE) / 2)

  function handlePointerDown(e: ReactPointerEvent) {
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragState.current) return
    const { startX, startY, startOffset } = dragState.current
    setOffset({
      x: clamp(startOffset.x + (e.clientX - startX), maxOffsetX),
      y: clamp(startOffset.y + (e.clientY - startY), maxOffsetY),
    })
  }

  function handlePointerUp() {
    dragState.current = null
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom)
    const nextScale = baseScale * nextZoom
    const nextMaxX = Math.max(0, (img!.width * nextScale - VIEWPORT_SIZE) / 2)
    const nextMaxY = Math.max(0, (img!.height * nextScale - VIEWPORT_SIZE) / 2)
    setOffset((prev) => ({ x: clamp(prev.x, nextMaxX), y: clamp(prev.y, nextMaxY) }))
  }

  function handleConfirm() {
    // El punto de la imagen NATURAL que hoy cae justo al centro de la
    // ventana, dado el pan y zoom actuales — de ahí se arma el cuadrado
    // fuente a recortar (en px de la imagen original, no de pantalla).
    const centerX = img!.width / 2 - offset.x / scale
    const centerY = img!.height / 2 - offset.y / scale
    const sourceSize = VIEWPORT_SIZE / scale

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      img!,
      centerX - sourceSize / 2,
      centerY - sourceSize / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )
    onConfirm(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-black/80 p-4">
      <p className="text-sm font-medium text-white/80">Encuadra la foto</p>

      <div
        className="relative overflow-hidden rounded-2xl ring-2 ring-white/70"
        style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: displayWidth,
            height: displayHeight,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>

      <label className="flex w-full max-w-xs items-center gap-3 text-white/70">
        <span aria-hidden className="text-sm">
          🔍
        </span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          className="w-full accent-sage"
          aria-label="Acercar"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          Recortar y guardar
        </button>
      </div>
    </div>
  )
}
