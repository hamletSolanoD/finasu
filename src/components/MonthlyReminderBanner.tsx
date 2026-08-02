import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { allLimitsSetForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import { markNotifiedToday, shouldNotifyToday } from '../lib/reminders'
import { isLastDayOfCurrentMonth, monthKeyWithOffset } from '../lib/summary'

/**
 * Aviso persistente arriba de todo en Inicio: aparece desde el día antes de
 * que empiece un mes nuevo y se queda ahí — sin poder descartarlo — hasta que
 * todas las categorías tengan su límite de ese mes establecido.
 */
export function MonthlyReminderBanner() {
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
  }, [])

  const advanceNotice = isLastDayOfCurrentMonth()
  const targetMonthKey = advanceNotice ? monthKeyWithOffset(1) : monthKeyWithOffset(0)
  const allSet = categories && limits ? allLimitsSetForMonth(categories, limits, targetMonthKey) : true

  useEffect(() => {
    if (!categories || categories.length === 0 || allSet) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!shouldNotifyToday()) return
    navigator.serviceWorker?.getRegistration().then((reg) => {
      reg?.showNotification('Finasu', {
        body: advanceNotice
          ? 'Mañana empieza un nuevo mes — prepara tus límites de categoría.'
          : 'Aún no estableces tus límites de categoría de este mes.',
        icon: '/pwa-192x192.png',
      })
    })
    markNotifiedToday()
  }, [categories, allSet, advanceNotice])

  if (!categories || !limits) return null
  if (categories.length === 0 || allSet) return null

  async function handleEnableNotifications() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <div className="rounded-2xl border border-sky bg-sky/20 p-4">
      <p className="font-display font-semibold">
        {advanceNotice ? '📅 Mañana empieza un nuevo mes' : '📅 Establece tus límites de categoría de este mes'}
      </p>
      <p className="mt-1 text-sm text-black/60">
        {advanceNotice
          ? 'Prepara cuánto quieres gastar en cada categoría antes de que arranque.'
          : 'Define cuánto quieres gastar en cada categoría antes de que se te pasen los tickets.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to="/gastos/categorias"
          className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-black/80 transition hover:brightness-95"
        >
          Establecer ahora
        </Link>
        {permission === 'default' && (
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5"
          >
            🔔 Activar recordatorios
          </button>
        )}
      </div>
    </div>
  )
}
