import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { isBelowThreshold, loadModelRouterConfig } from './config.js'
import { buildCategorizationSystemPrompt, buildCategorizationUserPrompt } from './prompts.js'
import type { CategorizeTicketInput, CategorizeTicketResult, TicketExtraction } from './types.js'

const client = new Anthropic()

const CONFIDENCE = z.enum(['alto', 'medio', 'bajo'])

function buildExtractionSchema(categories: string[]) {
  const closedCategories = categories.includes('Otros') ? categories : [...categories, 'Otros']
  return z.object({
    monto: z.number().nullable(),
    monto_confianza: CONFIDENCE,
    comercio: z.string().nullable(),
    comercio_confianza: CONFIDENCE,
    fecha: z.string().nullable(),
    fecha_confianza: CONFIDENCE,
    conceptos: z.array(z.string()),
    categoria: z.enum(closedCategories as [string, ...string[]]),
    categoria_confianza: CONFIDENCE,
  })
}

/** Reenviar la imagen solo cuesta la pena cuando el OCR vino tan corto que probablemente esté incompleto. */
function ocrIsWeak(ocrText: string): boolean {
  return ocrText.trim().length < 20
}

async function callModel(
  model: string,
  input: CategorizeTicketInput,
): Promise<TicketExtraction> {
  const schema = buildExtractionSchema(input.categories)
  const includeImage = Boolean(input.imageBase64) && ocrIsWeak(input.ocrText)

  const content: Anthropic.Messages.ContentBlockParam[] = []
  if (includeImage && input.imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 },
    })
  }
  content.push({ type: 'text', text: buildCategorizationUserPrompt(input.ocrText) })

  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    system: buildCategorizationSystemPrompt(input.categories),
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(schema) },
  })

  if (!response.parsed_output) {
    throw new Error(`El modelo ${model} no devolvió una extracción válida.`)
  }
  return response.parsed_output
}

function needsEscalation(extraction: TicketExtraction, minConfidence: ReturnType<typeof loadModelRouterConfig>['minAcceptableConfidence']): boolean {
  return (
    isBelowThreshold(extraction.monto_confianza, minConfidence) ||
    isBelowThreshold(extraction.categoria_confianza, minConfidence)
  )
}

/**
 * Capa de routing de modelos: decide qué modelo procesa cada ticket.
 * Ningún ID de modelo vive hardcodeado aquí — ver config.ts. Cambiar de modelo
 * (por una versión nueva, o eventualmente un proveedor distinto) no requiere
 * tocar esta lógica, solo la variable de entorno correspondiente.
 */
export async function categorizeTicket(input: CategorizeTicketInput): Promise<CategorizeTicketResult> {
  const config = loadModelRouterConfig()

  const fastResult = await callModel(config.fastModel, input)
  if (!needsEscalation(fastResult, config.minAcceptableConfidence)) {
    return { extraction: fastResult, modelUsed: config.fastModel, escalated: false }
  }

  const escalatedResult = await callModel(config.escalationModel, input)
  return { extraction: escalatedResult, modelUsed: config.escalationModel, escalated: true }
}
