export type UnitKind = 'peso' | 'volumen' | 'unidad'

export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'ud'

export interface Category {
  id: string
  name: string
  icon: string
}

export interface Product {
  id: string
  name: string
  image?: string
  unitKind: UnitKind
  categoryId: string
  /** Marca los ~5 que compras casi siempre, para tenerlos a la mano arriba de la lista. */
  favorite: boolean
  createdAt: number
}

export interface PriceEntry {
  id: string
  productId: string
  store: string
  price: number
  amount: number
  unit: Unit
  /** true si esta tienda es una tienda en línea (no física). */
  isOnline: boolean
  date: number
}

export type ExpenseStatus =
  /** Tiene productos, pero al menos uno todavía no tiene categoría. */
  | 'pendiente_de_categorizar'
  /** El OCR no logró leer texto útil de la imagen — hace falta repetir la foto o llenar a mano. */
  | 'requiere_revision'
  /** Todos los productos del ticket ya tienen categoría. */
  | 'categorizado'

/** El ticket en sí — solo el encabezado. Lo que se categoriza es cada producto (ExpenseItem), no el ticket completo. */
export interface Expense {
  id: string
  image?: string
  ocrText: string
  status: ExpenseStatus
  /** Se llena sola: la fecha leída del ticket, o si no se detecta, la fecha en que se escaneó. */
  fecha: string
  capturedAt: number
  /** Código de moneda (MXN, USD...) — todavía no hay IA que la detecte, así que se pide a mano. */
  currency: string
  /** Nombre del establecimiento, sacado del OCR — null si no se pudo detectar. */
  merchant: string | null
}

/** Un producto/línea dentro de un ticket, con su propia categoría — así se sabe exactamente en qué se fue el dinero. */
export interface ExpenseItem {
  id: string
  expenseId: string
  nombre: string
  monto: number
  /** null hasta que alguien (por ahora, siempre a mano) le asigna categoría. Nunca se fuerza a "Otros". */
  categoryId: string | null
  /** Posición dentro del ticket (0 = primera línea) — para mostrarlos en el mismo orden que el ticket real. */
  order: number
}

/** Categorías de gasto (Despensa, Golosinas, Carro, Comida preparada...) — independientes de las categorías de productos frecuentes. */
export interface ExpenseCategory {
  id: string
  name: string
  icon: string
  /** Cuándo se creó — así el historial de meses anteriores no muestra categorías que todavía no existían. */
  createdAt: number
}

/**
 * El límite de una categoría para un mes específico — es un evento único: se
 * establece una vez por mes y ya no se puede modificar (ver CategoryLimit).
 */
export interface CategoryLimit {
  id: string
  categoryId: string
  /** "YYYY-MM" del mes al que aplica este límite. */
  monthKey: string
  /** null = decidiste explícitamente no ponerle límite este mes. */
  limit: number | null
  setAt: number
}

/** Fila única de configuración general de la app. */
export interface AppSettings {
  id: 'default'
  /** "YYYY-MM" de cuando se creó la base de datos — el Resumen no deja ver meses anteriores a este. */
  firstUseMonth: string
  /**
   * Si ya se vio el tour de bienvenida — false solo en instalaciones nuevas, para mostrarlo
   * automáticamente una vez. Los usuarios que ya venían usando la app antes de que existiera
   * el tour se migran como true (ver db.ts v16), así que no lo ven de sorpresa.
   */
  hasSeenOnboarding: boolean
  /** Nombre para mostrar en "Mi cuenta" y en el saludo de Inicio — cada usuario pone el suyo. */
  displayName: string
  /** Si ya se le preguntó su nombre justo después de iniciar sesión por primera vez — para no volver a preguntar. */
  hasSeenNamePrompt: boolean
}

/**
 * El ingreso mensual, igual que CategoryLimit: un evento único por mes — se
 * establece una vez (junto con los límites de categoría de ese mes) y queda
 * fijo. Un solo lugar lo edita (Categorías y límites); en todos los demás
 * lados se muestra de solo lectura.
 */
export interface MonthlyIncome {
  id: string
  /** "YYYY-MM" del mes al que aplica. */
  monthKey: string
  /** null = decidiste explícitamente no declarar ingreso ese mes. */
  income: number | null
  setAt: number
}

export type SavingsFrequency = 'semanal' | 'quincenal' | 'mensual'
export type SavingsDurationUnit = 'semanas' | 'quincenas' | 'meses' | 'anios'

/** Una meta de ahorro fija (ej. "Viaje a Japón"): cuánto, cada cuánto, y por cuánto tiempo. */
export interface SavingsGoal {
  id: string
  name: string
  icon: string
  /** Dónde se está guardando (ej. "BBVA", "Efectivo en casa"). */
  where: string
  /** Fecha en la que arranca a contar los periodos. */
  startDate: number
  durationValue: number
  durationUnit: SavingsDurationUnit
  frequency: SavingsFrequency
  /** Cuánto planeas ahorrar cada periodo (ej. $100 cada semana). */
  amountPerPeriod: number
  /** Meta total a alcanzar. */
  goalAmount: number
  /** Si es un ahorro con rendimiento (ej. cuenta con intereses). */
  hasYield: boolean
  /** Tasa de rendimiento anual estimada (%), solo si hasYield. */
  yieldRate: number | null
}

/**
 * Registro de por qué se borró una meta de ahorro — todavía no hay IA que lo
 * lea, pero se guarda desde ahora para cuando exista.
 */
export interface SavingsGoalDeletionLog {
  id: string
  goalName: string
  goalIcon: string
  /** '' si no se dio razón. */
  reason: string
  deletedAt: number
}

/** Un depósito registrado para un periodo específico de un SavingsGoal. */
export interface SavingsDeposit {
  id: string
  goalId: string
  /** Índice del periodo (0 = primer periodo desde startDate). */
  periodIndex: number
  date: number
  /** Monto ahorrado — cuenta para la meta. */
  amount: number
  /** Rendimiento generado en este periodo — aparte del monto, no cuenta para la meta. */
  yieldAmount: number
}

/** Un gasto grande que sabes que vas a necesitar (visa, celular, coche...) y para el que quieres ir ahorrando. */
export interface FutureExpense {
  id: string
  nombre: string
  montoObjetivo: number
  /** Fecha en la que necesitas el dinero; null = sin fecha definida (no se calcula ahorro mensual sugerido). */
  fechaObjetivo: string | null
  ahorradoHastaAhora: number
  createdAt: number
}

/** Un proyecto con presupuesto propio (ej. "Pintar la casa"), independiente del gasto mensual normal. */
export interface Project {
  id: string
  name: string
  budget: number | null
  createdAt: number
}

/** Un artículo/material a comprar dentro de un proyecto. */
export interface ProjectItem {
  id: string
  projectId: string
  name: string
  purchased: boolean
  createdAt: number
}

/** Una opción de tienda+precio para un artículo — permite comparar antes de comprar. */
export interface ProjectPriceEntry {
  id: string
  projectItemId: string
  store: string
  price: number
  date: number
}
