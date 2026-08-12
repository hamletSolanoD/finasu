import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useModalBack } from '../lib/useModalBack'

interface ConfirmOptions {
  title: string
  body?: string
  /** Texto del botón de confirmar — default 'Eliminar' porque casi todo uso hoy es borrar algo. */
  confirmLabel?: string
  cancelLabel?: string
  /** true = botón de confirmar en rojo (acción destructiva). Default true. */
  danger?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/**
 * Reemplazo estándar de window.confirm() con el look de la app — el nativo
 * del navegador (el que se ve "como el de Netlify") no se puede vestir ni es
 * consistente entre dispositivos. Envuelve la app una sola vez en App.tsx;
 * en cualquier componente, usa el hook useConfirm() para pedir confirmación:
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: '¿Eliminar esta tienda?', body: '...' })
 *   if (!ok) return
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
    })
  }, [])

  function settle(value: boolean) {
    resolveRef.current?.(value)
    resolveRef.current = null
    setOptions(null)
  }

  useModalBack(options !== null, () => settle(false))

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-semibold">{options.title}</h2>
            {options.body && <p className="mt-2 text-sm text-black/60">{options.body}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`rounded-full px-5 py-2 font-display font-semibold transition hover:brightness-95 ${
                  options.danger === false ? 'bg-sage text-black/80' : 'bg-red-500 text-white'
                }`}
              >
                {options.confirmLabel ?? 'Eliminar'}
              </button>
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                {options.cancelLabel ?? 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/** Regresa la función de confirmación — úsala como `const ok = await confirm({ title, body })`. */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}
