import { useRef, useState, type ChangeEvent } from 'react'
import { fileToResizedDataUrl } from '../lib/image'
import type { Store } from '../lib/types'
import { ChevronDownIcon } from './icons'

export const STORE_ICON_PALETTE = ['🏬', '🛒', '🏪', '🏭', '🏢', '🛍️', '⛽', '💊', '🍞', '🥩', '🧴', '🐾', '🏥', '🛠️']

/**
 * Selector de tienda estándar de la app — se usa en tickets (Gastos) y también al
 * agregar precios de productos frecuentes o de proyectos, para que todos compartan
 * el mismo registro de tiendas. Es un modal (no un desplegable flotante) a propósito:
 * más simple y confiable, sobre todo en celular.
 */
export function StorePicker({
  stores,
  value,
  onChange,
  onCreate,
  allowNone = false,
  placeholder = 'Selecciona una tienda',
}: {
  stores: Store[]
  /** '' = sin selección (o "sin tienda" si allowNone). */
  value: string
  onChange: (storeId: string) => void
  onCreate: (name: string, icon: string, image?: string) => Promise<string>
  allowNone?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(STORE_ICON_PALETTE[0])
  const [newImage, setNewImage] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = stores.find((s) => s.id === value)
  const filtered = stores.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))

  function resetCreate() {
    setCreating(false)
    setNewName('')
    setNewIcon(STORE_ICON_PALETTE[0])
    setNewImage(undefined)
  }

  function handleClose() {
    setOpen(false)
    setSearch('')
    resetCreate()
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNewImage(await fileToResizedDataUrl(file, 400, 0.85))
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await onCreate(newName.trim(), newIcon, newImage)
    onChange(id)
    handleClose()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-left text-black/80"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              {selected.image ? (
                <img src={selected.image} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
              ) : (
                <span aria-hidden>{selected.icon}</span>
              )}
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-black/40">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-black/40" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={handleClose}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-semibold">🏬 Elige una tienda</h2>

            {creating ? (
              <div className="mt-4 flex flex-col gap-3 overflow-auto">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de la tienda"
                  autoFocus
                  className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/5 text-2xl">
                    {newImage ? <img src={newImage} alt="" className="h-full w-full object-cover" /> : newIcon}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-black/15 bg-white/60 px-3 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5"
                  >
                    📷 Subir foto/logo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
                {!newImage && (
                  <div className="flex flex-wrap gap-2">
                    {STORE_ICON_PALETTE.map((icon) => (
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
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Guardar tienda
                  </button>
                  <button
                    type="button"
                    onClick={resetCreate}
                    className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar tienda..."
                  autoFocus
                  className="mt-4 rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                />

                <div className="mt-3 flex flex-col gap-1 overflow-auto">
                  {allowNone && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange('')
                        handleClose()
                      }}
                      className="rounded-lg px-3 py-2 text-left text-sm text-black/60 hover:bg-black/5"
                    >
                      Sin tienda
                    </button>
                  )}
                  {filtered.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onChange(s.id)
                        handleClose()
                      }}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                        s.id === value ? 'bg-sage/30 font-medium' : 'hover:bg-black/5'
                      }`}
                    >
                      {s.image ? (
                        <img src={s.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-lg"
                          aria-hidden
                        >
                          {s.icon}
                        </span>
                      )}
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="px-3 py-2 text-sm text-black/40">Sin resultados.</p>}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCreating(true)
                    setNewName(search)
                  }}
                  className="mt-3 rounded-full border border-black/15 bg-white/60 px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/5"
                >
                  + Agregar tienda nueva
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
