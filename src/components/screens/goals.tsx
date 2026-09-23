"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeAllocation, removeGoal, saveAllocation, saveGoal } from "@/app/actions";
import { formatINDate } from "@/lib/format";
import type { GoalView, PortfolioResult } from "@/lib/types";
import { Dialog, Empty, ErrorNote, Field, Money, fieldClass, submitClass, useSubmit } from "../ui";

export function GoalsScreen({ data }: { data: PortfolioResult }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalView | "new" | null>(null);
  return (
    <div className="grid gap-4">
      <button className="h-10 w-fit rounded-lg bg-primary px-3 text-sm text-primary-foreground" onClick={() => setEditing("new")}>Add goal</button>
      {!data.goals.length ? <Empty title="No goals yet" body="Add an emergency fund, property, retirement, or other target. Assigning an asset here does not duplicate it in the portfolio." /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.goals.map((goal) => (
          <article key={goal.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{goal.name} {goal.isSample ? <span className="text-xs text-amber-700">Sample</span> : null}</h2>
              <button className="text-xs underline" onClick={() => setEditing(goal)}>Edit</button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Target <Money value={goal.targetAmount} /> · allocated <Money value={goal.allocated} /> · remaining <Money value={goal.remaining} /></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Number(goal.progressPct || 0))}%` }} />
            </div>
            <p className="mt-2 text-sm tabular">{goal.progressPct ?? "—"}% of target{goal.targetDate ? ` · target ${formatINDate(goal.targetDate)}` : ""}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{goal.completionNote}{goal.estimatedCompletion ? ` Estimated date ${formatINDate(goal.estimatedCompletion)}.` : ""}</p>
            <ul className="mt-3 text-sm">
              {goal.allocations.map((a) => (
                <li key={a.holdingId} className="flex justify-between gap-2 border-b py-1">
                  <span>{a.holdingName} · <Money value={a.amount} /></span>
                  <button className="text-xs text-rose-700" onClick={async () => {
                    const form = new FormData();
                    form.set("goalId", goal.id);
                    form.set("holdingId", a.holdingId);
                    await removeAllocation(form);
                    router.refresh();
                  }}>Remove</button>
                </li>
              ))}
            </ul>
            <AllocationForm goalId={goal.id} holdings={data.holdings.filter((h) => !h.isLiability)} />
            <button className="mt-3 text-xs text-rose-700" onClick={async () => {
              if (!window.confirm(`Delete ${goal.name}?`)) return;
              const form = new FormData();
              form.set("id", goal.id);
              form.set("confirm", "yes");
              await removeGoal(form);
              router.refresh();
            }}>Delete goal</button>
          </article>
        ))}
      </div>
      {editing ? (
        <Dialog title={editing === "new" ? "Add goal" : "Edit goal"} onClose={() => setEditing(null)}>
          <GoalForm initial={editing === "new" ? null : editing} onDone={() => { setEditing(null); router.refresh(); }} />
        </Dialog>
      ) : null}
    </div>
  );
}

function GoalForm({ initial, onDone }: { initial: GoalView | null; onDone: () => void }) {
  const { error, pending, onSubmit } = useSubmit(saveGoal, onDone);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Goal name" name="name" defaultValue={initial?.name} required />
      <Field label="Target amount (₹)" name="targetAmount" type="number" step="any" defaultValue={initial?.form.targetAmount} required />
      <Field label="Target date" name="targetDate" type="date" defaultValue={initial?.targetDate} />
      <Field label="Monthly contribution (₹)" name="monthlyContribution" type="number" step="any" defaultValue={initial?.form.monthlyContribution} />
      <label className="text-sm"><span className="mb-1 block font-medium">Notes</span><textarea name="notes" defaultValue={initial?.notes} className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <ErrorNote error={error} />
      <button className={submitClass(pending)} disabled={pending}>Save goal</button>
    </form>
  );
}

function AllocationForm({ goalId, holdings }: { goalId: string; holdings: PortfolioResult["holdings"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await saveAllocation(new FormData(event.currentTarget));
        if (!result.ok) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      }}
    >
      <input type="hidden" name="goalId" value={goalId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <select name="holdingId" className={fieldClass} aria-label="Holding to assign" defaultValue="">
          <option value="" disabled>Assign a holding</option>
          {holdings.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input name="amount" type="number" step="any" placeholder="Amount" className={fieldClass} aria-label="Amount to assign" />
        <button className="h-10 rounded-lg border px-3 text-sm">Assign</button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}
