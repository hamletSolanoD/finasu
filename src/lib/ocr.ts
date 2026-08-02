import { createWorker } from 'tesseract.js'

let workerPromise: ReturnType<typeof createWorker> | null = null

/** Un solo worker compartido: evita re-descargar el paquete de idioma en cada escaneo. */
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('spa')
  }
  return workerPromise
}

export interface OcrResult {
  text: string
  confidence: number
}

/** Aumenta contraste y pasa a escala de grises antes del OCR — ayuda en tickets
 * arrugados, papel térmico desteñido o fotos con poca luz. La imagen original
 * (a color) es la que se guarda y se le muestra al usuario; esto es solo para
 * el paso de reconocimiento de texto. */
function enhanceForOcr(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen para OCR'))
        return
      }
      ctx.filter = 'grayscale(1) contrast(1.4) brightness(1.05)'
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => reject(new Error('No se pudo leer la imagen para OCR'))
    img.src = dataUrl
  })
}

/** Extrae texto crudo de una foto de ticket. Corre 100% local (WASM), sin conexión,
 * una vez que el paquete de idioma quedó descargado la primera vez. */
export async function extractTextFromImage(dataUrl: string): Promise<OcrResult> {
  const enhanced = await enhanceForOcr(dataUrl)
  const worker = await getWorker()
  const { data } = await worker.recognize(enhanced)
  return { text: data.text.trim(), confidence: data.confidence }
}
