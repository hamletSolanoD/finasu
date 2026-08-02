import { Link } from 'react-router-dom'
import { HomeStatusPanel } from '../components/HomeStatusPanel'
import { MonthlyReminderBanner } from '../components/MonthlyReminderBanner'
import { SmartSearch } from '../components/SmartSearch'

function HubTile({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-white/60 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-xs font-medium text-black/70">{label}</span>
    </Link>
  )
}

function Home() {
  return (
    <div>
      <SmartSearch />

      <div className="mt-4">
        <MonthlyReminderBanner />
      </div>

      <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🏠 Inicio
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
        ¿Qué quieres revisar?
      </h1>

      <HomeStatusPanel />

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <HubTile to="/gastos/escanear" icon="📷" label="Escanear" />
        <HubTile to="/gastos" icon="🧾" label="Gastos" />
        <HubTile to="/ahorro" icon="💰" label="Ahorro" />
        <HubTile to="/proyectos" icon="🛠️" label="Proyectos" />
        <HubTile to="/productos-frecuentes" icon="🛒" label="Productos" />
        <HubTile to="/tiendas" icon="🏬" label="Tiendas" />
        <HubTile to="/resumen" icon="📊" label="Resumen" />
      </div>
    </div>
  )
}

export default Home
