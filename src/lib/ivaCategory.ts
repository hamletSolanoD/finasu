import { findExistingCategoryId } from './categories'
import { db } from './db'

const IVA_CATEGORY_NAME = 'IVA'
const IVA_CATEGORY_ICON = '🧾'

/** true si el nombre de una línea leída por OCR es en realidad el IVA del ticket, no un producto. */
export function looksLikeIva(nombre: string): boolean {
  return /\biva\b/i.test(nombre)
}

/**
 * Regresa el id de la categoría "IVA" — la crea la primera vez que se detecta
 * un ticket con IVA. El IVA no es un producto, pero sí sale de tu bolsillo,
 * así que se categoriza solo en vez de quedar pendiente de categorizar.
 */
export async function ensureIvaCategory(): Promise<string> {
  const categories = await db.expenseCategories.toArray()
  const existingId = findExistingCategoryId(categories, IVA_CATEGORY_NAME)
  if (existingId) return existingId

  const id = crypto.randomUUID()
  await db.expenseCategories.add({ id, name: IVA_CATEGORY_NAME, icon: IVA_CATEGORY_ICON, createdAt: Date.now() })
  return id
}

/**
 * Pone solo el límite de la categoría IVA para un mes, calculado desde los datos —
 * se llama al declarar el ingreso del mes, para no tener que decidirlo a mano.
 * Nunca pisa un límite que ya exista para ese mes, y no crea la categoría IVA
 * (esa se crea sola al escanear un ticket con IVA).
 */
export async function autoSetIvaLimitForMonth(monthKey: string, income: number | null): Promise<void> {
  const categories = await db.expenseCategories.toArray()
  const categoryId = findExistingCategoryId(categories, IVA_CATEGORY_NAME)
  if (!categoryId) return

  const existing = await db.categoryLimits
    .where('monthKey')
    .equals(monthKey)
    .and((l) => l.categoryId === categoryId)
    .first()
  if (existing) return

  // Preferencia: el IVA que de verdad se pagó en los últimos meses con datos.
  const [expenses, ivaItems] = await Promise.all([
    db.expenses.toArray(),
    db.expenseItems.where('categoryId').equals(categoryId).toArray(),
  ])
  const monthByExpenseId = new Map(expenses.map((e) => [e.id, e.fecha.slice(0, 7)]))
  const totalsByMonth = new Map<string, number>()
  for (const item of ivaItems) {
    const month = monthByExpenseId.get(item.expenseId)
    if (!month || month >= monthKey) continue
    totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + item.monto)
  }
  const recentMonths = [...totalsByMonth.keys()].sort().slice(-3)

  let limit: number
  if (recentMonths.length > 0) {
    const average = recentMonths.reduce((sum, month) => sum + (totalsByMonth.get(month) ?? 0), 0) / recentMonths.length
    limit = Math.ceil(average / 10) * 10
  } else if (income !== null && income > 0) {
    // Sin historial todavía: 5% del ingreso como tope inicial. La mayor parte de la
    // despensa en México es tasa 0% de IVA, así que el IVA real suele ser una fracción
    // chica del gasto — este tope es razonable de arranque y el historial lo irá afinando.
    limit = Math.round((income * 0.05) / 100) * 100
  } else {
    return
  }
  if (limit <= 0) return

  await db.categoryLimits.add({ id: crypto.randomUUID(), categoryId, monthKey, limit, setAt: Date.now() })
}
