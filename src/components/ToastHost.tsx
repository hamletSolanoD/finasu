import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { computeReminders, reminderTargetMonthKey, type Reminder } from '../lib/notifications'

const TOASTED_KEY = 'finasu-toasted-reminders'

/** Keys de reminders que ya se asomaron como toast — con try/catch por si localStorage no está (modo privado). */
function readToasted(): string[] {
  try {
    const raw = localStorage.getItem(TOASTED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function markToasted(key: string): void {
  try {
    localStorage.setItem(TOASTED_KEY, JSON.stringify([...readToasted(), key]))
  } catch {
    // Sin localStorage el toast se volvería a mostrar en la próxima sesión — no pasa nada grave.
  }
}

/**
 * Toast estilo Messenger para recordatorios NUEVOS: cuando aparece un reminder
 * cuya key nunca se ha mostrado, se asoma un momento arriba (esté donde esté
 * el usuario, porque vive en Layout) y se va solo a los 5 segundos. Tocarlo
 * lleva a su ruta. Máximo uno a la vez — si hay varios nuevos, salen en fila.
 */
export function ToastHost() {
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const [toast, setToast] = useState<Reminder | null>(null)
  const [entered, setEntered] = useState(false)
  const navigate = useNavigate()

  const monthKey = reminderTargetMonthKey()
  const reminders =
    categories && limits && incomes ? computeReminders(categories, limits, incomes, monthKey) : []
  const reminderKeys = reminders.map((r) => r.key).join('|')

  // Cola simple: sin toast activo, toma el primer reminder aún no mostrado y márcalo.
  useEffect(() => {
    if (toast) return
    if (!reminderKeys) return
    const shown = readToasted()
    const next = reminders.find((r) => !shown.includes(r.key))
    if (!next) return
    markToasted(next.key)
    setToast(next)
    // deps: reminders es un array nuevo en cada render — reminderKeys captura su contenido real.
  }, [toast, reminderKeys])

  // Auto-cierre a los 5 segundos, con cleanup por si el usuario lo toca antes.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  // Animación de entrada: monta invisible y arriba, y al siguiente frame transiciona a su lugar.
  useEffect(() => {
    if (!toast) {
      setEntered(false)
      return
    }
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [toast])

  if (!toast) return null

  return (
    <button
      type="button"
      onClick={() => {
        const to = toast.to
        setToast(null)
        navigate(to)
      }}
      className={`fixed left-1/2 top-4 z-[70] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-black/10 bg-cream px-4 py-3 text-left shadow-xl transition-all duration-300 ${
        entered ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <span className="text-lg" aria-hidden>
        {toast.icon}
      </span>
      <span className="text-sm font-medium text-black/80">{toast.title}</span>
    </button>
  )
}
