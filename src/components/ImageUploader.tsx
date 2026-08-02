import { useRef } from 'react'
import { fileToResizedDataUrl } from '../lib/image'

export function ImageUploader({
  value,
  onChange,
}: {
  value?: string
  onChange: (dataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const dataUrl = await fileToResizedDataUrl(file)
    onChange(dataUrl)
    // Aquí, cuando incorporemos IA/OCR, leeríamos `dataUrl` para
    // pre-llenar nombre, precio y cantidad automáticamente.
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/60 text-black/40 transition hover:border-black/35 hover:text-black/60"
      >
        {value ? (
          <img src={value} alt="Producto" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs font-medium">Agregar foto</span>
        )}
      </button>
      <div className="flex flex-col gap-1 text-sm text-black/60">
        <p>Toma una foto del producto o sube una imagen.</p>
        <p className="text-xs text-black/40">
          Por ahora los datos se ingresan a mano; el escaneo automático llegará después.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
