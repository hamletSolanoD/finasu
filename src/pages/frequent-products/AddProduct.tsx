import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { Dropdown } from '../../components/Dropdown'
import { ImageUploader } from '../../components/ImageUploader'
import { StorePicker } from '../../components/StorePicker'
import { db } from '../../lib/db'
import { findExistingCategoryId, ICON_PALETTE } from '../../lib/categories'
import { findExistingStoreId } from '../../lib/stores'
import type { Unit, UnitKind } from '../../lib/types'
import { PIECE_CONTENT_UNITS, UNITS_BY_KIND, UNIT_KINDS } from '../../lib/units'

function AddProduct() {
  const navigate = useNavigate()
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const stores = useLiveQuery(() => db.stores.orderBy('name').toArray(), [])

  const [image, setImage] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitKind, setUnitKind] = useState<UnitKind>('peso')
  const [unit, setUnit] = useState<Unit>('g')
  const [amount, setAmount] = useState<number | ''>('')
  const [storeId, setStoreId] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [isOnline, setIsOnline] = useState(false)
  // Solo para packs por pieza (unit 'ud'): cuánto contiene cada pieza (ej. 4 jabones de 90 g c/u).
  const [pieceAmount, setPieceAmount] = useState<number | ''>('')
  const [pieceUnit, setPieceUnit] = useState<Exclude<Unit, 'ud'>>('g')
  const [saving, setSaving] = useState(false)

  // El precio es opcional, pero no a medias: o se llena completo (tienda +
  // cantidad + precio) o se deja toda la sección vacía y se completa después.
  const priceStarted = storeId !== '' || amount !== '' || price !== '' || pieceAmount !== ''
  const priceComplete = storeId !== '' && amount !== '' && amount > 0 && price !== '' && price > 0
  const priceIncomplete = priceStarted && !priceComplete
  const canSave = Boolean(name.trim() && categoryId) && !priceIncomplete

  function handleUnitKindChange(kind: UnitKind) {
    setUnitKind(kind)
    setUnit(kind === 'peso' ? 'g' : kind === 'volumen' ? 'ml' : 'ud')
    setPieceAmount('')
    setPieceUnit('g')
  }

  async function handleCreateCategory(categoryName: string, icon: string) {
    const existingId = findExistingCategoryId(categories ?? [], categoryName)
    if (existingId) return existingId
    const id = crypto.randomUUID()
    await db.categories.add({ id, name: categoryName.trim(), icon })
    return id
  }

  async function handleCreateStore(storeName: string, icon: string, storeImage?: string) {
    const existingId = findExistingStoreId(stores ?? [], storeName)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    await db.stores.add({ id: newId, name: storeName.trim(), icon, image: storeImage, createdAt: Date.now() })
    return newId
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

    const selectedStore = (stores ?? []).find((s) => s.id === storeId)
    if (priceComplete && selectedStore) {
      const hasPieceContent = unit === 'ud' && pieceAmount !== '' && pieceAmount > 0
      await db.priceEntries.add({
        id: crypto.randomUUID(),
        productId,
        store: selectedStore.name,
        price: Number(price),
        amount: Number(amount),
        unit,
        isOnline,
        date: now,
        ...(hasPieceContent ? { amountPerPiece: Number(pieceAmount), pieceUnit } : {}),
      })
    }

    navigate(`/productos-frecuentes/${productId}`)
  }

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to="/productos-frecuentes">← Productos frecuentes</BackLink>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🛒 Productos frecuentes
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Agregar producto</h1>
      <p className="mt-2 text-black/60">
        Registra un producto que compras siempre. Si quieres, agrega también su primer precio — o
        complétalo después.
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

        <label className="flex flex-col gap-1 text-sm text-black/60">
          Se mide por
          <Dropdown value={unitKind} options={UNIT_KINDS} onChange={handleUnitKindChange} />
        </label>

        <div className="rounded-2xl border border-black/10 bg-white/50 p-4">
          <p className="font-display font-semibold">Primer precio</p>
          <p className="mb-3 text-xs text-black/50">Opcional — lo puedes llenar después.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Tienda
              <StorePicker
                stores={stores ?? []}
                value={storeId}
                onChange={setStoreId}
                onCreate={handleCreateStore}
                placeholder="Ej. Walmart"
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
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Cantidad
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ej. 500"
                className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-black/60">
              Unidad
              <Dropdown value={unit} options={UNITS_BY_KIND[unitKind]} onChange={setUnit} />
            </label>
          </div>
          {unit === 'ud' && (
            <div className="mt-3">
              <p className="text-sm text-black/60">¿Cuánto contiene cada pieza? (opcional)</p>
              <p className="text-xs text-black/40">
                Ej. pack de 4 jabones → cantidad 4 piezas, y cada jabón pesa 90 g.
              </p>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={pieceAmount}
                  onChange={(e) => setPieceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ej. 90"
                  className="rounded-xl border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                />
                <Dropdown value={pieceUnit} options={PIECE_CONTENT_UNITS} onChange={setPieceUnit} />
              </div>
            </div>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-black/60">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 accent-sky"
            />
            Es una tienda en línea
          </label>
          {priceIncomplete && (
            <p className="mt-3 text-sm text-red-500">
              Para guardar el primer precio completa tienda, cantidad y precio — o deja la sección
              vacía y llénala después.
            </p>
          )}
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
