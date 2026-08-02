import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { committedForMonth, getIncomeForMonth } from '../lib/categoryLimits'
import { computeMonthlySpendByCategory } from '../lib/budget'
import { db } from '../lib/db'
import { computeCategoryBreakdown, monthKeyWithOffset } from '../lib/summary'
import { formatCurrency } from '../lib/units'

const EXAMPLE_PROMPTS = [
  '¿Cuánto he gastado este mes?',
  '¿Cuánto puedo ahorrar?',
  '¿Cómo van mis finanzas hasta ahora?',
  '¿Cuánto llevo en Despensa?',
  '¿Qué categoría se me está pasando?',
  '¿Cuánto me sobra este mes?',
]

const VISIBLE_CHIPS = 3
const ROTATE_MS = 5000

interface Answer {
  text: string
  to?: string
}

function computeAnswer(
  raw: string,
  data: {
    expenses: Parameters<typeof computeCategoryBreakdown>[0]
    items: Parameters<typeof computeCategoryBreakdown>[1]
    categories: Parameters<typeof computeCategoryBreakdown>[2]
    limits: Parameters<typeof committedForMonth>[0]
    income: number | null
  },
): Answer {
  const q = raw.trim().toLowerCase()
  if (!q) return { text: 'Escribe una pregunta sobre tus finanzas.' }

  const monthKey = monthKeyWithOffset(0)
  const { expenses, items, categories, limits, income } = data

  const matchedCategory = categories.find((c) => q.includes(c.name.toLowerCase()))
  if (matchedCategory) {
    const spendByCategory = computeMonthlySpendByCategory(expenses, items)
    const spent = spendByCategory.get(matchedCategory.id) ?? 0
    return {
      text: `Llevas ${formatCurrency(spent)} en ${matchedCategory.icon} ${matchedCategory.name} este mes.`,
      to: `/gastos/categorias#cat-${matchedCategory.id}`,
    }
  }

  if (q.includes('ahorr') || q.includes('sobra') || q.includes('disponible')) {
    if (income === null) {
      return {
        text: 'Todavía no tienes un ingreso mensual registrado — agrégalo en Categorías y límites para calcular esto.',
        to: '/gastos/categorias',
      }
    }
    const committed = committedForMonth(limits, monthKey)
    const disponible = income - committed
    return {
      text: `Te queda ${formatCurrency(Math.max(0, disponible))} disponible este mes después de tus límites de categoría.`,
      to: '/ahorro',
    }
  }

  if (q.includes('pasand') || q.includes('exced')) {
    return { text: 'Revisa el panel de Inicio o Categorías y límites — ahí te aviso apenas una categoría se acerque o pase su límite.', to: '/gastos/categorias' }
  }

  if (q.includes('gast')) {
    const { total } = computeCategoryBreakdown(expenses, items, categories, monthKey)
    return { text: `Llevas ${formatCurrency(total)} gastados este mes.`, to: '/resumen' }
  }

  if (q.includes('finan') || q.includes('balance') || q.includes('como van') || q.includes('cómo van')) {
    const { total } = computeCategoryBreakdown(expenses, items, categories, monthKey)
    const balance = income !== null ? income - total : null
    return {
      text:
        balance !== null
          ? `Este mes has gastado ${formatCurrency(total)} y tu balance es ${formatCurrency(balance)}.`
          : `Este mes has gastado ${formatCurrency(total)}. Agrega tu ingreso mensual para ver tu balance completo.`,
      to: '/resumen',
    }
  }

  return {
    text:
      'Todavía no puedo responder preguntas tan específicas — la IA completa llega pronto. Mientras tanto, prueba con "cuánto he gastado", "cuánto puedo ahorrar" o "cómo van mis finanzas".',
  }
}

/** Buscador con respuestas de datos reales para preguntas simples — la IA completa llega después. */
export function SmartSearch() {
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const items = useLiveQuery(() => db.expenseItems.toArray(), [])
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), [])
  const limits = useLiveQuery(() => db.categoryLimits.toArray(), [])
  const incomes = useLiveQuery(() => db.monthlyIncomes.toArray(), [])

  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [chipStart, setChipStart] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setChipStart((i) => (i + VISIBLE_CHIPS) % EXAMPLE_PROMPTS.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  const ready = expenses && items && categories && limits && incomes

  function ask(text: string) {
    if (!ready) return
    const income = getIncomeForMonth(monthKeyWithOffset(0), incomes)?.income ?? null
    setQuery(text)
    setAnswer(computeAnswer(text, { expenses, items, categories, limits, income }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    ask(query)
  }

  const visibleChips = Array.from({ length: VISIBLE_CHIPS }, (_, i) => EXAMPLE_PROMPTS[(chipStart + i) % EXAMPLE_PROMPTS.length])

  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          ✨
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAnswer(null)
          }}
          placeholder="Pregúntale a tus finanzas..."
          className="min-w-0 flex-1 bg-transparent text-black/80 placeholder:text-black/35 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready}
          className="shrink-0 rounded-full bg-sage px-4 py-1.5 text-sm font-semibold text-black/80 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preguntar
        </button>
      </form>

      {answer ? (
        <div className="mt-3 rounded-xl border border-sky/40 bg-sky/10 p-3 text-sm text-black/70">
          {answer.text}
          {answer.to && (
            <Link to={answer.to} className="ml-2 font-medium underline">
              Ver más →
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleChips.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/5"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
