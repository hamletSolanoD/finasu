const NOTIFY_KEY = 'finasu:lastLimitsNotifiedDate'

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * true si todavía no se mandó una notificación local hoy sobre límites
 * pendientes — es solo para no repetir la notificación cada vez que se abre
 * Inicio, no controla si el aviso en pantalla se muestra (ese depende de si
 * ya se establecieron los límites).
 */
export function shouldNotifyToday(): boolean {
  return localStorage.getItem(NOTIFY_KEY) !== todayKey()
}

export function markNotifiedToday(): void {
  localStorage.setItem(NOTIFY_KEY, todayKey())
}
