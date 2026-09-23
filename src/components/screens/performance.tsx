"use client";

import { classLabel } from "@/lib/constants";
import type { PortfolioResult } from "@/lib/types";
import { Money, Pct } from "../ui";

export function PerformanceScreen({ data }: { data: PortfolioResult }) {
  const rows = data.holdings.filter((h) => h.investable);
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Capital invested" value={<Money value={data.cards.grossInvested} />} note="Sum of purchase amounts. Contributions are not profit." />
        <Metric label="Current investment value" value={<Money value={data.cards.portfolioValue} />} note="Investable holdings only." />
        <Metric label="Unrealized P/L" value={<Money value={data.cards.unrealized} signed />} note="Current value minus remaining cost. Not mixed with realized gains." />
        <Metric label="Realized P/L" value={<Money value={data.cards.realized} signed />} note="Gains and losses on recorded sales, using average cost." />
        <Metric label="Dividends and interest" value={<Money value={data.cards.income} />} note="Investment income recorded as its own transactions." />
        <Metric label="Total return" value={<Money value={data.cards.totalProfit} signed />} note="Unrealized + realized + income, each counted once." />
        <Metric label="Absolute return" value={<Pct value={data.cards.totalProfitPct} signed />} note="Total return ÷ capital invested. This is not an annualized return." />
        <Metric label="Portfolio XIRR" value={<span className="tabular">{data.performance.portfolioXirr ? `${data.performance.portfolioXirr}%` : "—"}</span>} note={data.performance.portfolioXirrNote} />
      </section>
      {data.cards.profitPartial ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">Profit is withheld because at least one investment is missing a value or cost. Nothing was filled in.</p> : null}
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="px-3 py-3 text-left font-semibold">Category returns</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {["Category", "Invested", "Value", "Unrealized", "Realized", "Income", "Absolute return"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.performance.byCategory.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2"><Money value={row.invested} /></td>
                <td className="px-3 py-2"><Money value={row.value} /></td>
                <td className="px-3 py-2"><Money value={row.unrealized} signed /></td>
                <td className="px-3 py-2"><Money value={row.realized} signed /></td>
                <td className="px-3 py-2"><Money value={row.income} /></td>
                <td className="px-3 py-2"><Pct value={row.absolutePct} signed /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="px-3 py-3 text-left font-semibold">Holding returns</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {["Holding", "Class", "Unrealized", "Realized", "Income", "Absolute", "XIRR", "Basis"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-b align-top">
                <td className="px-3 py-2">{h.name}</td>
                <td className="px-3 py-2">{classLabel(h.assetClass)}</td>
                <td className="px-3 py-2"><Money value={h.unrealized} signed /> <Pct value={h.unrealizedPct} signed /></td>
                <td className="px-3 py-2"><Money value={h.realized} signed /></td>
                <td className="px-3 py-2"><Money value={h.income} /></td>
                <td className="px-3 py-2"><Pct value={h.absoluteReturnPct} signed /></td>
                <td className="px-3 py-2 tabular">{h.xirr ? `${h.xirr}%` : "—"}<span className="block text-[11px] text-muted-foreground">{h.xirrNote}</span></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{h.valueLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <article className="rounded-2xl border bg-card p-4">
      <h2 className="text-sm text-muted-foreground">{label}</h2>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
    </article>
  );
}
