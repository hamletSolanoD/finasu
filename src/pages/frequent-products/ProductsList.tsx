import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type FormEvent, type MouseEvent, type TouchEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { PlusIcon, StarIcon } from '../../components/icons'
import { findExistingCategoryId, ICON_PALETTE } from '../../lib/categories'
import { db } from '../../lib/db'
import { MAX_FAVORITES, toggleProductFavorite } from '../../lib/products'
import type { Category, PriceEntry, Product } from '../../lib/types'
import { displayUnitPrice, formatCurrency } from '../../lib/units'

/**
 * Tarjeta de la lista: muestra el precio COMPLETO de la mejor entrada ("$45.50
 * en Soriana"), no el precio unitario — las comparaciones unitarias viven en el
 * detalle del producto, que es donde sí sirven.
 */
function ProductListCard({
  product,
  entries,
  category,
}: {
  product: Product
  entries: PriceEntry[]
  category?: Category
}) {
  // Mejor entrada: la más barata por contenido real (packs por pieza incluidos);
  // en empate de precio unitario, la más reciente.
  const best = entries
    .map((e) => ({
      entry: e,
      unitPrice: displayUnitPrice(e.price, e.amount, e.unit, e.amountPerPiece, e.pieceUnit),
    }))
    .sort((a, b) => a.unitPrice.value - b.unitPrice.value || b.entry.date - a.entry.date)[0]

  async function toggleFavorite(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ok = await toggleProductFavorite(product.id, product.favorite)
    if (!ok) alert(`Ya tienes ${MAX_FAVORITES} productos favoritos. Quita alguno para agregar otro.`)
  }

  return (
    <Link
      to={`/productos-frecuentes/${product.id}`}
      className="relative flex gap-4 rounded-2xl border border-black/10 bg-white/60 p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <button
        type="button"
        onClick={toggleFavorite}
        aria-label={product.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        className={`absolute right-3 top-3 hover:opacity-70 ${product.favorite ? 'text-sage' : 'text-black/30'}`}
      >
        <StarIcon filled={product.favorite} className="h-5 w-5" />
      </button>
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5">
        {product.image && (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 pr-6">
        <div className="flex items-center gap-1.5">
          {category && <span aria-hidden>{category.icon}</span>}
          <h3 className="truncate font-display font-semibold">{product.name}</h3>
        </div>
        {best ? (
          <p className="mt-1 text-sm text-black/70">
            <span className="font-semibold">{formatCurrency(best.entry.price)}</span>{' '}
            <span className="text-black/45">en {best.entry.store}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-black/40">Sin precios registrados</p>
        )}
      </div>
    </Link>
  )
}

/** Tarjeta de producto guardado sin ningún precio todavía — invita a completarlo. */
function PendingProductCard({ product, category }: { product: Product; category?: Category }) {
  return (
    <Link
      to={`/productos-frecuentes/${product.id}`}
      className="flex gap-4 rounded-2xl border border-dashed border-black/25 bg-white/40 p-4 transition hover:-translate-y-0.5 hover:bg-white/60"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5">
        {product.image && (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {category && <span aria-hidden>{category.icon}</span>}
          <h3 className="truncate font-display font-semibold">{product.name}</h3>
        </div>
        <p className="mt-1 text-sm text-black/50">Falta precio y tienda — tócalo para completarlo</p>
      </div>
    </Link>
  )
}

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

  const entriesByProduct = new Map<string, PriceEntry[]>()
  for (const entry of priceEntries ?? []) {
    const list = entriesByProduct.get(entry.productId)
    if (list) list.push(entry)
    else entriesByProduct.set(entry.productId, [entry])
  }
  // Productos guardados sin ningún precio todavía — van apartados en "Por completar".
  const pending = filtered.filter((p) => !entriesByProduct.has(p.id))
  const withPrices = filtered.filter((p) => entriesByProduct.has(p.id))

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
      <BackLink to="/">← Inicio</BackLink>

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

      {products === undefined || priceEntries === undefined ? null : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center text-black/50">
          {products.length === 0
            ? 'Aún no agregas productos frecuentes. Empieza con algo que compres siempre.'
            : 'No encontramos productos con esos filtros.'}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-black/50">🕗 Por completar</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pending.map((product) => (
                  <PendingProductCard
                    key={product.id}
                    product={product}
                    category={categoryById.get(product.categoryId)}
                  />
                ))}
              </div>
            </div>
          )}
          {withPrices.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {withPrices.map((product) => (
                <ProductListCard
                  key={product.id}
                  product={product}
                  entries={entriesByProduct.get(product.id) ?? []}
                  category={categoryById.get(product.categoryId)}
                />
              ))}
            </div>
          )}
        </>
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
