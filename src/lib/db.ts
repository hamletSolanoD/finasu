import Dexie, { type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import { DEFAULT_CATEGORIES } from './categories'
import { DEFAULT_CURRENCY } from './currency'
import { DEFAULT_EXPENSE_CATEGORIES } from './expenseCategories'
import { monthKeyWithOffset } from './summary'
import { extractMerchantName } from './ticketParser'
import type {
  AppSettings,
  Category,
  CategoryLimit,
  Expense,
  ExpenseCategory,
  ExpenseItem,
  FutureExpense,
  MonthlyIncome,
  PriceEntry,
  Product,
  Project,
  ProjectItem,
  ProjectPriceEntry,
  SavingsDeposit,
  SavingsGoal,
  SavingsGoalDeletionLog,
} from './types'

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  firstUseMonth: monthKeyWithOffset(0),
  hasSeenOnboarding: false,
}

/**
 * Paso 1 de la migración a Dexie Cloud: requireAuth queda en false a propósito,
 * para no exigir login todavía y poder verificar en producción que la sincronización
 * de los datos que ya existían localmente funciona bien antes de bloquear el uso
 * de la app detrás de un login.
 */
const DEXIE_CLOUD_URL = 'https://zlcp5maax.dexie.cloud'

class FinasuDB extends Dexie {
  products!: Table<Product, string>
  priceEntries!: Table<PriceEntry, string>
  categories!: Table<Category, string>
  expenses!: Table<Expense, string>
  expenseItems!: Table<ExpenseItem, string>
  expenseCategories!: Table<ExpenseCategory, string>
  categoryLimits!: Table<CategoryLimit, string>
  savingsGoals!: Table<SavingsGoal, string>
  savingsDeposits!: Table<SavingsDeposit, string>
  futureExpenses!: Table<FutureExpense, string>
  settings!: Table<AppSettings, string>
  monthlyIncomes!: Table<MonthlyIncome, string>
  savingsGoalDeletions!: Table<SavingsGoalDeletionLog, string>
  projects!: Table<Project, string>
  projectItems!: Table<ProjectItem, string>
  projectPriceEntries!: Table<ProjectPriceEntry, string>

