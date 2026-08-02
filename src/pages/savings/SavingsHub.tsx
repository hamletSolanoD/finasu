import { useState } from 'react'
import { FutureExpensesPanel } from './FutureExpensesPanel'
import { SavingsGoalsPanel } from './SavingsGoalsPanel'

type Tab = 'ahorro' | 'gastos-futuros'

function SavingsHub() {
  const [tab, setTab] = useState<Tab>('ahorro')

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-black/40">💰 Ahorro</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        {tab === 'ahorro' ? '💰 Tus metas de ahorro' : '🎯 Gastos futuros'}
      </h1>

      <div className="mt-6 inline-flex rounded-full border border-black/10 bg-white/50 p-1">
        <button
          type="button"
          onClick={() => setTab('ahorro')}
          className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition ${
            tab === 'ahorro' ? 'bg-sage text-black/80' : 'text-black/50 hover:bg-black/5'
          }`}
        >
          💰 Ahorro
        </button>
        <button
          type="button"
          onClick={() => setTab('gastos-futuros')}
          className={`rounded-full px-5 py-2 font-display text-sm font-semibold transition ${
            tab === 'gastos-futuros' ? 'bg-sky text-black/80' : 'text-black/50 hover:bg-black/5'
          }`}
        >
          🎯 Gastos futuros
        </button>
      </div>

      {tab === 'ahorro' ? <SavingsGoalsPanel /> : <FutureExpensesPanel />}
    </div>
  )
}

export default SavingsHub
