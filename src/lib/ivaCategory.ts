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
