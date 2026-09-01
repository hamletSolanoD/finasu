import { useConfirm } from '../components/ConfirmModal'
import { getLimitForMonth } from './categoryLimits'
import { useLeaveGuard } from './useLeaveGuard'
import type { CategoryLimit, ExpenseCategory, MonthlyIncome } from './types'

interface Params {
  monthKey: string
  categories: ExpenseCategory[]
  limits: CategoryLimit[]
  incomeRecord: MonthlyIncome | null
  finalized: boolean
  onFinalize: () => Promise<void>
}

/**
 * Protege la pantalla de establecer límites mientras el mes siga sin cerrar
 * (ver MonthFinalization): antes de dejarla (botón atrás del teléfono, o el
 * "← back" de la propia pantalla vía BackLink.onBeforeLeave) avisa si aún
 * faltan categorías por decidir, o — si ya está todo completo — pregunta si
 * se quiere guardar de forma definitiva antes de salir. En ningún caso se
 * pierde nada: lo ya guardado como borrador sigue ahí para retomarlo cuando
 * sea. Se usa igual en ExpenseCategories (mes actual) y MonthDetail (mes que
 * todavía no arranca) — misma lógica, sin duplicarla en cada pantalla.
 */
export function useMonthDraftGuard({ monthKey, categories, limits, incomeRecord, finalized, onFinalize }: Params): {
  attemptLeave: () => Promise<boolean>
} {
  const confirm = useConfirm()

  async function attemptLeave(): Promise<boolean> {
    if (finalized) return true

    const missing = categories.filter((c) => getLimitForMonth(c.id, monthKey, limits) === null)
    const complete = incomeRecord !== null && missing.length === 0

    if (!complete) {
      return confirm({
        title:
          incomeRecord === null
            ? 'Aún no declaraste el ingreso de este mes'
            : `Aún te faltan ${missing.length} categoría${missing.length === 1 ? '' : 's'} por definir`,
        body: 'Lo que ya guardaste como borrador no se pierde — puedes volver cuando quieras a terminarlo.',
        confirmLabel: 'Salir de todos modos',
        cancelLabel: 'Seguir aquí',
        danger: false,
      })
    }

    const wantsToFinalize = await confirm({
      title: '¿Guardar los límites de forma definitiva antes de salir?',
      body: 'Ya completaste el ingreso y el límite de cada categoría. Si no guardas ahora, quedan como borrador y los puedes seguir editando después.',
      confirmLabel: 'Guardar y salir',
      cancelLabel: 'Salir sin guardar',
      danger: false,
    })
    if (wantsToFinalize) await onFinalize()
    return true
  }

  useLeaveGuard(!finalized, attemptLeave)

  return { attemptLeave }
}
