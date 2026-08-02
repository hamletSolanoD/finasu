import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { SwipeableRow } from '../../components/SwipeableRow'
import { computeBudgetState } from '../../lib/budget'
import { db } from '../../lib/db'
import { computeProjectEstimate } from '../../lib/projects'
import type { Project, ProjectItem, ProjectPriceEntry } from '../../lib/types'
import { formatCurrency } from '../../lib/units'

async function handleDeleteProject(projectId: string, projectName: string) {
  if (!confirm(`¿Eliminar el proyecto "${projectName}" y todos sus artículos?`)) return
  await db.transaction('rw', db.projects, db.projectItems, db.projectPriceEntries, async () => {
    const items = await db.projectItems.where('projectId').equals(projectId).toArray()
    const itemIds = items.map((i) => i.id)
    await db.projectPriceEntries.where('projectItemId').anyOf(itemIds).delete()
    await db.projectItems.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}

function BudgetProgress({ estimate, budget }: { estimate: number; budget: number | null }) {
  if (budget === null) {
    return <p className="mt-2 text-xs text-black/45">Estimado: {formatCurrency(estimate)}, sin presupuesto definido</p>
  }

  const { remaining, percentUsed, isOver, isClose } = computeBudgetState(estimate, budget)
  const barColor = isOver ? 'bg-red-400' : isClose ? 'bg-amber-400' : 'bg-sage'
  const textColor = isOver ? 'text-red-700' : isClose ? 'text-amber-700' : 'text-black/50'

  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, percentUsed)}%` }} />
      </div>
      <p className={`mt-1 text-xs ${textColor}`}>
        {formatCurrency(estimate)} de {formatCurrency(budget)}
        {isOver
          ? ` · te pasaste por ${formatCurrency(Math.abs(remaining))}`
          : ` · quedan ${formatCurrency(remaining)}`}
      </p>
    </div>
  )
}

function ProjectCard({
  project,
  items,
  entries,
}: {
  project: Project
  items: ProjectItem[]
  entries: ProjectPriceEntry[]
}) {
  const projectItems = items.filter((i) => i.projectId === project.id)
  const itemIds = new Set(projectItems.map((i) => i.id))
  const projectEntries = entries.filter((e) => itemIds.has(e.projectItemId))
  const estimate = computeProjectEstimate(projectItems, projectEntries)

  return (
    <SwipeableRow onDelete={() => handleDeleteProject(project.id, project.name)}>
      <Link
        to={`/proyectos/${project.id}`}
        className="block rounded-2xl border border-black/10 bg-white/60 p-4 transition hover:bg-white/80"
      >
        <span className="font-display font-semibold text-black/80">{project.name}</span>
        <BudgetProgress estimate={estimate} budget={project.budget} />
      </Link>
    </SwipeableRow>
  )
}

function ProjectsList() {
  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const items = useLiveQuery(() => db.projectItems.toArray(), [])
  const entries = useLiveQuery(() => db.projectPriceEntries.toArray(), [])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🛠️ Proyectos</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Tus proyectos</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/tiendas" className="text-sm text-black/50 hover:text-black/70">
            🏬 Tiendas →
          </Link>
          <Link
            to="/proyectos/nuevo"
            className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            + Nuevo proyecto
          </Link>
        </div>
      </div>

      {projects === undefined ? null : projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Aún no tienes proyectos. Crea uno para empezar a planear tu presupuesto.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} items={items ?? []} entries={entries ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectsList
