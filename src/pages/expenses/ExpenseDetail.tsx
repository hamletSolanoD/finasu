import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { CategoryDropdown } from '../../components/CategoryDropdown'
import { useConfirm } from '../../components/ConfirmModal'
import { DatePicker } from '../../components/DatePicker'
import { Dropdown } from '../../components/Dropdown'
import { StorePicker } from '../../components/StorePicker'
import { SwipeableRow } from '../../components/SwipeableRow'
import { findExistingCategoryId } from '../../lib/categories'
import { isMonthFinalized } from '../../lib/categoryLimits'
import { CURRENCY_OPTIONS } from '../../lib/currency'
import { db } from '../../lib/db'
import { formatFechaLarga } from '../../lib/date'
import { ICON_PALETTE } from '../../lib/expenseCategories'
import { computeExpenseStatus, splitDraftItems } from '../../lib/expenseStatus'
import { ensureIvaCategory, looksLikeIva } from '../../lib/ivaCategory'
import { smartBack } from '../../lib/navigationHistory'
import { findExistingStoreId, matchStoreByMerchant } from '../../lib/stores'
import { parseTicketLines } from '../../lib/ticketParser'
import type { Expense, ExpenseCategory, ExpenseItem, Store } from '../../lib/types'
import { formatCurrency } from '../../lib/units'
import { useModalBack } from '../../lib/useModalBack'

interface DraftItem {
  id: string
  nombre: string
  monto: string
  categoryId: string | null
}

