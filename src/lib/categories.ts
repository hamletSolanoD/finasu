import type { Category } from './types'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'detergentes-limpieza', name: 'Detergentes y limpieza', icon: '🧽' },
  { id: 'mascotas', name: 'Mascotas', icon: '🐾' },
  { id: 'ani', name: 'Ani', icon: '👶' },
  { id: 'higiene-personal', name: 'Higiene personal', icon: '🧴' },
  { id: 'auto', name: 'Auto', icon: '🚗' },
]

export const ICON_PALETTE = [
  '🛒', '🍎', '🥦', '🍞', '🥤', '🧃', '🍫', '🧀',
  '🥩', '🐾', '👶', '🧴', '🧽', '🚗', '💊', '🏠',
  '🧦', '🎁', '📚', '🔧',
]

/**
 * Busca el id de una categoría existente cuyo nombre coincida sin importar
 * mayúsculas/minúsculas ni espacios extra — para no crear duplicados cuando
 * el usuario escribe el mismo nombre con otro formato.
 */
export function findExistingCategoryId<T extends { id: string; name: string }>(
  categories: T[],
  name: string,
): string | null {
  const normalized = name.trim().toLowerCase()
  return categories.find((c) => c.name.trim().toLowerCase() === normalized)?.id ?? null
}
