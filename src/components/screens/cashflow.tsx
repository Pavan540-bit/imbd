"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR, formatPct } from "@/lib/format";
import type { PortfolioResult } from "@/lib/types";
import { FlowChart } from "../charts";
import { TransactionForm } from "../txn-form";
import { Dialog, Money } from "../ui";

export function CashflowScreen({ data }: { data: PortfolioResult }) {
  const router = useRouter();
  const [open, setOpen] = useState<"income" | "expense" | null>(null);
  const current = data.cashflow.current;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <button className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground" onClick={() => setOpen("income")}>Add income</button>
        <button className="h-10 rounded-lg border px-3 text-sm" onClick={() => setOpen("expense")}>Add expense</button>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Monthly income" value={current.income} />
        <Tile label="Monthly expenses" value={current.expense} />
        <Tile label="Monthly surplus" value={current.surplus} />
        <article className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm text-muted-foreground">Savings rate</h2>
          <p className="mt-2 text-xl font-semibold tabular">{formatPct(current.savingsRate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Surplus ÷ income. Investments are not treated as expenses.</p>
        </article>
      </section>
      <p className="text-sm text-muted-foreground">
        Investment contributions this month: <Money value={current.invested} />. Transfers: <Money value={current.transfers} />. The chart shows only amounts you recorded.
      </p>
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Income and expenses</h2>
        <FlowChart rows={data.cashflow.months} />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {["Month", "Income", "Expenses", "Surplus", "Invested", "Savings rate"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.cashflow.months.map((m) => (
              <tr key={m.month} className="border-b">
                <td className="px-3 py-2">{m.month}</td>
                <td className="px-3 py-2 tabular">{formatINR(m.income)}</td>
                <td className="px-3 py-2 tabular">{formatINR(m.expense)}</td>
                <td className="px-3 py-2 tabular">{formatINR(m.surplus)}</td>
                <td className="px-3 py-2 tabular">{formatINR(m.invested)}</td>
                <td className="px-3 py-2 tabular">{formatPct(m.savingsRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Dialog title={open === "income" ? "Add income" : "Add expense"} onClose={() => setOpen(null)}>
          <TransactionForm holdings={data.holdings} kind={open} onDone={() => { setOpen(null); router.refresh(); }} />
        </Dialog>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-card p-4">
      <h2 className="text-sm text-muted-foreground">{label}</h2>
      <p className="mt-2 text-xl font-semibold"><Money value={value} /></p>
    </article>
  );
}
