import type { ConfidenceLevel } from './config.js'

export interface TicketExtraction {
  monto: number | null
  monto_confianza: ConfidenceLevel
  comercio: string | null
  comercio_confianza: ConfidenceLevel
  fecha: string | null
  fecha_confianza: ConfidenceLevel
  conceptos: string[]
  categoria: string
  categoria_confianza: ConfidenceLevel
}

export interface CategorizeTicketInput {
  /** Texto crudo extraído por el OCR local (etapa 1, siempre offline). */
  ocrText: string
  /** Imagen original en base64, opcional. Solo se reenvía al modelo si el OCR vino muy incompleto. */
  imageBase64?: string
  /** Lista cerrada de categorías de la app — el modelo no puede inventar categorías nuevas. */
  categories: string[]
}

export interface CategorizeTicketResult {
  extraction: TicketExtraction
  modelUsed: string
  escalated: boolean
}
