import type { Store } from './types'

/**
 * Busca el id de una tienda existente cuyo nombre coincida sin importar
 * mayúsculas/minúsculas ni espacios extra — para no crear duplicados cuando
 * el mismo nombre se escribe distinto en dos lugares.
 */
export function findExistingStoreId(stores: Store[], name: string): string | null {
  const normalized = name.trim().toLowerCase()
  return stores.find((s) => s.name.trim().toLowerCase() === normalized)?.id ?? null
}

/**
 * Intenta emparejar el nombre de comercio leído por OCR con una tienda ya
 * registrada — coincidencia flexible (uno contiene al otro) porque el OCR casi
 * nunca lee el nombre exacto completo (ej. "OXXO EXPRESS #4521" vs "Oxxo").
 * Regresa null si no hay ninguna coincidencia razonable — nunca crea una
 * tienda nueva sola, eso lo decide el usuario a mano.
 */
export function matchStoreByMerchant(merchant: string | null, stores: Store[]): string | null {
  if (!merchant) return null
  const normalized = merchant.trim().toLowerCase()
  if (normalized.length < 2) return null

  const match = stores.find((s) => {
    const storeName = s.name.trim().toLowerCase()
    return storeName.length >= 2 && (normalized.includes(storeName) || storeName.includes(normalized))
  })
  return match?.id ?? null
}
