import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { computeMonthlySpendByCategory, computeSpendingPace } from '../lib/budget'
import { getLimitForMonth } from '../lib/categoryLimits'
import { db } from '../lib/db'
import { isMonthComplete, markNotifiedToday, shouldNotifyToday } from '../lib/reminders'
import { isLastDayOfCurrentMonth, monthKeyWithOffset } from '../lib/summary'
import type { CategoryLimit, ExpenseCategory } from '../lib/types'
import { formatCurrency } from '../lib/units'

/**
 * Centro de notificaciones de Inicio: junta en una sola lista todo lo vigente —
 * los límites del mes pendientes (lo que antes era MonthlyReminderBanner), las
 * categorías ya en problemas (cerca o pasadas del límite, con el estilo más
 * visible) y los avisos discretos de ritmo (vas gastando más rápido de lo que
 * avanza el mes — chiquitos a propósito, porque no todos los gastos se
 * reparten parejo en el mes).
 */
export function NotificationsPanel() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
  }, [])

  const advanceNotice = isLastDayOfCurrentMonth()
  const targetMonthKey = advanceNotice ? monthKeyWithOffset(1) : monthKeyWithOffset(0)
  const limitsPending = Boolean(
    categories &&
      limits &&
      incomes &&
      categories.length > 0 &&
      !isMonthComplete(categories, limits, incomes, targetMonthKey),
  )

  // Notificación local, máximo una vez al día, solo mientras el mes no esté completo.
  useEffect(() => {
    if (!limitsPending) return
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
  }, [limitsPending, advanceNotice])

  if (!expenses || !items || !categories || !limits || !incomes) return null

  const currentMonthKey = monthKeyWithOffset(0)
  const spendByCategory = computeMonthlySpendByCategory(expenses, items)
  const paces = categories
    .map((category) => ({ category, limitRecord: getLimitForMonth(category.id, currentMonthKey, limits) }))
    .filter(
      (x): x is { category: ExpenseCategory; limitRecord: CategoryLimit } =>
        x.limitRecord !== null && x.limitRecord.limit !== null,
    )
    .map(({ category, limitRecord }) => {
      const spent = spendByCategory.get(category.id) ?? 0
      const limit = limitRecord.limit!
      return { category, spent, limit, pace: computeSpendingPace(spent, limit) }
    })

  const problems = paces
    .filter((p) => p.pace.status === 'critico' || p.pace.status === 'excedido')
    .sort((a, b) => b.pace.percentUsed - a.pace.percentUsed)
  const ahead = paces.filter((p) => p.pace.status === 'adelantado')

  const hasAny = limitsPending || problems.length > 0 || ahead.length > 0

  async function handleEnableNotifications() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <section>
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🔔 Notificaciones
      </p>

      {!hasAny ? (
        <p className="mt-2 text-sm text-black/40">✓ Sin pendientes por ahora</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {limitsPending && (
            <div className="rounded-2xl border border-sky bg-sky/20 p-4">
              <p className="font-display font-semibold">
                {advanceNotice
                  ? '📅 Mañana empieza un nuevo mes'
                  : '📅 Establece tus límites de categoría de este mes'}
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
          )}

          {problems.map(({ category, spent, limit, pace }) => {
            const over = pace.status === 'excedido'
            return (
              <Link
                key={category.id}
                to={`/gastos/categorias#cat-${category.id}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${
                  over ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <span>
                  {category.icon} {category.name}:{' '}
                  {over
                    ? `te pasaste por ${formatCurrency(spent - limit)}`
                    : `ya usaste ${Math.round(pace.percentUsed)}% de tu límite`}{' '}
                  este mes
                </span>
                <span className="font-semibold">
                  {formatCurrency(spent)} / {formatCurrency(limit)}
                </span>
              </Link>
            )
          })}

          {ahead.map(({ category, pace }) => (
            <Link
              key={category.id}
              to={`/gastos/categorias#cat-${category.id}`}
              className="block rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-1.5 text-sm text-amber-800/80 transition hover:bg-amber-50"
            >
              🐢 {category.name}: llevas {Math.round(pace.percentUsed)}% del límite y apenas va el{' '}
              {Math.round(pace.monthElapsedPercent)}% del mes
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