  constructor() {
    super('finasu', { addons: [dexieCloud] })

    this.version(1).stores({
      products: 'id, name',
      priceEntries: 'id, productId, store',
    })

    this.version(2)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
      })
      .upgrade(async (tx) => {
        const count = await tx.table('categories').count()
        if (count === 0) {
          await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
        }
      })

    this.version(3).stores({
      products: 'id, name, categoryId',
      priceEntries: 'id, productId, store',
      categories: 'id, name',
      expenses: 'id, status, categoryId, capturedAt',
    })

    // v4: el ticket pasa a ser solo el encabezado; lo que se categoriza es cada
    // producto (expenseItems), no el ticket completo. Categorías de gasto son
    // su propia tabla, independiente de las categorías de productos frecuentes.
    this.version(4)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
      })
      .upgrade(async (tx) => {
        const count = await tx.table('expenseCategories').count()
        if (count === 0) {
          await tx.table('expenseCategories').bulkAdd(DEFAULT_EXPENSE_CATEGORIES)
        }
      })

    // v5: Ahorro (tipos de ahorro con meta + % de reparto) y Gastos futuros,
    // más la fila única de configuración (ingreso mensual).
    this.version(5)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        savingsTypes: 'id, name',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Los tipos de ahorro de esta versión se descartan en v8 (ver más abajo), así que
        // ya no hace falta sembrar savingsTypes aquí — solo la fila de configuración.
        const settingsCount = await tx.table('settings').count()
        if (settingsCount === 0) {
          await tx.table('settings').add(DEFAULT_SETTINGS)
        }
      })

    // v6: Proyectos (presupuesto propio) con sus artículos a comprar y las
    // opciones de tienda+precio de cada artículo, para comparar antes de comprar.
    this.version(6).stores({
      products: 'id, name, categoryId',
      priceEntries: 'id, productId, store',
      categories: 'id, name',
      expenses: 'id, status, capturedAt',
      expenseItems: 'id, expenseId, categoryId',
      expenseCategories: 'id, name',
      savingsTypes: 'id, name',
      futureExpenses: 'id, fechaObjetivo',
      settings: 'id',
      projects: 'id, name',
      projectItems: 'id, projectId, purchased',
      projectPriceEntries: 'id, projectItemId, store',
    })

    // v7: guarda desde qué mes usas la app, para no dejarte ver el Resumen de
    // meses anteriores a tu primer uso real.
    this.version(7)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        savingsTypes: 'id, name',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('default')
        if (settings && !settings.firstUseMonth) {
          await tx.table('settings').update('default', { firstUseMonth: monthKeyWithOffset(0) })
        }
      })

    // v8: el ahorro deja de ser "% de tu ingreso disponible" y pasa a ser metas
    // fijas (SavingsGoal) con su propia duración, frecuencia y monto por periodo,
    // más sus depósitos (SavingsDeposit) uno por periodo. Se migra lo que ya
    // tuviera datos reales; los tipos default sin tocar se descartan.
    this.version(8)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        savingsTypes: null,
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const oldTypes = await tx.table('savingsTypes').toArray()
        const now = Date.now()
        for (const t of oldTypes) {
          const touched = t.goal !== null || t.currentSaved > 0 || t.allocationPercent !== null
          if (!touched) continue
          const goalId = crypto.randomUUID()
          await tx.table('savingsGoals').add({
            id: goalId,
            name: t.name,
            icon: t.icon,
            where: '',
            startDate: now,
            durationValue: 12,
            durationUnit: 'meses',
            frequency: 'mensual',
            amountPerPeriod: 0,
            goalAmount: t.goal ?? 0,
            hasYield: false,
            yieldRate: null,
          })
          if (t.currentSaved > 0) {
            await tx.table('savingsDeposits').add({
              id: crypto.randomUUID(),
              goalId,
              periodIndex: 0,
              date: now,
              amount: t.currentSaved,
              yieldAmount: 0,
            })
          }
        }
      })

    // v9: los límites de categoría dejan de ser un valor fijo y pasan a ser un
    // evento único por mes (CategoryLimit) — se establecen una vez y quedan
    // bloqueados; el mes siguiente hay que volver a establecerlos. Se migra el
    // límite que ya tuvieras como si lo hubieras puesto para el mes actual.
    this.version(9)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const monthKey = monthKeyWithOffset(0)
        const categories = await tx.table('expenseCategories').toArray()
        for (const c of categories) {
          if (c.monthlyLimit === null || c.monthlyLimit === undefined) continue
          await tx.table('categoryLimits').add({
            id: crypto.randomUUID(),
            categoryId: c.id,
            monthKey,
            limit: c.monthlyLimit,
            setAt: Date.now(),
          })
        }
      })

    // v10: cada ticket guarda en qué moneda está — todavía no hay IA que la
    // detecte sola, así que se pide a mano (por default, pesos mexicanos).
    this.version(10)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const expenses = await tx.table('expenses').toArray()
        for (const e of expenses) {
          if (!e.currency) await tx.table('expenses').update(e.id, { currency: DEFAULT_CURRENCY })
        }
      })

    // v11: cada producto de un ticket guarda su posición original (order) para
    // mostrarse en el mismo orden en que aparece en el ticket real, en vez del
    // orden arbitrario en que Dexie los regresa.
    this.version(11)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const items = await tx.table('expenseItems').toArray()
        const byExpense = new Map<string, typeof items>()
        for (const item of items) {
          if (!byExpense.has(item.expenseId)) byExpense.set(item.expenseId, [])
          byExpense.get(item.expenseId)!.push(item)
        }
        for (const group of byExpense.values()) {
          for (let i = 0; i < group.length; i++) {
            await tx.table('expenseItems').update(group[i].id, { order: i })
          }
        }
      })

    // v12: el ingreso mensual pasa de ser un valor global suelto (AppSettings)
    // a ser, igual que los límites de categoría, un evento único por mes
    // (MonthlyIncome). Se migra el valor que ya tuvieras como el ingreso del
    // mes actual.
    this.version(12)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        monthlyIncomes: 'id, monthKey',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('default')
        if (settings && settings.monthlyIncome != null) {
          await tx.table('monthlyIncomes').add({
            id: crypto.randomUUID(),
            monthKey: monthKeyWithOffset(0),
            income: settings.monthlyIncome,
            setAt: Date.now(),
          })
        }
      })

    // v13: cada ticket guarda el nombre del establecimiento, sacado del OCR —
    // se muestra en la lista en vez del primer producto y sirve para filtrar.
    this.version(13)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        monthlyIncomes: 'id, monthKey',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const expenses = await tx.table('expenses').toArray()
        for (const e of expenses) {
          await tx.table('expenses').update(e.id, { merchant: extractMerchantName(e.ocrText ?? '') })
        }
      })

    // v14: al borrar una meta de ahorro se guarda la razón (si se dio) en su
    // propia tabla — no hay IA todavía que la lea, pero queda lista para cuando
    // exista.
    this.version(14).stores({
      products: 'id, name, categoryId',
      priceEntries: 'id, productId, store',
      categories: 'id, name',
      expenses: 'id, status, capturedAt',
      expenseItems: 'id, expenseId, categoryId',
      expenseCategories: 'id, name',
      categoryLimits: 'id, categoryId, monthKey',
      savingsGoals: 'id, name',
      savingsDeposits: 'id, goalId, periodIndex',
      futureExpenses: 'id, fechaObjetivo',
      settings: 'id',
      monthlyIncomes: 'id, monthKey',
      savingsGoalDeletions: 'id, deletedAt',
      projects: 'id, name',
      projectItems: 'id, projectId, purchased',
      projectPriceEntries: 'id, projectItemId, store',
    })

    // v15: cada categoría de gasto guarda cuándo se creó, para que el historial
    // de meses anteriores no muestre categorías que todavía no existían en ese
    // mes. Las categorías ya existentes (y las default) cuentan como si
    // siempre hubieran existido (createdAt: 0), ya que no hay una fecha real
    // de creación para ellas.
    this.version(15)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        monthlyIncomes: 'id, monthKey',
        savingsGoalDeletions: 'id, deletedAt',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const categories = await tx.table('expenseCategories').toArray()
        for (const c of categories) {
          if (c.createdAt == null) await tx.table('expenseCategories').update(c.id, { createdAt: 0 })
        }
      })

    // v16: tour de bienvenida (OnboardingTour) que explica cada sección — se muestra
    // solo una vez, controlado por hasSeenOnboarding. Quien ya venía usando la app
    // antes de que existiera el tour no debería verlo de sorpresa, así que se marca
    // como ya visto; solo las instalaciones nuevas (DEFAULT_SETTINGS) arrancan en false.
    this.version(16)
      .stores({
        products: 'id, name, categoryId',
        priceEntries: 'id, productId, store',
        categories: 'id, name',
        expenses: 'id, status, capturedAt',
        expenseItems: 'id, expenseId, categoryId',
        expenseCategories: 'id, name',
        categoryLimits: 'id, categoryId, monthKey',
        savingsGoals: 'id, name',
        savingsDeposits: 'id, goalId, periodIndex',
        futureExpenses: 'id, fechaObjetivo',
        settings: 'id',
        monthlyIncomes: 'id, monthKey',
        savingsGoalDeletions: 'id, deletedAt',
        projects: 'id, name',
        projectItems: 'id, projectId, purchased',
        projectPriceEntries: 'id, projectItemId, store',
      })
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('default')
        if (settings && settings.hasSeenOnboarding == null) {
          await tx.table('settings').update('default', { hasSeenOnboarding: true })
        }
      })

    this.cloud.configure({
      databaseUrl: DEXIE_CLOUD_URL,
      requireAuth: false,
    })

    // Solo corre la primera vez que se crea la base de datos (instalaciones nuevas).
    this.on('populate', async () => {
      await this.categories.bulkAdd(DEFAULT_CATEGORIES)
      await this.expenseCategories.bulkAdd(DEFAULT_EXPENSE_CATEGORIES)
      await this.settings.add(DEFAULT_SETTINGS)
    })
  }
}

export const db = new FinasuDB()