/** Un ticket de un mes ya cerrado (ver MonthFinalization) — igual que un límite ya guardado, solo lectura. */
function ReadOnlyExpenseDetail({
  expense,
  items,
  categories,
  stores,
}: {
  expense: Expense
  items: ExpenseItem[]
  categories: ExpenseCategory[]
  stores: Store[]
}) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [showOcrText, setShowOcrText] = useState(false)

  useModalBack(viewerOpen, () => setViewerOpen(false))

  const store = expense.storeId ? stores.find((s) => s.id === expense.storeId) : undefined
  const total = items.reduce((sum, i) => sum + i.monto, 0)

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to="/gastos">← Gastos</BackLink>

      <div className="mt-4 flex items-start gap-4">
        {expense.image && (
          <button type="button" onClick={() => setViewerOpen(true)} className="shrink-0 cursor-pointer">
            <img src={expense.image} alt="Ticket" className="h-32 w-32 rounded-2xl object-cover" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{formatFechaLarga(expense.fecha)}</h1>
          <p className="mt-1 text-sm text-black/50">
            {store ? `${store.icon} ${store.name}` : (expense.merchant ?? 'Sin tienda')}
          </p>
          <button
            type="button"
            onClick={() => setShowOcrText((v) => !v)}
            className="mt-1 block text-xs text-black/40 underline hover:text-black/60"
          >
            {showOcrText ? 'Ocultar texto leído' : 'Ver texto leído (OCR)'}
          </button>
          <p className="mt-2 text-xs font-medium text-black/40">
            🔒 Este mes ya se guardó definitivamente — el ticket queda de solo lectura.
          </p>
        </div>
      </div>

      {viewerOpen && expense.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setViewerOpen(false)}
        >
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            ✕
          </button>
          <img src={expense.image} alt="Ticket" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {showOcrText && (
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-black/10 bg-white/50 p-3 text-xs text-black/60">
          {expense.ocrText || '(no se detectó texto legible)'}
        </pre>
      )}

      <div className="mt-6">
        <p className="mb-2 font-display font-semibold">Productos</p>
        {items.length === 0 ? (
          <p className="text-sm text-black/50">Este ticket no tiene productos registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId)
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/50 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.nombre}</span>
                    <span className="block text-xs text-black/50">
                      {category ? `${category.icon} ${category.name}` : 'Sin categoría'}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatCurrency(item.monto)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <p className="font-display font-semibold">Total: {formatCurrency(total)}</p>
        <p className="text-xs text-black/40">
          {items.length} producto{items.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const expense = useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id])
  const dbItems = useLiveQuery(
    () => (id ? db.expenseItems.where('expenseId').equals(id).sortBy('order') : []),
    [id],
  )
  const expenseCategories = useLiveQuery(() => db.expenseCategories.orderBy('name').toArray(), [])
  const stores = useLiveQuery(() => db.stores.orderBy('name').toArray(), [])
  const finalizations = useLiveQuery(() => db.monthFinalizations.toArray(), [])

  const [fecha, setFecha] = useState('')
  const [currency, setCurrency] = useState('')
  const [storeId, setStoreId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [showOcrText, setShowOcrText] = useState(false)
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)
  const [storeAutoMatchedFor, setStoreAutoMatchedFor] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Precarga el borrador una sola vez, cuando el ticket y sus productos terminan de cargar.
  useEffect(() => {
    if (!expense || dbItems === undefined || loadedFrom === expense.id) return
    setFecha(expense.fecha)
    setCurrency(expense.currency)
    setStoreId(expense.storeId ?? '')
    setItems(
      dbItems.map((i) => ({ id: i.id, nombre: i.nombre, monto: String(i.monto), categoryId: i.categoryId })),
    )
    setLoadedFrom(expense.id)
  }, [expense, dbItems, loadedFrom])

  // Nice-to-have: si un ticket viejo nunca se auto-emparejó con una tienda (storeId
  // sigue vacío), intenta emparejarlo en cuanto las tiendas terminan de cargar — sin
  // pisar una tienda que el usuario ya haya elegido a mano en este borrador.
  useEffect(() => {
    if (!expense || stores === undefined || loadedFrom !== expense.id) return
    if (storeAutoMatchedFor === expense.id) return
    if (!storeId) {
      const matched = matchStoreByMerchant(expense.merchant, stores)
      if (matched) setStoreId(matched)
    }
    setStoreAutoMatchedFor(expense.id)
  }, [expense, stores, loadedFrom, storeId, storeAutoMatchedFor])

  // El botón atrás del teléfono cierra el visor de la foto en vez de irse a Gastos.
  useModalBack(viewerOpen, () => setViewerOpen(false))

  if (!expense || finalizations === undefined) return null

  if (isMonthFinalized(expense.fecha.slice(0, 7), finalizations)) {
    return (
      <ReadOnlyExpenseDetail
        expense={expense}
        items={dbItems ?? []}
        categories={expenseCategories ?? []}
        stores={stores ?? []}
      />
    )
  }

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

  async function handleReprocessOcr() {
    if (!expense) return
    const confirmed = await confirm({
      title: '¿Reprocesar este ticket?',
      body: "Esto reemplazará los productos actuales por un nuevo análisis del texto del OCR — perderás las categorías que ya hayas puesto en este borrador. Los cambios no se guardan hasta que presiones 'Guardar cambios'.",
    })
    if (!confirmed) return
    const parsed = parseTicketLines(expense.ocrText || '')
    let ivaCategoryId: string | null = null
    const nextItems: DraftItem[] = []
    for (const p of parsed) {
      let categoryId: string | null = null
      if (looksLikeIva(p.nombre)) {
        ivaCategoryId ??= await ensureIvaCategory()
        categoryId = ivaCategoryId
      }
      nextItems.push({ id: crypto.randomUUID(), nombre: p.nombre, monto: String(p.monto), categoryId })
    }
    setItems(nextItems)
  }

  async function handleDeletePhoto() {
    if (!expense) return
    const confirmed = await confirm({
      title: '¿Eliminar la foto de este ticket?',
      body: 'Conservas todo el texto y los productos ya categorizados — solo dejas de poder ver la imagen original para comparar. Esto no se puede deshacer.',
    })
    if (!confirmed) return
    await db.expenses.update(expense.id, { image: undefined })
    setViewerOpen(false)
  }

  function updateItem(itemId: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), nombre: '', monto: '', categoryId: null }])
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const itemsConMonto = items.filter((it) => it.monto.trim() !== '' && Number.isFinite(Number(it.monto)))
  const totalItems = itemsConMonto.reduce((sum, it) => sum + Number(it.monto), 0)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const { complete: validItems, incomplete } = splitDraftItems(items)
    const existingIds = new Set((dbItems ?? []).map((i) => i.id))
    const keptIds = new Set(validItems.map((i) => i.id))

    if (incomplete.length > 0) {
      const willDelete = incomplete.some((it) => existingIds.has(it.id))
      const names = incomplete.map((it) => `- ${it.nombre.trim() || '(sin nombre)'}`).join('\n')
      const proceed = await confirm({
        title: 'Hay productos incompletos',
        body: willDelete
          ? `Les falta nombre o monto, así que se van a ELIMINAR (ya estaban guardados):\n${names}\n\n¿Continuar?`
          : `Les falta nombre o monto, así que no se van a guardar:\n${names}\n\n¿Continuar sin ellos?`,
      })
      if (!proceed) return
    }

    const uncategorized = validItems.filter((it) => it.categoryId === null)
    if (uncategorized.length > 0) {
      const names = uncategorized.map((it) => `- ${it.nombre.trim()}`).join('\n')
      const proceed = await confirm({ title: 'Aún no has categorizado', body: `${names}\n\n¿Guardar de todos modos?` })
      if (!proceed) return
    }

    await db.transaction('rw', db.expenses, db.expenseItems, async () => {
      await db.expenses.update(expense!.id, {
        fecha: fecha || expense!.fecha,
        currency: currency || expense!.currency,
        storeId: storeId || null,
        status: computeExpenseStatus(validItems, expense!.status),
      })

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i]
        await db.expenseItems.put({
          id: item.id,
          expenseId: expense!.id,
          nombre: item.nombre.trim(),
          monto: Number(item.monto),
          categoryId: item.categoryId,
          order: i,
        })
      }

      for (const oldId of existingIds) {
        if (!keptIds.has(oldId)) await db.expenseItems.delete(oldId)
      }
    })

    smartBack(navigate, '/gastos')
  }

  return (
    <div className="mx-auto max-w-lg">
      <BackLink to="/gastos">← Gastos</BackLink>

      <div className="mt-4 flex items-start gap-4">
        {expense.image && (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="shrink-0 cursor-pointer"
          >
            <img src={expense.image} alt="Ticket" className="h-32 w-32 rounded-2xl object-cover" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{formatFechaLarga(expense.fecha)}</h1>
          <button
            type="button"
            onClick={() => setShowOcrText((v) => !v)}
            className="mt-1 block text-xs text-black/40 underline hover:text-black/60"
          >
            {showOcrText ? 'Ocultar texto leído' : 'Ver texto leído (OCR)'}
          </button>
          <button
            type="button"
            onClick={handleReprocessOcr}
            className="mt-1 block text-xs text-black/40 underline hover:text-black/60"
          >
            🔄 Reprocesar con OCR
          </button>
          {expense.image && (
            <button
              type="button"
              onClick={handleDeletePhoto}
              className="mt-1 block text-xs text-black/40 underline hover:text-black/60"
            >
              🗑️ Eliminar foto (quedarme solo con el texto)
            </button>
          )}
        </div>
      </div>

      {viewerOpen && expense.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setViewerOpen(false)}
        >
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            ✕
          </button>
          <img src={expense.image} alt="Ticket" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {showOcrText && (
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-black/10 bg-white/50 p-3 text-xs text-black/60">
          {expense.ocrText || '(no se detectó texto legible)'}
        </pre>
      )}

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
          <label className="col-span-2 flex flex-col gap-1 text-sm text-black/60">
            Tienda
            {stores && (
              <StorePicker
                stores={stores}
                value={storeId}
                onChange={setStoreId}
                onCreate={handleCreateStore}
                allowNone
              />
            )}
          </label>
        </div>

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

        <div>
          <p className="font-display font-semibold">Total: {formatCurrency(totalItems)}</p>
          <p className="text-xs text-black/40">
            {itemsConMonto.length} producto{itemsConMonto.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          type="submit"
          className="rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  )
}

export default ExpenseDetail
