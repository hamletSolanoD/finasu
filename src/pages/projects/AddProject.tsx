import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { db } from '../../lib/db'

function AddProject() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [budget, setBudget] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = name.trim().length > 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')

    try {
      const id = crypto.randomUUID()

      await db.projects.add({
        id,
        name: name.trim(),
        budget: budget === '' ? null : Number(budget),
        createdAt: Date.now(),
      })

      // replace: true en vez de un push normal — si no, "/proyectos/nuevo" se
      // queda como una entrada muerta en el historial, y el atrás del
      // teléfono te devuelve al formulario vacío en vez de a la lista.
      navigate(`/proyectos/${id}`, { replace: true })
    } catch {
      setError('No se pudo guardar el proyecto. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to="/proyectos">← Proyectos</BackLink>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🛠️ Proyectos
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Nuevo proyecto</h1>
      <p className="mt-2 text-black/60">
        Crea un proyecto con presupuesto propio para llevar el control de sus gastos.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-1 text-sm text-black/60">
          Nombre del proyecto
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Pintar la casa"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-black/60">
          Presupuesto (opcional)
          <input
            type="number"
            min="0"
            step="any"
            value={budget}
            onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej. 5000"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={!canSave || saving}
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar proyecto
        </button>
      </form>
    </div>
  )
}

export default AddProject
