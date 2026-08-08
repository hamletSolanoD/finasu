import { createWorker, PSM } from 'tesseract.js'

let workerPromise: ReturnType<typeof createWorker> | null = null

/** Un solo worker compartido: evita re-descargar el paquete de idioma en cada escaneo.
 * Se configura una vez con PSM 4 (columna de texto de ancho variable — el layout
 * típico de un ticket) y conservando espacios entre palabras, que ayudan al parser. */
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('spa')
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
        preserve_interword_spaces: '1',
      })
      return worker
    })()
  }
  return workerPromise
}

export interface OcrResult {
  text: string
  confidence: number
}

/** Lado mayor mínimo que le damos a Tesseract: con más resolución de texto reconoce
 * mejor las letras chicas de los tickets. */
const OCR_MIN_LONGEST_SIDE = 1600

/** Preprocesa la foto antes del OCR: escala a resolución útil, pasa a escala de
 * grises (pesos luma) y estira el contraste recortando a los percentiles 1–99 del
 * histograma. Eso compensa fotos con sombra o poca luz — la causa más común de OCR
 * malo. A propósito NO se binariza con umbral fijo: con sombras parciales eso
 * destruye texto; el estiramiento de contraste es más seguro. La imagen original
 * (a color) es la que se guarda y se le muestra al usuario; esto es solo para el
 * paso de reconocimiento de texto. */
function preprocessForOcr(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        // (a) Escala: si el lado mayor es menor a 1600px, subimos a 1600.
        const longest = Math.max(img.width, img.height)
        if (longest === 0) {
          reject(new Error('Imagen vacía para OCR'))
          return
        }
        const scale = longest < OCR_MIN_LONGEST_SIDE ? OCR_MIN_LONGEST_SIDE / longest : 1
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen para OCR'))
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const px = imageData.data
        const totalPixels = width * height

        // (b) Escala de grises con pesos luma + histograma en una sola pasada.
        // El gris se guarda temporalmente en el canal R.
        const hist = new Uint32Array(256)
        for (let i = 0; i < px.length; i += 4) {
          const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
          px[i] = gray
          hist[gray]++
        }

        // (c) Estiramiento de contraste: recorte a percentil 1 y 99.
        const clip = totalPixels * 0.01
        let lo = 0
        for (let v = 0, acc = 0; v < 256; v++) {
          acc += hist[v]
          if (acc >= clip) {
            lo = v
            break
          }
        }
        let hi = 255
        for (let v = 255, acc = 0; v >= 0; v--) {
          acc += hist[v]
          if (acc >= clip) {
            hi = v
            break
          }
        }
        if (hi <= lo) {
          // Imagen casi plana (una sola tonalidad): no hay contraste que estirar.
          lo = 0
          hi = 255
        }

        // Tabla de mapeo lineal a 0–255 (Uint8ClampedArray recorta solo los extremos).
        const range = hi - lo
        const lut = new Uint8ClampedArray(256)
        for (let v = 0; v < 256; v++) {
          lut[v] = Math.round(((v - lo) / range) * 255)
        }
        for (let i = 0; i < px.length; i += 4) {
          const g = lut[px[i]]
          px[i] = g
          px[i + 1] = g
          px[i + 2] = g
        }
        ctx.putImageData(imageData, 0, 0)

        // (d) PNG, no JPEG: sin artefactos de compresión alrededor del texto.
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('No se pudo procesar la imagen para OCR'))
      }
    }
    img.onerror = () => reject(new Error('No se pudo leer la imagen para OCR'))
    img.src = dataUrl
  })
}

/** Extrae texto crudo de una foto de ticket. Corre 100% local (WASM), sin conexión,
 * una vez que el paquete de idioma quedó descargado la primera vez. */
export async function extractTextFromImage(dataUrl: string): Promise<OcrResult> {
  let input = dataUrl
  try {
    input = await preprocessForOcr(dataUrl)
  } catch {
    // Si el preprocesado falla por lo que sea, seguimos con la foto original:
    // el escaneo nunca se debe romper por este paso.
  }
  const worker = await getWorker()
  const { data } = await worker.recognize(input)
  return { text: data.text.trim(), confidence: data.confidence }
}
