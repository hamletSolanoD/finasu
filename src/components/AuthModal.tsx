import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { db } from '../lib/db'

interface InteractionCopy {
  emoji: string
  title: string
  subtitle: string
  submitLabel?: string
  cancelLabel?: string
}

/** Copys en español para cada tipo de interacción que puede pedir Dexie Cloud — los textos de
 * botón que manda el servidor (submitLabel/cancelLabel) vienen en inglés, así que se sobreescriben aquí. */
function getCopy(type: string): InteractionCopy {
  switch (type) {
    case 'email':
      return {
        emoji: '👋',
        title: 'Bienvenido a Finasu',
        subtitle:
          'Escribe tu correo — te mandamos un código para entrar. Si es tu primera vez, esto mismo crea tu cuenta; no hace falta ningún registro aparte.',
        submitLabel: 'Enviar código',
        cancelLabel: 'Cancelar',
      }
    case 'otp':
      return {
        emoji: '📩',
        title: 'Revisa tu correo',
        subtitle: 'Te mandamos un código de un solo uso — escríbelo aquí para entrar.',
        submitLabel: 'Entrar',
        cancelLabel: 'Cancelar',
      }
    case 'logout-confirmation':
      return {
        emoji: '👋',
        title: '¿Cerrar sesión?',
        subtitle:
          'Tienes cambios que todavía no terminan de subirse a la nube. Si cierras sesión ahora, esos cambios específicos se pierden — todo lo que ya se sincronizó queda a salvo y lo vuelves a ver la próxima vez que entres.',
        submitLabel: 'Cerrar sesión de todos modos',
        cancelLabel: 'Cancelar',
      }
    default:
      return { emoji: '🔐', title: 'Tu cuenta', subtitle: '' }
  }
}

/** Traduce los códigos de alerta de Dexie Cloud a mensajes en español. */
function friendlyAlertMessage(alert: { messageCode: string; message: string; messageParams: Record<string, string> }): string {
  const map: Record<string, string> = {
    INVALID_OTP: 'Ese código no es válido o ya expiró. Intenta de nuevo.',
    INVALID_EMAIL: 'Ese correo no parece válido.',
    USER_NOT_REGISTERED: 'Ese correo todavía no tiene cuenta aquí.',
    USER_NOT_ACCEPTED: 'Ese correo no está autorizado para esta app.',
    NO_SEATS_AVAILABLE: 'Se alcanzó el límite de cuentas del plan.',
    USER_DEACTIVATED: 'Esta cuenta está desactivada.',
    GENERIC_ERROR: 'Algo salió mal, intenta de nuevo.',
    LICENSE_LIMIT_REACHED: 'Se alcanzó el límite del plan.',
    WEBHOOK_ERROR: 'Hubo un error del servidor, intenta de nuevo.',
    OTP_SENT: 'Código enviado, revisa tu correo.',
  }
  return map[alert.messageCode] ?? alert.message
}

export function AuthModal() {
  const interaction = useObservable(db.cloud.userInteraction)
  const currentUser = useObservable(db.cloud.currentUser)
  const settings = useLiveQuery(() => db.settings.get('default'), [])
  const [values, setValues] = useState<Record<string, string>>({})
  const [nameDraft, setNameDraft] = useState('')

  // Limpia el formulario cada vez que cambia de tipo de interacción (ej. de email a otp).
  useEffect(() => {
    setValues({})
  }, [interaction?.type])

  async function handleSkipName() {
    await db.settings.update('default', { hasSeenNamePrompt: true })
  }

  async function handleSubmitName(e: FormEvent) {
    e.preventDefault()
    await db.settings.update('default', { displayName: nameDraft.trim(), hasSeenNamePrompt: true })
  }

  // Sin interacción pendiente de Dexie Cloud: si acabas de entrar por primera vez
  // y todavía no tienes nombre puesto, se pregunta aquí mismo, justo después del login.
  if (!interaction) {
    const isLoggedIn = Boolean(currentUser?.isLoggedIn)
    if (!isLoggedIn || !settings || settings.hasSeenNamePrompt) return null

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl">
          <p className="text-3xl" aria-hidden>
            ✏️
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold">¿Cómo quieres que te reconozcamos?</h2>
          <p className="mt-1 text-sm text-black/60">
            Te vamos a dar la bienvenida con tu nombre cada vez que entres.
          </p>
          <form onSubmit={handleSubmitName} className="mt-4 flex flex-col gap-3">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
              className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={handleSkipName}
                className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                Ahora no
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const fieldNames = Object.keys(interaction.fields)
  const copy = getCopy(interaction.type)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    interaction!.onSubmit(values)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl">
        <p className="text-3xl" aria-hidden>
          {copy.emoji}
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold">{copy.title}</h2>
        {copy.subtitle && <p className="mt-1 text-sm text-black/60">{copy.subtitle}</p>}

        {interaction.alerts.map((alert, i) => (
          <p
            key={i}
            className={`mt-3 rounded-xl p-3 text-sm ${
              alert.type === 'error'
                ? 'bg-red-50 text-red-700'
                : alert.type === 'warning'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-sky/10 text-black/70'
            }`}
          >
            {friendlyAlertMessage(alert)}
          </p>
        ))}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {fieldNames.map((name) => {
            const field = interaction.fields[name]
            const inputType = field.type === 'email' ? 'email' : field.type === 'password' ? 'password' : 'text'
            return (
              <input
                key={name}
                type={inputType}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                autoFocus
                value={values[name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            )
          })}

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
            >
              {copy.submitLabel ?? interaction.submitLabel}
            </button>
            {interaction.cancelLabel && (
              <button
                type="button"
                onClick={() => interaction.onCancel()}
                className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
              >
                {copy.cancelLabel ?? interaction.cancelLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
