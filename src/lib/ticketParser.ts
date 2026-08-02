export interface ParsedItem {
  nombre: string
  monto: number
}

/** Líneas que casi seguro son metadata del ticket, no un producto. */
const SKIP_KEYWORDS = [
  'TOTAL',
  'SUBTOTAL',
  'CAMBIO',
  'EFECTIVO',
  'IVA',
  'GRACIAS',
  'FECHA',
  'HORA',
  'TICKET',
  'FOLIO',
  'RFC',
  'ATENCION',
  'TARJETA',
  'PAGO',
  'IMPORTE',
  'CAJA',
  'SUCURSAL',
  'ARTICULOS',
  'CLIENTE',
  'DESCUENTO',
  'PROMOCION',
  'AHORRO',
  'BONIFICACION',
  'DEVOLUCION',
  'REDONDEO',
  'AUTORIZACION',
  'APROBADO',
  'TERMINAL',
  'REFERENCIA',
  'OPERACION',
  'NO. TRANS',
  'NUM. TRANS',
  'VALES',
  'MONEDERO',
  'PUNTOS',
  'BASE',
  'CUOTA',
]

/**
 * Un precio al final de la línea. Dos formas:
 * 1. Con "$" antes — el OCR a veces confunde el punto decimal con ":", así que
 *    con "$" de por medio aceptamos "." "," o ":" como separador (ej. "$5:50").
 * 2. Sin "$" — solo "." o "," como separador (nunca ":", para no confundir un
 *    precio con una hora como "16:02"), opcionalmente seguido de un símbolo de
 *    moneda como "€" (ej. "2,50 €", formato de tickets españoles).
 */
const PRICE_AT_END = /(?:\$\s*(\d{1,6}[.,:]\d{2})|(\d{1,6}[.,]\d{2})\s*(?:€|EUR|MXN|USD|\$)?)\s*$/i

/**
 * Respaldo para cuando el OCR se come la coma decimal (ej. "2,40 €" leído
 * como "240€"): un número de 3 dígitos pegado directo a la moneda, sin
 * espacio ni separador, probablemente son los últimos 2 dígitos los
 * centavos. Solo se usa si PRICE_AT_END no encontró nada — evitar de más
 * confundir un total entero real con un decimal roto.
 */
const PRICE_NO_SEPARATOR = /(\d{3})\s*(?:€|EUR)\s*$/i

/** Código de barras u otra clave larga al inicio de la línea, antes del nombre real. */
const LEADING_SKU = /^\d{5,}\s+/

/** Cantidad suelta al inicio ("2 COCA COLA...", "1,00 Agua..."), no forma parte del nombre. */
const LEADING_QTY = /^\d{1,3}(?:[.,]\d{1,2})?\s+(?=\S)/

/**
 * Descarta todo lo que casi seguro no es un producto (totales, fechas, medios
 * de pago, etc.) y regresa solo las líneas que sí parecen tener un precio al
 * lado — listas para parsear a mano (parseTicketLines) o, más adelante, para
 * mandarse tal cual a un modelo de IA sin gastar tokens en el resto del ticket.
 */
export function extractProductCandidateLines(ocrText: string): string[] {
  return ocrText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !SKIP_KEYWORDS.some((keyword) => line.toUpperCase().includes(keyword)))
    // Desgloses de IVA/descuento ("10,00%: Base: 65,82 € Cuota: 6,58 €") casi
    // nunca son un producto — un producto real casi nunca lleva un "%" en la línea.
    .filter((line) => !line.includes('%'))
    .filter((line) => PRICE_AT_END.test(line) || PRICE_NO_SEPARATOR.test(line))
}

/**
 * Heurística simple (sin IA): separa el texto crudo del OCR en posibles
 * productos con su precio, para no tener que capturarlos a mano uno por uno.
 * No es perfecta — el usuario siempre puede corregir, agregar o quitar líneas.
 */
export function parseTicketLines(ocrText: string): ParsedItem[] {
  const items: ParsedItem[] = []

  for (const line of extractProductCandidateLines(ocrText)) {
    const match = line.match(PRICE_AT_END)
    let monto: number
    let matchIndex: number

    if (match && match.index !== undefined) {
      const raw = match[1] ?? match[2]
      monto = Number(raw.replace(',', '.').replace(':', '.'))
      matchIndex = match.index
    } else {
      const fallback = line.match(PRICE_NO_SEPARATOR)
      if (!fallback || fallback.index === undefined) continue
      monto = Number(fallback[1]) / 100
      matchIndex = fallback.index
    }

    if (!Number.isFinite(monto) || monto < 0) continue

    let nombre = line.slice(0, matchIndex).trim()
    nombre = nombre.replace(LEADING_SKU, '').replace(LEADING_QTY, '').trim()
    if (nombre.length < 2) continue

    items.push({ nombre, monto })
  }

  return items
}

/** DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY... — el formato que usan casi todos los tickets mexicanos. */
const DATE_PATTERN = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/

/**
 * Busca una fecha dentro del texto del ticket. Si no encuentra ninguna (o no
 * es una fecha real), regresa null y quien llame decide el respaldo — por
 * ejemplo, la fecha en que se escaneó.
 */
export function parseTicketDate(ocrText: string): string | null {
  const match = ocrText.match(DATE_PATTERN)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  let year = Number(match[3])
  if (year < 100) year += 2000

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year < 2000 || year > 2100) return null

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  // Descarta fechas imposibles (ej. 31 de febrero) validando que sobrevivan un round-trip.
  const asDate = new Date(`${iso}T00:00:00`)
  if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() + 1 !== month || asDate.getUTCDate() !== day) {
    return null
  }

  return iso
}

/** Líneas de encabezado que casi nunca son el nombre del establecimiento. */
const MERCHANT_SKIP_PATTERN =
  /^(CIF|RFC|NIF|TEL|FAX|WWW|HTTP|FACTURA|C\/|CALLE|AV\.|AVENIDA)\b|^\d+$/i

/**
 * El nombre del establecimiento casi siempre es de las primeras líneas del
 * ticket, antes de datos fiscales (CIF/RFC), dirección o teléfono. Heurística
 * simple: la primera línea "razonable" (ni vacía, ni un dato fiscal/dirección,
 * ni puramente numérica) de las primeras líneas del texto leído.
 */
export function extractMerchantName(ocrText: string): string | null {
  const lines = ocrText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)

  for (const line of lines) {
    if (line.length < 3) continue
    if (MERCHANT_SKIP_PATTERN.test(line)) continue
    if (DATE_PATTERN.test(line)) continue
    return line
  }

  return null
}
