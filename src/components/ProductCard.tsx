import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { StarIcon } from './icons'
import { MAX_FAVORITES, toggleProductFavorite } from '../lib/products'
import type { Category, PriceEntry, Product } from '../lib/types'
import { displayUnitPrice, formatUnitPrice } from '../lib/units'

export function ProductCard({
  product,
  entries,
  category,
}: {
  product: Product
  entries: PriceEntry[]
  category?: Category
}) {
  const best = entries
    .map((e) => ({ entry: e, unitPrice: displayUnitPrice(e.price, e.amount, e.unit) }))
    .sort((a, b) => a.unitPrice.value - b.unitPrice.value)[0]

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
          <>
            <p className="mt-1 text-sm text-black/70">
              {formatUnitPrice(best.unitPrice.value, best.unitPrice.label)}
              <span className="text-black/40">{best.unitPrice.label}</span>
            </p>
            <p className="truncate text-xs text-black/45">Mejor precio en {best.entry.store}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-black/40">Sin precios registrados</p>
        )}
      </div>
    </Link>
  )
}
