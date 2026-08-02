import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { ImageUploader } from '../../components/ImageUploader'
import { QuantityInput } from '../../components/QuantityInput'
import { db } from '../../lib/db'
import { findExistingCategoryId, ICON_PALETTE } from '../../lib/categories'
import { capitalizeStoreName } from '../../lib/text'
import type { Unit, UnitKind } from '../../lib/types'

function AddProduct() {
  const navigate = useNavigate()
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])

  const [image, setImage] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitKind, setUnitKind] = useState<UnitKind>('peso')
  const [unit, setUnit] = useState<Unit>('g')
  const [amount, setAmount] = useState<number | ''>('')
  const [store, setStore] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [isOnline, setIsOnline] = useState(false)
  const [saving, setSaving] = useState(false)

  const canSave =
    name.trim() && categoryId && store.trim() && amount !== '' && amount > 0 && price !== '' && price > 0

  function handleUnitKindChange(kind: UnitKind) {
    setUnitKind(kind)
    setUnit(kind === 'peso' ? 'g' : kind === 'volumen' ? 'ml' : 'ud')
  }

  async function handleCreateCategory(categoryName: string, icon: string) {
    const existingId = findExistingCategoryId(categories ?? [], categoryName)
    if (existingId) return existingId
    const id = crypto.randomUUID()
    await db.categories.add({ id, name: categoryName.trim(), icon })
    return id
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)

    const productId = crypto.randomUUID()
    const now = Date.now()

    await db.products.add({
      id: productId,
      name: name.trim(),
      image,
      unitKind,
      categoryId,
      favorite: false,
      createdAt: now,
    })
    await db.priceEntries.add({
      id: crypto.randomUUID(),
      productId,
      store: capitalizeStoreName(store),
      price: Number(price),
      amount: Number(amount),
      unit,
      isOnline,
      date: now,
    })

    navigate(`/productos-frecuentes/${productId}`)
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🛒 Productos frecuentes
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Agregar producto</h1>
      <p className="mt-2 text-black/60">
        Registra un producto que compras siempre y su precio en la tienda donde lo compraste.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <ImageUploader value={image} onChange={setImage} />

        <label className="flex flex-col gap-1 text-sm text-black/60">
          Nombre del producto
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Pasta de dientes Colgate Total 12"
            className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-black/60">
          Categoría
          {categories && (
            <CategoryDropdown
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onCreate={handleCreateCategory}
              iconPalette={ICON_PALETTE}
            />
          )}
        </label>

        <div>
          <p className="mb-2 text-sm text-black/60">Cantidad del empaque</p>
          <QuantityInput
            unitKind={unitKind}
            amount={amount}
            unit={unit}
            onUnitKindChange={handleUnitKindChange}
            onAmountChange={setAmount}
            onUnitChange={setUnit}
          />
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/50 p-4">
          <p className="mb-3 font-display font-semibold">Precio en esta tienda</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Tienda
              <input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Ej. Walmart"
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
                placeholder="Ej. 89.50"
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-black/60">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 accent-sky"
            />
            Es una tienda en línea
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSave || saving}
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar producto
        </button>
      </form>
    </div>
  )
}

export default AddProduct
