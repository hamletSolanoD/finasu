import { useRef, useState } from 'react'
import { ImageCropModal } from './ImageCropModal'

export function ImageUploader({
  value,
  onChange,
}: {
  value?: string
  onChange: (dataUrl: string) => void
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    setPendingFile(file)
  }

  function handleCropConfirm(dataUrl: string) {
    setPendingFile(null)
    onChange(dataUrl)
    // Aquí, cuando incorporemos IA/OCR, leeríamos `dataUrl` para
    // pre-llenar nombre, precio y cantidad automáticamente.
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/60">
        {value && <img src={value} alt="Producto" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-col items-start gap-2 text-sm text-black/60">
        <p>Toma una foto del producto o elige una de tu galería.</p>
        <p className="text-xs text-black/40">
          Por ahora los datos se ingresan a mano; el escaneo automático llegará después.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95"
          >
            📷 Tomar foto
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="rounded-full border border-black/15 bg-white/60 px-4 py-1.5 text-sm font-medium text-black/70 transition hover:bg-black/5"
          >
            Elegir de galería
          </button>
        </div>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {pendingFile && (
        <ImageCropModal file={pendingFile} onCancel={() => setPendingFile(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  )
}
