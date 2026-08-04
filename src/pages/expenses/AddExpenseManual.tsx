import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { DatePicker } from '../../components/DatePicker'
import { Dropdown } from '../../components/Dropdown'
import { StorePicker } from '../../components/StorePicker'
import { SwipeableRow } from '../../components/SwipeableRow'
import { findExistingCategoryId } from '../../lib/categories'
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../lib/currency'
import { db } from '../../lib/db'
import { ICON_PALETTE } from '../../lib/expenseCategories'
import { computeExpenseStatus } from '../../lib/expenseStatus'
import { findExistingStoreId } from '../../lib/stores'

interface DraftItem {
  id: string
  nombre: string
  monto: string
  categoryId: string | null
}

function emptyItem(): DraftItem {
  return { id: crypto.randomUUID(), nombre: '', monto: '', categoryId: null }
}

function AddExpenseManual() {
  const navigate = useNavigate()

  const expenseCategories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const stores = useLiveQuery(() => db.stores.orderBy('name').toArray(), [])

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [storeId, setStoreId] = useState('')
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem()])

  async function handleCreateCategory(name: string, icon: string) {
    const existingId = findExistingCategoryId(expenseCategories ?? [], name)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    await db.expenseCategories.add({ id: newId, name: name.trim(), icon, createdAt: Date.now() })
    return newId
  }

  async function handleCreateStore(name: string, icon: string, image?: string) {
    const existingId = findExistingStoreId(stores ?? [], name)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    await db.stores.add({ id: newId, name: name.trim(), icon, image, createdAt: Date.now() })
    return newId
  }

  function updateItem(itemId: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const validItems = items.filter((it) => it.nombre.trim() && Number(it.monto) >= 0)
    if (validItems.length === 0) {
      alert('Agrega al menos un producto con nombre y monto para guardar el gasto.')
      return
    }

    const uncategorized = validItems.filter((it) => it.categoryId === null)
    if (uncategorized.length > 0) {
      const names = uncategorized.map((it) => `- ${it.nombre.trim()}`).join('\n')
      const proceed = confirm(`Aún no has categorizado:\n${names}\n\n¿Guardar de todos modos?`)
      if (!proceed) return
    }

    const expenseId = crypto.randomUUID()

    await db.transaction('rw', db.expenses, db.expenseItems, async () => {
      await db.expenses.add({
        id: expenseId,
        image: undefined,
        ocrText: '',
        status: computeExpenseStatus(validItems, 'pendiente_de_categorizar'),
        fecha,
        capturedAt: Date.now(),
        currency,
        merchant: null,
        storeId: storeId || null,
      })

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i]
        await db.expenseItems.add({
          id: item.id,
          expenseId,
          nombre: item.nombre.trim(),
          monto: Number(item.monto),
          categoryId: item.categoryId,
          order: i,
        })
      }
    })

    navigate('/gastos')
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/gastos" className="text-sm text-black/50 hover:text-black/70">
        ← Gastos
      </Link>

      <p className="mt-4 font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">
        🧾 Gastos
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">✍️ Agregar gasto a mano</h1>

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-6">
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Fecha
            <DatePicker value={fecha} onChange={setFecha} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-black/60">
            Moneda
            <Dropdown value={currency} options={CURRENCY_OPTIONS} onChange={setCurrency} />
          </label>
        </div>

        <label className="flex max-w-sm flex-col gap-1 text-sm text-black/60">
          Tienda (opcional)
          <StorePicker
            stores={stores ?? []}
            value={storeId}
            onChange={setStoreId}
            onCreate={handleCreateStore}
            allowNone
          />
        </label>

        <div>
          <p className="mb-2 font-display font-semibold">Productos</p>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <SwipeableRow key={item.id} onDelete={() => removeItem(item.id)}>
                <div className="rounded-xl border border-black/10 bg-white/50 p-3">
                  <div className="flex gap-2">
                    <input
                      value={item.nombre}
                      onChange={(e) => updateItem(item.id, { nombre: e.target.value })}
                      placeholder="Nombre del producto"
                      className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.monto}
                      onChange={(e) => updateItem(item.id, { monto: e.target.value })}
                      placeholder="0.00"
                      className="w-24 rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-black/80"
                    />
                  </div>
                  <div className="mt-2">
                    {expenseCategories && (
                      <CategoryDropdown
                        categories={expenseCategories}
                        value={item.categoryId ?? ''}
                        onChange={(categoryId) => updateItem(item.id, { categoryId: categoryId || null })}
                        onCreate={handleCreateCategory}
                        iconPalette={ICON_PALETTE}
                        allowNone
                      />
                    )}
                  </div>
                </div>
              </SwipeableRow>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 rounded-full border border-black/15 bg-white/60 px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5"
          >
            + Agregar producto
          </button>
        </div>

        <button
          type="submit"
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          Guardar gasto
        </button>
      </form>
    </div>
  )
}

export default AddExpenseManual
