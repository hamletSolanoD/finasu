import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductCard } from '../../components/ProductCard'
import { PlusIcon } from '../../components/icons'
import { findExistingCategoryId, ICON_PALETTE } from '../../lib/categories'
import { db } from '../../lib/db'
import { MAX_FAVORITES } from '../../lib/products'
import type { Product } from '../../lib/types'

function FavoriteTile({ product }: { product: Product }) {
  return (
    <Link
      to={`/productos-frecuentes/${product.id}`}
      className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <div className="h-20 w-20 overflow-hidden rounded-2xl border border-black/10 bg-white/60">
        {product.image && (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        )}
      </div>
      <p className="line-clamp-2 text-xs font-medium text-black/70">{product.name}</p>
    </Link>
  )
}

function ProductsList() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState(ICON_PALETTE[0])
  const touchState = useRef<{ startX: number; startY: number; skip: boolean } | null>(null)

  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])
  const priceEntries = useLiveQuery(() => db.priceEntries.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  const favorites = (products ?? []).filter((p) => p.favorite).slice(0, MAX_FAVORITES)

  const filtered = (products ?? [])
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((p) => !selectedCategoryId || p.categoryId === selectedCategoryId)

  function handleTouchStart(e: TouchEvent) {
    const target = e.target as HTMLElement
    const skip = Boolean(target.closest('.overflow-x-auto'))
    const touch = e.touches[0]
    touchState.current = { startX: touch.clientX, startY: touch.clientY, skip }
  }

  function handleTouchEnd(e: TouchEvent) {
    const state = touchState.current
    touchState.current = null
    if (!state || state.skip) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - state.startX
    const dy = touch.clientY - state.startY
    if (dx < -80 && Math.abs(dx) > Math.abs(dy) * 2) navigate('/')
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const existingId = findExistingCategoryId(categories ?? [], newCategoryName)
    if (!existingId) {
      await db.categories.add({ id: crypto.randomUUID(), name: newCategoryName.trim(), icon: newCategoryIcon })
    }
    setCreatingCategory(false)
    setNewCategoryName('')
    setNewCategoryIcon(ICON_PALETTE[0])
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Link to="/" className="text-sm text-black/50 hover:text-black/70">
        ← Inicio
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
            🛒 Productos frecuentes
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Lo que compras siempre</h1>
        </div>
        <Link
          to="/productos-frecuentes/nuevo"
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          + Agregar producto
        </Link>
      </div>

      {favorites.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-black/50">★ Favoritos</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {favorites.map((product) => (
              <FavoriteTile key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar producto..."
        className="mt-6 w-full rounded-xl border border-black/15 bg-white/70 px-4 py-2.5 text-black/80 placeholder:text-black/35"
      />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setCreatingCategory((v) => !v)}
          className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${
            creatingCategory ? 'border-sage bg-sage/30' : 'border-dashed border-black/20 bg-white/60 hover:bg-black/5'
          }`}
        >
          <PlusIcon className="h-5 w-5 text-black/50" />
          <span className="line-clamp-1 text-xs font-medium text-black/70">Categoría</span>
        </button>

        {(categories ?? []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(categories ?? []).map((category) => (
              <CategoryTile
                key={category.id}
                icon={category.icon}
                name={category.name}
                active={selectedCategoryId === category.id}
                onClick={() => setSelectedCategoryId(category.id === selectedCategoryId ? null : category.id)}
              />
            ))}
          </div>
        )}
      </div>

      {creatingCategory && (
        <form
          onSubmit={handleCreateCategory}
          className="mt-3 flex flex-col gap-3 rounded-xl border border-black/15 bg-white/70 p-3"
        >
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-black/80"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {ICON_PALETTE.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setNewCategoryIcon(icon)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                  icon === newCategoryIcon ? 'bg-sage' : 'bg-black/5 hover:bg-black/10'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Crear categoría
            </button>
            <button
              type="button"
              onClick={() => setCreatingCategory(false)}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-black/50 hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {products === undefined ? null : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          {products.length === 0
            ? 'Aún no agregas productos frecuentes. Empieza con algo que compres siempre.'
            : 'No encontramos productos con esos filtros.'}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              entries={(priceEntries ?? []).filter((e) => e.productId === product.id)}
              category={categoryById.get(product.categoryId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryTile({
  icon,
  name,
  active,
  onClick,
}: {
  icon: string
  name: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${
        active ? 'border-sage bg-sage/30' : 'border-black/10 bg-white/60 hover:bg-black/5'
      }`}
    >
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <span className="line-clamp-1 text-xs font-medium text-black/70">{name}</span>
    </button>
  )
}

export default ProductsList
