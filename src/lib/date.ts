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
