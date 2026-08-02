import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { Dropdown } from '../../components/Dropdown'
import { ImageUploader } from '../../components/ImageUploader'
import { PencilIcon, StarIcon, TrashIcon } from '../../components/icons'
import { findExistingCategoryId, ICON_PALETTE } from '../../lib/categories'
import { db } from '../../lib/db'
import { MAX_FAVORITES, toggleProductFavorite } from '../../lib/products'
import { capitalizeStoreName } from '../../lib/text'
import type { Unit } from '../../lib/types'
import { UNITS_BY_KIND, displayUnitPrice, formatCurrency, formatUnitPrice } from '../../lib/units'

function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const product = useLiveQuery(() => (id ? db.products.get(id) : undefined), [id])
  const entries = useLiveQuery(
    () => (id ? db.priceEntries.where('productId').equals(id).toArray() : []),
    [id],
  )
  const category = useLiveQuery(
    () => (product ? db.categories.get(product.categoryId) : undefined),
    [product?.categoryId],
  )
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])

  const [store, setStore] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [amount, setAmount] = useState<number | ''>('')
  const [unit, setUnit] = useState<Unit>('g')
  const [isOnline, setIsOnline] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editImage, setEditImage] = useState<string | undefined>()
  const [editCategoryId, setEditCategoryId] = useState('')
  const [revealedEntryId, setRevealedEntryId] = useState<string | null>(null)

  if (!product) return null

  const unitOptions = UNITS_BY_KIND[product.unitKind]
  const selectedUnit = unitOptions.some((u) => u.value === unit) ? unit : unitOptions[0].value
  const ranked = (entries ?? [])
    .map((e) => ({ entry: e, unitPrice: displayUnitPrice(e.price, e.amount, e.unit) }))
    .sort((a, b) => a.unitPrice.value - b.unitPrice.value)

  function startEditing() {
    setEditName(product!.name)
    setEditImage(product!.image)
    setEditCategoryId(product!.categoryId)
    setEditing(true)
  }

  async function handleCreateCategory(categoryName: string, icon: string) {
    const existingId = findExistingCategoryId(categories ?? [], categoryName)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    await db.categories.add({ id: newId, name: categoryName.trim(), icon })
    return newId
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !editCategoryId) return
    await db.products.update(product!.id, {
      name: editName.trim(),
      image: editImage,
      categoryId: editCategoryId,
    })
    setEditing(false)
  }

  async function toggleFavorite() {
    const ok = await toggleProductFavorite(product!.id, product!.favorite)
    if (!ok) alert(`Ya tienes ${MAX_FAVORITES} productos favoritos. Quita alguno para agregar otro.`)
  }

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault()
    if (!store.trim() || price === '' || price <= 0 || amount === '' || amount <= 0) return

    await db.priceEntries.add({
      id: crypto.randomUUID(),
      productId: product!.id,
      store: capitalizeStoreName(store),
      price: Number(price),
      amount: Number(amount),
      unit: selectedUnit,
      isOnline,
      date: Date.now(),
    })
    setStore('')
    setPrice('')
    setAmount('')
    setIsOnline(false)
  }

  async function handleDeleteEntry(entryId: string) {
    await db.priceEntries.delete(entryId)
  }

  async function handleDeleteProduct() {
    if (!confirm(`¿Eliminar "${product!.name}" y todos sus precios registrados?`)) return
    await db.priceEntries.where('productId').equals(product!.id).delete()
    await db.products.delete(product!.id)
    navigate('/productos-frecuentes')
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/productos-frecuentes" className="text-sm text-black/50 hover:text-black/70">
        ← Productos frecuentes
      </Link>

      {editing ? (
        <form onSubmit={handleSaveEdit} className="mt-4 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/50 p-4">
          <ImageUploader value={editImage} onChange={setEditImage} />
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Nombre del producto
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Categoría
            {categories && (
              <CategoryDropdown
                categories={categories}
                value={editCategoryId}
                onChange={setEditCategoryId}
                onCreate={handleCreateCategory}
                iconPalette={ICON_PALETTE}
              />
            )}
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!editName.trim() || !editCategoryId}
              className="rounded-full bg-sage px-5 py-2 font-display font-semibold text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-5 py-2 text-sm font-medium text-black/50 hover:bg-black/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/5">
            {product.image && (
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            {category && (
              <p className="flex items-center gap-1.5 text-sm text-black/50">
                <span aria-hidden>{category.icon}</span>
                {category.name}
              </p>
            )}
            <h1 className="font-display text-2xl font-semibold">{product.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={product.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                className={`hover:opacity-70 ${product.favorite ? 'text-sage' : 'text-black/30'}`}
              >
                <StarIcon filled={product.favorite} className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={startEditing}
                aria-label="Editar producto"
                className="text-black/40 hover:text-black/70"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                aria-label="Eliminar producto"
                className="text-red-500 hover:text-red-700"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display font-semibold">Comparación de precios</h2>
        {ranked.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">Aún no hay precios registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {ranked.map(({ entry, unitPrice }, i) => {
              const revealed = revealedEntryId === entry.id
              return (
                <li
                  key={entry.id}
                  onClick={() => setRevealedEntryId(revealed ? null : entry.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                    i === 0 ? 'border-sage bg-sage/20' : 'border-black/10 bg-white/50'
                  }`}
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {entry.store}
                      {i === 0 && (
                        <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold">Mejor precio</span>
                      )}
                      {entry.isOnline && (
                        <span className="rounded-full bg-sky/60 px-2 py-0.5 text-xs font-medium text-black/70">
                          🌐 En línea
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-black/50">
                      {formatCurrency(entry.price)} · {entry.amount}
                      {entry.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold">
                      {formatUnitPrice(unitPrice.value, unitPrice.label)}
                      <span className="text-black/40">{unitPrice.label}</span>
                    </p>
                    {revealed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteEntry(entry.id)
                        }}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Eliminar precio"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-black/10 bg-white/50 p-4">
        <h2 className="font-display font-semibold">Agregar precio en otra tienda</h2>
        <form onSubmit={handleAddEntry} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Tienda
              <input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Ej. Soriana"
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
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Cantidad
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Unidad
              <Dropdown value={selectedUnit} options={unitOptions} onChange={(v) => setUnit(v)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-black/60">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 accent-sky"
            />
            Es una tienda en línea
          </label>
          <button
            type="submit"
            className="self-start rounded-full bg-sky px-5 py-2 font-display font-semibold text-black/80 transition hover:brightness-95"
          >
            Agregar precio
          </button>
        </form>
      </section>
    </div>
  )
}

export default ProductDetail
