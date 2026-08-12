import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { computeReminders, reminderTargetMonthKey } from '../lib/notifications'
import { markNotifiedToday, shouldNotifyToday } from '../lib/reminders'
import { useModalBack } from '../lib/useModalBack'

/**
 * Campana 🔔 del header: junta las notificaciones tipo recordatorio/sistema
 * (hoy solo la de límites del mes; en el futuro, las del modelo de IA). Muestra
 * un puntito rojo mientras haya pendientes y abre un modal con la lista. Los
 * warnings de límites NO viven aquí — esos van en WarningsPanel en Inicio.
 */
export function NotificationsBell() {
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const navigate = useNavigate()

  useModalBack(open, () => setOpen(false))

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
  }, [])

  const monthKey = reminderTargetMonthKey()
  const reminders =
    categories && limits && incomes ? computeReminders(categories, limits, incomes, monthKey) : []
  const hasPending = reminders.length > 0

  // Notificación local del sistema, máximo una vez al día, mientras haya recordatorios.
  const firstReminderBody = reminders[0]?.body ?? null
  useEffect(() => {
    if (!firstReminderBody) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!shouldNotifyToday()) return
    navigator.serviceWorker?.getRegistration().then((reg) => {
      reg?.showNotification('Finasu', {
        body: firstReminderBody,
        icon: '/pwa-192x192.png',
      })
    })
    markNotifiedToday()
  }, [firstReminderBody])

  async function handleEnableNotifications() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver notificaciones"
        title="Notificaciones"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-black/55 transition hover:bg-black/5"
      >
        🔔
        {hasPending && (
          <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">🔔 Notificaciones</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-black/70 transition hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            {reminders.length === 0 ? (
              <p className="mt-4 text-sm text-black/40">Sin notificaciones por ahora ✨</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2 overflow-auto">
                {reminders.map((reminder) => (
                  <Link
                    key={reminder.key}
                    to={reminder.to}
                    onClick={(e) => {
                      // No dejamos que el Link navegue en el mismo tick: cerramos el
                      // modal primero (para que useModalBack limpie su entrada extra
                      // del historial con su propio history.back()) y solo después
                      // navegamos nosotros a mano. Si navegáramos en el mismo click,
                      // el push de la navegación pisaría la entrada del modal antes
                      // de que se limpiara sola, dejando el historial del navegador
                      // inconsistente (y al usuario viendo una pantalla en blanco).
                      e.preventDefault()
                      setOpen(false)
                      setTimeout(() => navigate(reminder.to), 0)
                    }}
                    className="rounded-2xl border border-black/10 bg-white/60 p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <p className="font-display font-semibold text-black/80">
                      {reminder.icon} {reminder.title}
                    </p>
                    <p className="mt-1 text-sm text-black/60">{reminder.body}</p>
                  </Link>
                ))}
              </div>
            )}

            {permission === 'default' && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="mt-4 self-start rounded-full border border-black/15 px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5"
              >
                🔔 Activar recordatorios del sistema
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
