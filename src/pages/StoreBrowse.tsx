import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { STORE_ICON_PALETTE } from '../components/StorePicker'
import { useConfirm } from '../components/ConfirmModal'
import { db } from '../lib/db'
import { fileToResizedDataUrl } from '../lib/image'
import { bestPriceFor } from '../lib/projects'
import { findExistingStoreId } from '../lib/stores'
import type { Store } from '../lib/types'
import { displayUnitPrice, formatCurrency, formatUnitPrice } from '../lib/units'

/** Modal de alta/edición de una tienda registrada — mismo formulario que usa StorePicker
 * al crear una tienda nueva, reutilizado aquí para poder también editar una existente. */
function StoreFormModal({
  store,
  existingStores,
  onClose,
}: {
  /** null = modo creación. */
  store: Store | null
  existingStores: Store[]
  onClose: () => void
}) {
  const confirm = useConfirm()
  const [name, setName] = useState(store?.name ?? '')
  const [icon, setIcon] = useState(store?.icon ?? STORE_ICON_PALETTE[0])
  const [image, setImage] = useState<string | undefined>(store?.image)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(await fileToResizedDataUrl(file, 400, 0.85))
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return

    if (store) {
      await db.stores.update(store.id, { name: trimmed, icon, image })
      onClose()
      return
    }

    const duplicateId = findExistingStoreId(existingStores, trimmed)
    if (duplicateId) {
      alert(`Ya existe una tienda llamada "${trimmed}".`)
      return
    }
    await db.stores.add({ id: crypto.randomUUID(), name: trimmed, icon, image, createdAt: Date.now() })
    onClose()
  }

  async function handleDelete() {
    if (!store) return
    const ok = await confirm({
      title: `¿Eliminar la tienda "${store.name}"?`,
      body: 'Esto no borra los precios ni tickets que ya tengan ese nombre, solo el registro de la tienda.',
    })
    if (!ok) return
    await db.stores.delete(store.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">{store ? '✏️ Editar tienda' : '🏬 Agregar tienda'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la tienda"
            autoFocus
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/5 text-2xl">
              {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : icon}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-black/15 bg-white/60 px-3 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5"
            >
              📷 Subir foto/logo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          {image ? (
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="self-start text-xs font-medium text-black/50 underline hover:text-black/70"
            >
              Quitar foto y usar ícono
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {STORE_ICON_PALETTE.map((paletteIcon) => (
                <button
                  key={paletteIcon}
                  type="button"
                  onClick={() => setIcon(paletteIcon)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                    paletteIcon === icon ? 'bg-sage' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  {paletteIcon}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar tienda
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
          {store && (
            <button
              type="button"
              onClick={handleDelete}
              className="mt-1 self-start rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              🗑️ Eliminar tienda
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Sección de arriba: el registro formal de tiendas (alta/edición/borrado). Es independiente
 * de la vista derivada de abajo, que sigue agrupando por el string suelto `store` de
 * priceEntries/projectPriceEntries — ese sistema no se toca. */
function RegisteredStoresSection({
  onSelectStore,
  activeStoreName,
  noPricesStoreName,
}: {
  /** Se llama al tocar una tarjeta — el padre decide qué mostrar abajo. */
  onSelectStore: (store: Store) => void
  /** Nombre de la tienda activa (para resaltar su tarjeta) — match case-insensitive. */
  activeStoreName: string | null
  /** Si la tienda tocada no tiene precios registrados, su nombre — para el mensaje suave. */
  noPricesStoreName: string | null
}) {
  const stores = useLiveQuery(() => db.stores.orderBy('name').toArray(), [])
  const [editingStore, setEditingStore] = useState<Store | null | 'new'>(null)

  if (!stores) return null

  return (
    <div>
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">🏬 Tus tiendas</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Tus tiendas registradas</h1>
      <p className="mt-2 max-w-lg text-black/60">
        Da de alta las tiendas donde compras, con su ícono o logo — así aparecen listas para elegir al registrar
        precios y tickets.
      </p>

      <div className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
        {stores.map((store) => {
          const isActive =
            activeStoreName !== null && store.name.trim().toLowerCase() === activeStoreName.trim().toLowerCase()
          return (
            <div key={store.id} className="relative shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onSelectStore(store)}
                className={`flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-2xl border bg-white/60 p-2 transition hover:-translate-y-0.5 hover:shadow-sm ${
                  isActive ? 'border-sage ring-2 ring-sage/40' : 'border-black/10'
                }`}
              >
                {store.image ? (
                  <img src={store.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/5 text-3xl"
                    aria-hidden
                  >
                    {store.icon}
                  </span>
                )}
                <span className="w-full truncate text-center text-xs font-medium">{store.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingStore(store)}
                aria-label={`Editar ${store.name}`}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs shadow-sm transition hover:bg-white"
              >
                ✏️
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setEditingStore('new')}
          className="flex h-28 w-28 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-black/20 bg-white/40 text-black/50 transition hover:bg-black/5"
        >
          <span className="text-2xl" aria-hidden>
            ＋
          </span>
          <span className="text-xs font-medium">Agregar tienda</span>
        </button>
      </div>

      {noPricesStoreName && (
        <p className="mt-2 text-sm text-black/50">Aún no hay precios registrados en esta tienda.</p>
      )}

      {editingStore && (
        <StoreFormModal
          store={editingStore === 'new' ? null : editingStore}
          existingStores={stores}
          onClose={() => setEditingStore(null)}
        />
      )}
    </div>
  )
}

function StoreBrowse() {
  const products = useLiveQuery(() => db.products.toArray(), [])
  const priceEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const projectItems = useLiveQuery(() => db.projectItems.toArray(), [])
  const projectPriceEntries = useLiveQuery(() => db.projectPriceEntries.toArray(), [])
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  /** Tienda registrada tocada que aún no tiene precios en priceEntries — para el mensaje suave. */
  const [noPricesStore, setNoPricesStore] = useState<string | null>(null)

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  )
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  )

  const bestPerProduct = useMemo(() => {
    if (!products || !priceEntries) return []
    return products
      .map((product) => {
        const entries = priceEntries.filter((e) => e.productId === product.id)
        const best = entries
          .map((e) => ({ entry: e, unitPrice: displayUnitPrice(e.price, e.amount, e.unit) }))
          .sort((a, b) => a.unitPrice.value - b.unitPrice.value)[0]
        return best ? { product, ...best } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [products, priceEntries])

  const bestPerProjectItem = useMemo(() => {
    if (!projectItems || !projectPriceEntries) return []
    return projectItems
      .filter((item) => !item.purchased)
      .map((item) => {
        const best = bestPriceFor(item.id, projectPriceEntries)
        return best ? { item, entry: best } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [projectItems, projectPriceEntries])

  const storeCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const { entry } of bestPerProduct) {
      map.set(entry.store, (map.get(entry.store) ?? 0) + 1)
    }
    for (const { entry } of bestPerProjectItem) {
      map.set(entry.store, (map.get(entry.store) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [bestPerProduct, bestPerProjectItem])

  const onlineStores = useMemo(() => {
    const set = new Set<string>()
    for (const entry of priceEntries ?? []) {
      if (entry.isOnline) set.add(entry.store)
    }
    return set
  }, [priceEntries])

  const productsForStore = bestPerProduct.filter((x) => x.entry.store === selectedStore)
  const projectItemsForStore = bestPerProjectItem.filter((x) => x.entry.store === selectedStore)

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, typeof productsForStore>()
    for (const item of productsForStore) {
      const key = item.product.categoryId ?? ''
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...groups.entries()]
      .map(([categoryId, items]) => ({ category: categoryById.get(categoryId), items }))
      .sort((a, b) => (a.category?.name ?? 'zzz').localeCompare(b.category?.name ?? 'zzz'))
  }, [productsForStore, categoryById])

  const groupedByProject = useMemo(() => {
    const groups = new Map<string, typeof projectItemsForStore>()
    for (const item of projectItemsForStore) {
      const key = item.item.projectId
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...groups.entries()]
      .map(([projectId, items]) => ({ project: projectById.get(projectId), projectId, items }))
      .sort((a, b) => (a.project?.name ?? 'zzz').localeCompare(b.project?.name ?? 'zzz'))
  }, [projectItemsForStore, projectById])

  const hasResultsForStore = groupedByCategory.length > 0 || groupedByProject.length > 0

  /** Al tocar una tienda registrada: se busca su nombre (case-insensitive) entre las tiendas
   * con precios; si hay match se selecciona esa para mostrar qué comprar ahí, y si no,
   * se avisa suavecito que aún no tiene precios. */
  function handleSelectRegisteredStore(store: Store) {
    const match = storeCounts.find(([name]) => name.trim().toLowerCase() === store.name.trim().toLowerCase())
    if (match) {
      setNoPricesStore(null)
      setSelectedStore(match[0] === selectedStore ? null : match[0])
    } else {
      setSelectedStore(null)
      setNoPricesStore(noPricesStore === store.name ? null : store.name)
    }
  }

  return (
    <div>
      <RegisteredStoresSection
        onSelectStore={handleSelectRegisteredStore}
        activeStoreName={selectedStore ?? noPricesStore}
        noPricesStoreName={noPricesStore}
      />

      <div className="mt-10 border-t border-dashed border-black/15 pt-8">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
          🏬 Tiendas
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Qué comprar en cada tienda</h1>
      <p className="mt-2 max-w-lg text-black/60">
        Según tus precios registrados, esto es lo que te conviene comprar en cada tienda — tanto tus productos
        frecuentes como los artículos de tus proyectos.
      </p>

      {storeCounts.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          Aún no hay tiendas registradas. Agrega precios desde tus productos frecuentes o tus proyectos.
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {storeCounts.map(([store, count]) => {
              const isOnline = onlineStores.has(store)
              return (
                <button
                  key={store}
                  onClick={() => {
                    setNoPricesStore(null)
                    setSelectedStore(store === selectedStore ? null : store)
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedStore === store
                      ? 'bg-sky text-black/80'
                      : isOnline
                        ? 'border border-sky bg-sky/15 text-black/70 hover:bg-sky/25'
                        : 'border border-black/15 bg-white/60 text-black/60 hover:bg-black/5'
                  }`}
                >
                  {isOnline && <span aria-hidden>🌐 </span>}
                  {store} · {count}
                </button>
              )
            })}
          </div>

          {selectedStore && (
            <div className="mt-6 flex flex-col gap-8">
              {groupedByCategory.length > 0 && (
                <div>
                  <h2 className="mb-3 font-display font-semibold">🛒 Productos frecuentes</h2>
                  <div className="flex flex-col gap-6">
                    {groupedByCategory.map(({ category, items }) => (
                      <section key={category?.id ?? 'sin-categoria'}>
                        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-black/50">
                          {category ? (
                            <>
                              <span aria-hidden>{category.icon}</span>
                              {category.name}
                            </>
                          ) : (
                            'Sin categoría'
                          )}
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {items.map(({ product, entry, unitPrice }) => (
                            <li key={product.id}>
                              <Link
                                to={`/productos-frecuentes/${product.id}`}
                                className="flex items-center justify-between rounded-xl border border-black/10 bg-white/60 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5">
                                    {product.image && (
                                      <img src={product.image} alt="" className="h-full w-full object-cover" />
                                    )}
                                  </div>
                                  <p className="font-medium">{product.name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold">
                                    {formatCurrency(entry.price)}
                                    <span className="text-black/40"> en {entry.store}</span>
                                  </p>
                                  <p className="text-xs text-black/40">
                                    {formatUnitPrice(unitPrice.value, unitPrice.label)}
                                    {unitPrice.label}
                                  </p>
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              )}

              {groupedByProject.length > 0 && (
                <div>
                  <h2 className="mb-3 font-display font-semibold">🛠️ Proyectos</h2>
                  <p className="mb-3 -mt-2 text-xs text-black/45">
                    No son productos necesarios como los de arriba — son cosas de tus proyectos que podrías ir
                    comprando de a poco.
                  </p>
                  <div className="flex flex-col gap-6">
                    {groupedByProject.map(({ project, projectId, items }) => (
                      <section key={projectId}>
                        <h3 className="mb-2 text-sm font-semibold text-black/50">
                          {project ? project.name : 'Sin proyecto'}
                        </h3>
                        <ul className="flex flex-col gap-2">
                          {items.map(({ item, entry }) => (
                            <li key={item.id}>
                              <Link
                                to={`/proyectos/${projectId}`}
                                className="flex items-center justify-between rounded-xl border border-sky/40 bg-sky/10 p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                              >
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm font-semibold">
                                  {formatCurrency(entry.price)}
                                  <span className="text-black/40"> en {entry.store}</span>
                                </p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              )}

              {!hasResultsForStore && (
                <p className="text-sm text-black/50">No hay nada pendiente de comprar en esta tienda.</p>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}

export default StoreBrowse
