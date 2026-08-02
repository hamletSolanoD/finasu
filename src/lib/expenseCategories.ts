import type { ExpenseCategory } from './types'

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'despensa', name: 'Despensa', icon: '🛒', createdAt: 0 },
  { id: 'golosinas', name: 'Golosinas', icon: '🍬', createdAt: 0 },
  { id: 'carro', name: 'Carro', icon: '⛽', createdAt: 0 },
  { id: 'comida-preparada', name: 'Comida preparada', icon: '🍽️', createdAt: 0 },
]

export const ICON_PALETTE = [
  '🛒', '🍬', '⛽', '🍽️', '💊', '🎬', '👕', '💡',
  '🏠', '🎁', '📚', '🐾', '💇', '🧾', '✈️', '🔧',
]
