/**
 * Fecha en "YYYY-MM-DD" LOCAL — nunca uses date.toISOString() para esto:
 * toISOString() da la fecha en UTC, así que de noche (cuando el día UTC ya
 * avanzó pero el local no) los gastos se guardaban con la fecha de mañana.
 */
export function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Hoy en "YYYY-MM-DD" LOCAL — ver localDateIso. */
export function localTodayIso(): string {
  return localDateIso(new Date())
}

export function formatFechaLarga(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Ticket'
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function formatFechaCorta(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date)
}
