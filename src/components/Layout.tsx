import { useLiveQuery, useObservable } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { db } from '../lib/db'
import { AuthModal } from './AuthModal'
import { OnboardingTour } from './OnboardingTour'

const links = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/gastos', label: 'Gastos', icon: '🧾' },
  { to: '/ahorro', label: 'Ahorro', icon: '💰' },
  { to: '/proyectos', label: 'Proyectos', icon: '🛠️' },
  { to: '/productos-frecuentes', label: 'Productos frecuentes', icon: '🛒' },
  { to: '/tiendas', label: 'Tiendas', icon: '🏬' },
  { to: '/resumen', label: 'Resumen', icon: '📊' },
]

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const settings = useLiveQuery(() => db.settings.get('default'), [])
  const currentUser = useObservable(db.cloud.currentUser)
  const isLoggedIn = Boolean(currentUser?.isLoggedIn)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [nameLoadedFor, setNameLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Instalaciones nuevas (hasSeenOnboarding: false) ven el tour una sola vez, automáticamente.
  useEffect(() => {
    if (settings && !settings.hasSeenOnboarding) setTourOpen(true)
  }, [settings])

  // Recarga el nombre cada vez que cambia de usuario (login/logout/otra cuenta),
  // no solo la primera vez — cada cuenta tiene su propio settings.displayName.
  useEffect(() => {
    if (settings && nameLoadedFor !== (currentUser?.userId ?? null)) {
      setDisplayNameDraft(settings.displayName)
      setNameLoadedFor(currentUser?.userId ?? null)
    }
  }, [settings, currentUser?.userId, nameLoadedFor])

  async function handleCloseTour() {
    setTourOpen(false)
    await db.settings.update('default', { hasSeenOnboarding: true })
  }

  // La confirmación (si hay cambios sin sincronizar) la maneja Dexie Cloud solo,
  // mostrándose a través de <AuthModal /> — no hace falta un confirm() propio aquí.
  async function handleAuthClick() {
    if (isLoggedIn) {
      await db.cloud.logout()
    } else {
      await db.cloud.login()
    }
  }

  async function handleSaveName() {
    await db.settings.update('default', { displayName: displayNameDraft.trim() })
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-black/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-12">
          <NavLink to="/" className="font-display text-lg font-semibold tracking-tight">
            Finasu
          </NavLink>

          <div className="flex items-center gap-1">
            <nav className="hidden gap-1 sm:flex">
              {links
                .filter((link) => link.to !== '/resumen')
                .map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        isActive ? 'bg-sage/70 text-black/80' : 'text-black/55 hover:bg-black/5'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
            </nav>

            <button
              type="button"
              onClick={() => setTourOpen(true)}
              aria-label="Ver tour de bienvenida"
              title="Ver tour"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-black/55 transition hover:bg-black/5"
            >
              🎓
            </button>

            <button
              type="button"
              onClick={handleAuthClick}
              aria-label={isLoggedIn ? `Cerrar sesión (${currentUser?.email ?? ''})` : 'Iniciar sesión'}
              title={isLoggedIn ? `Sesión iniciada: ${currentUser?.email ?? ''}` : 'Iniciar sesión / sincronizar'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-black/55 transition hover:bg-black/5"
            >
              {isLoggedIn ? '👤' : '🔑'}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-black/70 transition hover:bg-black/5 sm:hidden"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 sm:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[80vw] flex-col bg-cream shadow-xl transition-transform duration-300 sm:hidden ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
          <span className="font-display text-lg font-semibold">Menú</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-black/70 transition hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-black/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-black/40">Mi cuenta</p>
          {isLoggedIn ? (
            <>
              <p className="mt-1 truncate text-sm text-black/70">{currentUser?.email}</p>
              <label className="mt-3 flex flex-col gap-1 text-xs text-black/50">
                Tu nombre
                <div className="flex gap-2">
                  <input
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    placeholder="¿Cómo te llamas?"
                    className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white/70 px-2 py-1.5 text-sm text-black/80"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="shrink-0 rounded-lg bg-sage px-3 py-1.5 text-xs font-semibold text-black/80 hover:brightness-95"
                  >
                    Guardar
                  </button>
                </div>
              </label>
              <button
                type="button"
                onClick={handleAuthClick}
                className="mt-3 text-xs font-medium text-black/50 underline hover:text-black/70"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-black/60">
                Aún no has iniciado sesión — tus datos solo están guardados en este dispositivo.
              </p>
              <button
                type="button"
                onClick={handleAuthClick}
                className="mt-3 rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 hover:brightness-95"
              >
                🔑 Iniciar sesión
              </button>
            </>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-sage/70 text-black/80' : 'text-black/65 hover:bg-black/5'
                }`
              }
            >
              <span className="text-lg" aria-hidden>
                {link.icon}
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-12">
        <Outlet />
      </main>

      <OnboardingTour open={tourOpen} onClose={handleCloseTour} />
      <AuthModal />
    </div>
  )
}
