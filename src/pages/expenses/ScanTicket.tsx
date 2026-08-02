import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_CURRENCY } from '../../lib/currency'
import { db } from '../../lib/db'
import { fileToResizedDataUrl } from '../../lib/image'
import { extractTextFromImage } from '../../lib/ocr'
import { extractMerchantName, parseTicketDate, parseTicketLines } from '../../lib/ticketParser'

type ItemStatus = 'procesando' | 'guardado' | 'requiere_revision'

interface CapturedItem {
  id: string
  label: string
  status: ItemStatus
  productCount?: number
}

/** Fotos con muy poco texto legible probablemente fallaron el OCR (arrugado, borroso, mal iluminado). */
const MIN_USABLE_OCR_LENGTH = 8

function ScanTicket() {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<CapturedItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setIsProcessing(true)

    const fileArray = Array.from(files)
    const initialItems: CapturedItem[] = fileArray.map((_file, i) => ({
      id: crypto.randomUUID(),
      label: fileArray.length > 1 ? `Ticket ${i + 1}` : 'Ticket',
      status: 'procesando',
    }))
    setItems((prev) => [...initialItems, ...prev])

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const item = initialItems[i]

      let image: string | undefined
      let ocrText = ''
      try {
        image = await fileToResizedDataUrl(file, 1600, 0.85)
        const result = await extractTextFromImage(image)
        ocrText = result.text
      } catch {
        // Si el OCR falla, igual guardamos el ticket (con la imagen si se alcanzó a leer)
        // para no perderlo — se marca para revisión.
      }

      const status = ocrText.trim().length >= MIN_USABLE_OCR_LENGTH ? 'pendiente_de_categorizar' : 'requiere_revision'
      const parsedItems = status === 'pendiente_de_categorizar' ? parseTicketLines(ocrText) : []
      const capturedAt = Date.now()
      const fecha = parseTicketDate(ocrText) ?? new Date(capturedAt).toISOString().slice(0, 10)
      const merchant = extractMerchantName(ocrText)

      await db.expenses.add({
        id: item.id,
        image,
        ocrText,
        status,
        fecha,
        capturedAt,
        currency: DEFAULT_CURRENCY,
        merchant,
      })
      if (parsedItems.length > 0) {
        await db.expenseItems.bulkAdd(
          parsedItems.map((p, index) => ({
            id: crypto.randomUUID(),
            expenseId: item.id,
            nombre: p.nombre,
            monto: p.monto,
            categoryId: null,
            order: index,
          })),
        )
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: status === 'requiere_revision' ? 'requiere_revision' : 'guardado',
                productCount: parsedItems.length,
              }
            : it,
        ),
      )
    }

    setIsProcessing(false)
  }

  const reviewCount = items.filter((i) => i.status === 'requiere_revision').length
  const allDone = items.length > 0 && !isProcessing

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🧾 Gastos</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">📷 Escanear ticket</h1>
      <p className="mt-2 text-black/60">
        Toma la foto o elige varias de tu galería. El texto se lee en tu teléfono, sin internet — puedes tirar el
        ticket en cuanto veas la confirmación.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          📷 Tomar foto
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="rounded-full border border-black/15 bg-white/60 px-5 py-2.5 font-display font-semibold text-black/70 transition hover:bg-black/5"
        >
          Elegir de galería (varias)
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-8 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white/60 px-4 py-3"
            >
              <span className="font-medium">{item.label}</span>
              {item.status === 'procesando' && <span className="text-sm text-black/40">Leyendo…</span>}
              {item.status === 'guardado' && (
                <span className="flex items-center gap-1 text-sm font-medium text-black/70">
                  <span aria-hidden>✓</span> Guardado
                  {typeof item.productCount === 'number' && ` · ${item.productCount} productos detectados`}
                </span>
              )}
              {item.status === 'requiere_revision' && (
                <span className="text-sm font-medium text-amber-700">Requiere revisión</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {allDone && (
        <div className="mt-6 rounded-2xl border border-sage bg-sage/20 p-4">
          <p className="font-display font-semibold">
            {items.length} {items.length === 1 ? 'ticket capturado' : 'tickets capturados'}
            {reviewCount > 0 && ` (${reviewCount} necesitan revisión)`}. Revisa los productos detectados y ponles
            categoría.
          </p>
          <Link to="/gastos" className="mt-2 inline-block text-sm font-medium underline">
            Ver mis gastos →
          </Link>
        </div>
      )}
    </div>
  )
}

export default ScanTicket
