import { db } from './db'

export const MAX_FAVORITES = 10

/** Marca/desmarca un producto como favorito; si ya hay MAX_FAVORITES marcados, no deja agregar uno más. */
export async function toggleProductFavorite(productId: string, currentlyFavorite: boolean): Promise<boolean> {
  if (!currentlyFavorite) {
    const count = await db.products.filter((p) => p.favorite).count()
    if (count >= MAX_FAVORITES) return false
  }
  await db.products.update(productId, { favorite: !currentlyFavorite })
  return true
}
