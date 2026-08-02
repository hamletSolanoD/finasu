export type ConfidenceLevel = 'alto' | 'medio' | 'bajo'

export interface ModelRouterConfig {
  /** Modelo económico usado como primera pasada para el 100% de los tickets. */
  fastModel: string
  /** Modelo de mayor capacidad usado solo cuando la primera pasada reporta baja confianza. */
  escalationModel: string
  /**
   * Nivel de confianza mínimo aceptable en monto/categoría antes de escalar.
   * Ej. 'alto' significa: escala si el modelo rápido reporta 'medio' o 'bajo'.
   */
  minAcceptableConfidence: ConfidenceLevel
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = { bajo: 0, medio: 1, alto: 2 }

export function isBelowThreshold(level: ConfidenceLevel, threshold: ConfidenceLevel): boolean {
  return CONFIDENCE_ORDER[level] < CONFIDENCE_ORDER[threshold]
}

/**
 * Ningún modelo se hardcodea en el código: todo sale de variables de entorno,
 * con defaults razonables (los modelos vigentes hoy) para que la app funcione
 * sin configuración adicional pero se pueda cambiar sin tocar código.
 */
export function loadModelRouterConfig(): ModelRouterConfig {
  return {
    fastModel: process.env.MODEL_ROUTER_FAST_MODEL || 'claude-haiku-4-5',
    escalationModel: process.env.MODEL_ROUTER_ESCALATION_MODEL || 'claude-sonnet-5',
    minAcceptableConfidence:
      (process.env.MODEL_ROUTER_MIN_CONFIDENCE as ConfidenceLevel | undefined) || 'alto',
  }
}
