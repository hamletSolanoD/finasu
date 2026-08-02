import { useEffect, useState } from 'react'

interface Step {
  icon: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: '🏠',
    title: 'Bienvenido a Finasu',
    body: 'Aquí tienes acceso rápido a cada sección y un resumen de cómo vas este mes. El buscador de arriba (✨) contesta con tus datos reales — la IA completa todavía no existe, así que por ahora responde preguntas simples como "¿cuánto he gastado?".',
  },
  {
    icon: '🏷️',
    title: 'Categorías y límites',
    body: 'Aquí declaras tu ingreso del mes y el límite de cada categoría — se hace una sola vez al mes y queda fijo. Empieza por aquí para que Finasu sepa cuánto tienes disponible. La "Sugerencia de la IA" que verás ahí es un aviso de que esa función llega más adelante — todavía no da recomendaciones reales.',
  },
  {
    icon: '📷',
    title: 'Escanea tus tickets',
    body: 'Toma una foto del ticket y Finasu lee los productos por OCR — tú solo revisas y le pones categoría a cada uno. Cada producto categorizado descuenta del límite que pusiste en el paso anterior.',
  },
  {
    icon: '🛒',
    title: 'Productos frecuentes y tiendas',
    body: 'Guarda los productos que compras casi siempre y anota su precio en cada tienda donde los has visto. Así comparas antes de comprar y sabes dónde te conviene más.',
  },
  {
    icon: '💰',
    title: 'Ahorro',
    body: 'Crea metas de ahorro con un monto fijo por periodo (semanal, quincenal o mensual) y ve marcando lo que ahorras. También puedes anotar gastos futuros grandes — visa, coche — para irlos apartando poco a poco.',
  },
  {
    icon: '🛠️',
    title: 'Proyectos',
    body: 'Para gastos con presupuesto propio, aparte de tu gasto mensual normal — como pintar la casa. Agrega los materiales que necesitas, compara precios entre tiendas y marca lo que ya compraste.',
  },
  {
    icon: '📊',
    title: 'Resumen',
    body: 'El balance del mes: cuánto ganaste, cuánto gastaste por categoría y cómo se compara con meses anteriores. Bueno para revisar antes de que empiece un mes nuevo.',
  },
]

interface OnboardingTourProps {
  open: boolean
  onClose: () => void
}

/** Modal de bienvenida que explica cada sección — se muestra solo una vez (ver AppSettings.hasSeenOnboarding) y se puede volver a abrir desde el menú ("Ver tour"). */
export function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <span className="text-3xl" aria-hidden>
            {current.icon}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tour"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-black/40 transition hover:bg-black/5 hover:text-black/70"
          >
            ✕
          </button>
        </div>

        <h2 className="mt-3 font-display text-xl font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-black/65">{current.body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              aria-hidden
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-sage' : 'w-1.5 bg-black/15'
              }`}
            />
          ))}
        </div>
        <p className="mt-1 text-center text-xs text-black/40">
          Paso {step + 1} de {STEPS.length}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-black/45 underline hover:text-black/65"
          >
            Saltar tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full border border-black/15 bg-white/60 px-4 py-2 text-sm font-medium text-black/60 transition hover:bg-black/5"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
              className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
            >
              {isLast ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
