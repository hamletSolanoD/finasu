import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SwipeableRow } from '../../components/SwipeableRow'
import { computeBudgetState } from '../../lib/budget'
import { db } from '../../lib/db'
import { bestPriceFor, computeProjectEstimate } from '../../lib/projects'
import { capitalizeStoreName } from '../../lib/text'
import type { ProjectItem, ProjectPriceEntry } from '../../lib/types'
import { formatCurrency } from '../../lib/units'

function ProjectNameField({ projectId, name }: { projectId: string; name: string }) {
  const [value, setValue] = useState(name)

  useEffect(() => {
    setValue(name)
  }, [name])

  async function handleBlur() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) {
      await db.projects.update(projectId, { name: trimmed })
    } else {
      setValue(name)
    }
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className="w-full rounded-lg border border-transparent bg-transparent font-display text-2xl font-semibold text-black/90 transition focus:border-black/15 focus:bg-white/70 focus:px-2 focus:py-1 focus:outline-none"
    />
  )
}

function EstimateProgress({ estimate, budget }: { estimate: number; budget: number }) {
  const { remaining, percentUsed, isOver, isClose } = computeBudgetState(estimate, budget)
  const barColor = isOver ? 'bg-red-400' : isClose ? 'bg-amber-400' : 'bg-sage'
  const textColor = isOver ? 'text-red-700' : isClose ? 'text-amber-700' : 'text-black/50'

  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, percentUsed)}%` }} />
      </div>
      <p className={`mt-1 text-xs ${textColor}`}>
        {formatCurrency(estimate)} de {formatCurrency(budget)} estimado
        {isOver
          ? ` · te pasas por ${formatCurrency(Math.abs(remaining))}`
          : ` · quedan ${formatCurrency(remaining)}`}
      </p>
    </div>
  )
}

function ProjectItemCard({
  item,
  entries,
  isExpanded,
  onToggleExpand,
}: {
  item: ProjectItem
  entries: ProjectPriceEntry[]
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const [store, setStore] = useState('')
  const [price, setPrice] = useState<number | ''>('')

  const best = bestPriceFor(item.id, entries)
  const ranked = entries.slice().sort((a, b) => a.price - b.price)

  async function handleTogglePurchased() {
    await db.projectItems.update(item.id, { purchased: !item.purchased })
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault()
    if (!store.trim() || price === '' || price <= 0) return

    await db.projectPriceEntries.add({
      id: crypto.randomUUID(),
      projectItemId: item.id,
      store: capitalizeStoreName(store),
      price: Number(price),
      date: Date.now(),
    })
    setStore('')
    setPrice('')
  }

  async function handleDeleteEntry(entryId: string) {
    await db.projectPriceEntries.delete(entryId)
  }

  async function handleDeleteItem() {
    if (!confirm(`¿Eliminar "${item.name}" y sus precios registrados?`)) return
    await db.transaction('rw', db.projectItems, db.projectPriceEntries, async () => {
      await db.projectPriceEntries.where('projectItemId').equals(item.id).delete()
      await db.projectItems.delete(item.id)
    })
  }

  return (
    <li>
      <SwipeableRow onDelete={handleDeleteItem}>
        <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/60 p-3">
          <input
            type="checkbox"
            checked={item.purchased}
            onChange={handleTogglePurchased}
            className="h-5 w-5 shrink-0 rounded border-black/20 accent-sage"
            aria-label="Comprado"
          />
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${item.purchased ? 'text-black/40 line-through' : ''}`}>{item.name}</p>
            <p className="text-xs text-black/50">
              {best ? `${formatCurrency(best.price)} en ${best.store}` : 'Sin precio todavía'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 text-xs font-medium text-black/50 underline hover:text-black/70"
          >
            {isExpanded ? 'Ocultar precios' : 'Ver precios'}
          </button>
        </div>
      </SwipeableRow>

      {isExpanded && (
        <div className="mt-3 border-t border-black/10 pt-3">
          {ranked.length === 0 ? (
            <p className="text-sm text-black/50">Aún no hay precios registrados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ranked.map((entry, i) => (
                <li key={entry.id}>
                  <SwipeableRow onDelete={() => handleDeleteEntry(entry.id)}>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-3 ${
                        i === 0 ? 'border-sage bg-sage/20' : 'border-black/10 bg-white/50'
                      }`}
                    >
                      <p className="font-medium">
                        {entry.store}
                        {i === 0 && (
                          <span className="ml-2 rounded-full bg-sage px-2 py-0.5 text-xs font-semibold">
                            Mejor precio
                          </span>
                        )}
                      </p>
                      <p className="text-sm font-semibold">{formatCurrency(entry.price)}</p>
                    </div>
                  </SwipeableRow>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddEntry} className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-black/60">
                Tienda
                <input
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  placeholder="Ej. Home Depot"
                  className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-black/60">
                Precio
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                />
              </label>
            </div>
            <button
              type="submit"
              className="self-start rounded-full bg-sky px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
            >
              Agregar precio
            </button>
          </form>
        </div>
      )}
    </li>
  )
}

/** Presupuesto máximo cubierto por el slider — cómodo para proyectos personales reales. */
const BUDGET_SLIDER_MAX = 50000
const BUDGET_SLIDER_STEP = 100

function ProjectDetail() {
  const { id } = useParams<{ id: string }>()

  const project = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
  const items = useLiveQuery(() => (id ? db.projectItems.where('projectId').equals(id).toArray() : []), [id]) ?? []
  const allEntries = useLiveQuery(() => db.projectPriceEntries.toArray(), []) ?? []

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [newItemName, setNewItemName] = useState('')

  if (!project) return null

  const itemIds = new Set(items.map((i) => i.id))
  const entries = allEntries.filter((e) => itemIds.has(e.projectItemId))
  const estimate = computeProjectEstimate(items, entries)

  function toggleExpand(itemId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return
    await db.projectItems.add({
      id: crypto.randomUUID(),
      projectId: project!.id,
      name: newItemName.trim(),
      purchased: false,
      createdAt: Date.now(),
    })
    setNewItemName('')
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/proyectos" className="text-sm text-black/50 hover:text-black/70">
        ← Proyectos
      </Link>

      <div className="mt-4">
        <ProjectNameField projectId={project.id} name={project.name} />
        <div className="mt-2 flex items-center justify-between text-sm text-black/60">
          <span>Presupuesto</span>
          <span className="font-semibold text-black/80">
            {project.budget !== null ? formatCurrency(project.budget) : 'Sin definir'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={BUDGET_SLIDER_MAX}
          step={BUDGET_SLIDER_STEP}
          value={project.budget ?? 0}
          onChange={(e) => db.projects.update(project.id, { budget: Number(e.target.value) })}
          className="mt-2 w-full accent-sage"
          aria-label="Presupuesto"
        />
      </div>

      <section className="mt-6 rounded-2xl border border-black/10 bg-white/50 p-4">
        <p className="text-sm text-black/60">
          Estimado: <span className="font-semibold text-black/80">{formatCurrency(estimate)}</span>
        </p>
        {project.budget !== null && <EstimateProgress estimate={estimate} budget={project.budget} />}
      </section>

      <section className="mt-8">
        <h2 className="font-display font-semibold">Artículos</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">Aún no agregas ningún artículo.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {items.map((item) => (
              <ProjectItemCard
                key={item.id}
                item={item}
                entries={entries.filter((e) => e.projectItemId === item.id)}
                isExpanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
              />
            ))}
          </ul>
        )}

        <form onSubmit={handleAddItem} className="mt-4 flex gap-2">
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Ej. Pintura blanca 19L, Ej. Brochas"
            className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-sky px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            + Agregar artículo
          </button>
        </form>
      </section>
    </div>
  )
}

export default ProjectDetail
