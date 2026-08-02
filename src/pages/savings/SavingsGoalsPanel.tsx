import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../lib/db'
import type { SavingsGoal } from '../../lib/types'
import { SavingsGoalCard } from './SavingsGoalCard'
import { SavingsGoalForm } from './SavingsGoalForm'

export function SavingsGoalsPanel() {
  const goals = useLiveQuery(() => db.savingsGoals.orderBy('name').toArray(), [])
  const deposits = useLiveQuery(() => db.savingsDeposits.toArray(), [])

  const [creating, setCreating] = useState(false)

  if (!goals || !deposits) return null

  async function handleCreate(values: Omit<SavingsGoal, 'id'>) {
    await db.savingsGoals.add({
      id: crypto.randomUUID(),
      ...values,
    })
    setCreating(false)
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {goals.map((goal) => (
          <SavingsGoalCard key={goal.id} goal={goal} deposits={deposits.filter((d) => d.goalId === goal.id)} />
        ))}
      </div>

      {goals.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-8 text-center text-black/50">
          Aún no agregas ninguna meta de ahorro.
        </div>
      )}

      {creating ? (
        <div className="mt-4">
          <SavingsGoalForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-4 rounded-full bg-sage px-5 py-2.5 font-display font-semibold text-black/80 transition hover:brightness-95"
        >
          + Nuevo ahorro
        </button>
      )}
    </div>
  )
}
