import { useState } from 'react'
import { Dropdown } from './Dropdown'

const NEW_CATEGORY = '__new__'

interface CategoryLike {
  id: string
  name: string
  icon: string
}

/**
 * Desplegable de categoría estándar de la app — sirve tanto para categorías de
 * productos frecuentes como de gasto (o cualquier otra lista con id/name/icon).
 * Cada dominio le pasa su propia paleta de iconos y su propio onCreate.
 */
export function CategoryDropdown<T extends CategoryLike>({
  categories,
  value,
  onChange,
  onCreate,
  iconPalette,
  allowNone = false,
  placeholder = 'Selecciona una categoría',
}: {
  categories: T[]
  /** '' = sin selección (o "sin categoría" si allowNone). */
  value: string
  onChange: (categoryId: string) => void
  onCreate: (name: string, icon: string) => Promise<string>
  iconPalette: string[]
  allowNone?: boolean
  placeholder?: string
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(iconPalette[0])

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await onCreate(newName.trim(), newIcon)
    onChange(id)
    setCreating(false)
    setNewName('')
    setNewIcon(iconPalette[0])
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-black/15 bg-white/70 p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la categoría"
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-black/80"
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          {iconPalette.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setNewIcon(icon)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                icon === newIcon ? 'bg-sage' : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Crear categoría
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const options = [
    ...(allowNone ? [{ value: '', label: 'Sin categoría' }] : []),
    ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
    { value: NEW_CATEGORY, label: '+ Crear categoría nueva' },
  ]

  return (
    <Dropdown
      value={value}
      options={options}
      onChange={(v) => {
        if (v === NEW_CATEGORY) setCreating(true)
        else onChange(v)
      }}
      placeholder={placeholder}
    />
  )
}
